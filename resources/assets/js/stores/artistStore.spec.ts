import { expect, it } from 'vitest'
import UnitTestCase from '@/__tests__/UnitTestCase'
import factory from '@/__tests__/factory'
import { http } from '@/services/http'
import { artistStore } from '@/stores/artistStore'

new class extends UnitTestCase {
  protected beforeEach () {
    super.beforeEach(() => {
      artistStore.vault.clear()
      artistStore.state.artists = []
    })
  }

  protected test () {
    it('gets an artist by ID', () => {
      const artist = factory('artist')
      artistStore.vault.set(artist.id, artist)
      expect(artistStore.byId(artist.id)).toEqual(artist)
    })

    it('removes artists by IDs', () => {
      const artists = factory('artist', 3)
      artists.forEach(artist => artistStore.vault.set(artist.id, artist))
      artistStore.state.artists = artists

      artistStore.removeByIds([artists[0].id, artists[1].id])

      expect(artistStore.vault.size).toBe(1)
      expect(artistStore.vault.has(artists[0].id)).toBe(false)
      expect(artistStore.vault.has(artists[1].id)).toBe(false)
      expect(artistStore.state.artists).toEqual([artists[2]])
    })

    it('identifies an unknown artist', () => {
      const artist = factory.states('unknown')('artist')

      expect(artistStore.isUnknown(artist)).toBe(true)
      expect(artistStore.isUnknown(artist.name)).toBe(true)
      expect(artistStore.isUnknown(factory('artist'))).toBe(false)
    })

    it('identifies the various artist', () => {
      const artist = factory.states('various')('artist')

      expect(artistStore.isVarious(artist)).toBe(true)
      expect(artistStore.isVarious(artist.name)).toBe(true)
      expect(artistStore.isVarious(factory('artist'))).toBe(false)
    })

    it('identifies a standard artist', () => {
      expect(artistStore.isStandard(factory.states('unknown')('artist'))).toBe(false)
      expect(artistStore.isStandard(factory.states('various')('artist'))).toBe(false)
      expect(artistStore.isStandard(factory('artist'))).toBe(true)
    })

    it('syncs artists with the vault', () => {
      const artist = factory('artist', { name: 'Led Zeppelin' })

      artistStore.syncWithVault(artist)
      expect(artistStore.vault.get(artist.id)).toEqual(artist)

      artist.name = 'Pink Floyd'
      artistStore.syncWithVault(artist)

      expect(artistStore.vault.size).toBe(1)
      expect(artistStore.vault.get(artist.id)?.name).toBe('Pink Floyd')
    })

    it('uploads an image for an artist', async () => {
      const artist = factory('artist')
      artistStore.syncWithVault(artist)
      const putMock = this.mock(http, 'put').mockResolvedValue({ image_url: 'http://test/img.jpg' })

      await artistStore.uploadImage(artist, 'data://image')

      expect(artist.image).toBe('http://test/img.jpg')
      expect(putMock).toHaveBeenCalledWith(`artists/${artist.id}/image`, { image: 'data://image' })
      expect(artistStore.byId(artist.id)?.image).toBe('http://test/img.jpg')
    })

    it('resolves an artist', async () => {
      const artist = factory('artist')
      const getMock = this.mock(http, 'get').mockResolvedValueOnce(artist)

      expect(await artistStore.resolve(artist.id)).toEqual(artist)
      expect(getMock).toHaveBeenCalledWith(`artists/${artist.id}`)

      // next call shouldn't make another request
      expect(await artistStore.resolve(artist.id)).toEqual(artist)
      expect(getMock).toHaveBeenCalledOnce()
    })

    it('paginates', async () => {
      const artists = factory('artist', 3)

      this.mock(http, 'get').mockResolvedValueOnce({
        data: artists,
        links: {
          next: '/artists?page=2',
        },
        meta: {
          current_page: 1,
        },
      })

      expect(await artistStore.paginate({
        page: 1,
        sort: 'name',
        order: 'asc',
      })).toEqual(2)

      expect(artistStore.state.artists).toEqual(artists)
      expect(artistStore.vault.size).toBe(3)
    })
  }
}

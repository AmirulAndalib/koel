<template>
  <div id="wrapper" :class="{ 'standalone' : inStandaloneMode }">
    <template v-if="authenticated">
      <AlbumArtOverlay v-if="showAlbumArtOverlay && album" :album="album"/>

      <main>
        <template v-if="connected">
          <div class="details" v-if="song">
            <div :style="{ backgroundImage: `url(${song.album.cover})` }" class="cover"/>
            <div class="info">
              <div class="wrap">
                <p class="title text">{{ song.title }}</p>
                <p class="artist text">{{ song.artist.name }}</p>
                <p class="album text">{{ song.album.name }}</p>
              </div>
            </div>
          </div>
          <p class="none text-secondary" v-else>No song is playing.</p>
          <footer>
            <a class="favorite" @click.prevent="toggleFavorite">
              <i class="fa fa-heart yep" v-if="song?.liked"></i>
              <i class="fa fa-heart-o" v-else></i>
            </a>
            <a class="prev" @click="playPrev">
              <i class="fa fa-step-backward"></i>
            </a>
            <a class="play-pause" @click.prevent="togglePlayback">
              <i class="fa fa-pause" v-if="playing"/>
              <i class="fa fa-play" v-else/>
            </a>
            <a class="next" @click.prevent="playNext">
              <i class="fa fa-step-forward"></i>
            </a>
            <span class="volume">
              <span
                v-show="showingVolumeSlider"
                ref="volumeSlider"
                id="volumeSlider"
                v-koel-clickaway="closeVolumeSlider"
              />
              <span class="icon" @click.stop="toggleVolumeSlider">
                <i class="fa fa-volume-off" v-if="muted"/>
                <i class="fa fa-volume-up" v-else/>
              </span>
            </span>
          </footer>
        </template>
        <div v-else class="loader">
          <div v-if="!maxRetriesReached">
            <p>Searching for Koel…</p>
            <div class="signal"></div>
          </div>
          <p v-else>
            No active Koel instance found.
            <a class="rescan text-orange" @click.prevent="rescan">Rescan</a>
          </p>
        </div>
      </main>
    </template>

    <div class="login-wrapper" v-else>
      <login-form @loggedin="onUserLoggedIn"/>
    </div>
  </div>
</template>

<script lang="ts" setup>
import noUISlider from 'nouislider'
import { authService, socketService } from '@/services'
import { preferenceStore, userStore } from '@/stores'
import { SliderElement } from 'koel/types/ui'
import { computed, defineAsyncComponent, nextTick, onMounted, ref, toRef, watch } from 'vue'

import LoginForm from '@/components/auth/LoginForm.vue'

const MAX_RETRIES = 10
const DEFAULT_VOLUME = 7

const AlbumArtOverlay = defineAsyncComponent(() => import('@/components/ui/AlbumArtOverlay.vue'))

const volumeSlider = ref<SliderElement>()
const authenticated = ref(false)
const song = ref<Song | null>(null)
const connected = ref(false)
const muted = ref(false)
const showingVolumeSlider = ref(false)
const retries = ref(0)
const showAlbumArtOverlay = toRef(preferenceStore.state, 'showAlbumArtOverlay')
const volume = ref(DEFAULT_VOLUME)

const inStandaloneMode = ref(
  (window.navigator as any).standalone || window.matchMedia('(display-mode: standalone)').matches
)

watch(connected, async () => {
  await nextTick()

  if (!volumeSlider.value) return

  noUISlider.create(volumeSlider.value, {
    orientation: 'vertical',
    connect: [true, false],
    start: volume.value || DEFAULT_VOLUME,
    range: { min: 0, max: 10 },
    direction: 'rtl'
  })

  if (!volumeSlider.value.noUiSlider) {
    throw new Error('Failed to initialize noUISlider on element #volumeSlider')
  }

  volumeSlider.value.noUiSlider.on('change', (values: number[], handle: number): void => {
    const volume = values[handle]
    muted.value = !volume
    socketService.broadcast('SOCKET_SET_VOLUME', { volume })
  })
})

watch(volume, () => volumeSlider.value?.noUiSlider!.set(volume.value || DEFAULT_VOLUME))

const onUserLoggedIn = () => {
  authenticated.value = true
  init()
}

const init = async () => {
  try {
    const user = await userStore.getProfile()
    userStore.init([], user)

    await socketService.init()

    socketService
      .listen('SOCKET_SONG', ({ song: _song }: { song: Song }) => (song.value = _song))
      .listen('SOCKET_PLAYBACK_STOPPED', () => song.value && (song.value.playbackState = 'Stopped'))
      .listen('SOCKET_VOLUME_CHANGED', (volume: number) => volumeSlider.value?.noUiSlider?.set(volume))
      .listen('SOCKET_STATUS', ({ song: _song, volume: _volume }: { song: Song, volume: number }) => {
        song.value = _song
        volume.value = _volume || DEFAULT_VOLUME
        connected.value = true
      })

    scan()
  } catch (e) {
    console.error(e)
    authenticated.value = false
  }
}

const toggleVolumeSlider = () => (showingVolumeSlider.value = !showingVolumeSlider.value)
const closeVolumeSlider = () => (showingVolumeSlider.value = false)

const toggleFavorite = () => {
  if (!song.value) {
    return
  }

  song.value.liked = !song.value.liked
  socketService.broadcast('SOCKET_TOGGLE_FAVORITE')
}

const togglePlayback = () => {
  if (song.value) {
    song.value.playbackState = song.value.playbackState === 'Playing' ? 'Paused' : 'Playing'
  }

  socketService.broadcast('SOCKET_TOGGLE_PLAYBACK')
}

const playNext = () => socketService.broadcast('SOCKET_PLAY_NEXT')
const playPrev = () => socketService.broadcast('SOCKET_PLAY_PREV')
const getStatus = () => socketService.broadcast('SOCKET_GET_STATUS')

const scan = () => {
  if (!connected.value) {
    if (!maxRetriesReached.value) {
      getStatus()
      retries.value++
      window.setTimeout(scan, 1000)
    }
  } else {
    retries.value = 0
  }
}

const rescan = () => {
  retries.value = 0
  scan()
}

const playing = computed(() => Boolean(song.value?.playbackState === 'Playing'))
const maxRetriesReached = computed(() => retries.value >= MAX_RETRIES)
const album = computed(() => song.value?.album)

onMounted(() => {
  // The app has just been initialized, check if we can get the user data with an already existing token
  if (authService.hasToken()) {
    authenticated.value = true
    init()
  }
})
</script>

<style lang="scss">
@import "~#/partials/_shared.scss";

body, html {
  height: 100vh;
}

#wrapper {
  height: 100vh;
  background: var(--color-bg-primary);

  .login-wrapper {
    display: flex;
    min-height: 100vh;
    flex-direction: column;

    @include vertical-center();
  }

  .loader {
    display: flex;
    justify-content: center;
    align-items: center;
    flex: 1;
    position: relative;

    p {
      position: absolute;
      height: 100%;
      width: 100%;
      display: flex;
      justify-content: center;
      align-items: center;
      top: 0;
      left: 0;
      padding-bottom: 40px;
    }

    .signal {
      border: 1px solid var(--color-highlight);
      border-radius: 50%;
      height: 0;
      opacity: 0;
      width: 50vw;
      animation: pulsate 1.5s ease-out;
      animation-iteration-count: infinite;
      transform: translate(-50%, -50%);
    }

    .rescan {
      margin-left: 5px;
    }

    @keyframes pulsate {
      0% {
        transform: scale(.1);
        opacity: 0.0;
      }
      50% {
        opacity: 1;
      }
      100% {
        transform: scale(1.2);
        opacity: 0;
      }
    }
  }
}

main {
  height: 100vh;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  text-align: center;
  z-index: 1;
  position: relative;

  .none, .details {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: space-around;
  }

  .details {
    .info {
      width: 100%;
      display: flex;
      flex-direction: column;
      justify-content: space-around;
    }

    .cover {
      margin: 0 auto;
      width: calc(70vw + 4px);
      height: calc(70vw + 4px);
      border-radius: 50%;
      border: 2px solid var(--color-text-primary);
      background-position: center center;
      background-size: cover;
      background-color: var(--color-bg-secondary);
    }

    .text {
      max-width: 90%;
      margin: 0 auto;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      line-height: 1.3;
    }

    .title {
      font-size: 6vmin;
      font-weight: bold;
      margin: 0 auto 10px;
    }

    .artist {
      font-size: 5vmin;
      margin: 0 auto 6px;
      opacity: .5;
    }

    .album {
      font-size: 4vmin;
      opacity: .5;
    }
  }

  footer {
    height: 18vh;
    display: flex;
    justify-content: space-around;
    align-items: center;
    border-top: 1px solid rgba(255, 255, 255, .1);
    font-size: 5vmin;

    a {
      color: var(--color-text-primary);

      &:active {
        opacity: .8;
      }
    }

    .favorite {
      .yep {
        color: var(--color-maroon);
      }
    }

    .prev, .next {
      font-size: 6vmin;
    }

    .play-pause {
      width: 16vmin;
      height: 16vmin;
      border: 1px solid var(--color-text-primary);
      border-radius: 50%;
      font-size: 7vmin;
      display: flex;
      place-content: center;
      place-items: center;

      &.fa-play {
        margin-left: 4px;
      }
    }
  }
}

#wrapper.standalone {
  padding-top: 20px;

  main {
    .details {
      .cover {
        width: calc(80vw - 4px);
        height: calc(80vw - 4px);
      }
    }

    .footer {
      height: 20vh;
    }
  }
}

.volume {
  position: relative;

  .icon {
    width: 20px;
    display: inline-block;
    text-align: center;
  }
}

#volumeSlider {
  height: 80px;
  position: absolute;
  bottom: calc(50% + 26px);
}

.noUi-target {
  background: var(--color-text-primary);
  border-radius: 4px;
  border: 0;
  box-shadow: none;
  left: 7px;
}

.noUi-base {
  height: calc(100% - 16px);
  border-radius: 4px;
}

.noUi-vertical {
  width: 8px;
}

.noUi-vertical .noUi-handle {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  border: 0;
  left: -12px;
  top: 0;
  background: var(--color-highlight);
  box-shadow: none;

  &::after, &::before {
    display: none;
  }
}

.noUi-connect {
  background: transparent;
  box-shadow: none;
}
</style>
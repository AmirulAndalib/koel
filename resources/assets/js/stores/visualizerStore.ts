import { visualizers } from '@/config'

export const visualizerStore = {
  get all () {
    return visualizers
  },

  getVisualizerById (id: Visualizer['id']) {
    return visualizers.find(visualizer => visualizer.id === id)
  },
}

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface MapLayer {
  id: string
  name: string
  kind: 'raster' | 'vector' | 'geojson' | 'deck'
  source: string
  visible: boolean
  opacity: number
  style?: Record<string, unknown>
}

interface MapState {
  layers: MapLayer[]
  center: [number, number]
  zoom: number
  setLayers: (layers: MapLayer[]) => void
  addLayer: (layer: MapLayer) => void
  toggleLayer: (id: string) => void
  updateLayerOpacity: (id: string, opacity: number) => void
  setCenter: (center: [number, number]) => void
  setZoom: (zoom: number) => void
}

export const useMapStore = create<MapState>()(
  persist(
    (set) => ({
      layers: [],
      center: [116.397428, 39.90923],
      zoom: 10,

      setLayers: (layers) => set({ layers }),

      addLayer: (layer) =>
        set((state) => ({
          layers: [...state.layers, layer],
        })),

      toggleLayer: (id) =>
        set((state) => ({
          layers: state.layers.map((l) =>
            l.id === id ? { ...l, visible: !l.visible } : l
          ),
        })),

      updateLayerOpacity: (id, opacity) =>
        set((state) => ({
          layers: state.layers.map((l) =>
            l.id === id ? { ...l, opacity } : l
          ),
        })),

      setCenter: (center) => set({ center }),

      setZoom: (zoom) => set({ zoom }),
    }),
    {
      name: 'geowork-map-storage',
      partialize: (state) => ({
        layers: state.layers,
        center: state.center,
        zoom: state.zoom,
      }),
    }
  )
)

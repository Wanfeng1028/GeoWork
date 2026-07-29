import { create } from 'zustand'
import { mapService } from '../../services/mapService'

export interface MapLayer {
  id: string
  name: string
  type: 'raster' | 'vector' | 'deck'
  source: string
  visible: boolean
  opacity: number
  zIndex: number
  metadata?: Record<string, any>
}

export interface MapTool {
  id: string
  name: string
  icon: string
  action: 'measure-distance' | 'measure-area' | 'annotate' | 'clip' | 'reproject' | 'merge' | 'dissolve'
}

export interface MapViewState {
  layers: MapLayer[]
  selectedLayer: MapLayer | null
  activeTool: MapTool | null
  center: [number, number]
  zoom: number
  basemap: string
  addLayer: (layer: Omit<MapLayer, 'id'>) => Promise<void>
  removeLayer: (id: string) => Promise<void>
  toggleLayer: (id: string) => void
  setLayerOpacity: (id: string, opacity: number) => void
  renameLayer: (id: string, name: string) => void
  duplicateLayer: (id: string) => void
  reorderLayers: (layerIds: string[]) => void
  setSelectedLayer: (layer: MapLayer | null) => void
  setActiveTool: (tool: MapTool | null) => void
  setBasemap: (basemap: string) => void
  setView: (center: [number, number], zoom: number) => void
}

export const AVAILABLE_TOOLS: MapTool[] = [
  { id: 'measure-distance', name: '测距', icon: '📏', action: 'measure-distance' },
  { id: 'measure-area', name: '测面', icon: '📐', action: 'measure-area' },
  { id: 'annotate', name: '标注', icon: '📝', action: 'annotate' },
  { id: 'clip', name: '裁剪', icon: '✂️', action: 'clip' },
  { id: 'reproject', name: '投影变换', icon: '🔄', action: 'reproject' },
  { id: 'merge', name: '合并', icon: '🔗', action: 'merge' },
  { id: 'dissolve', name: 'Dissolve', icon: '💧', action: 'dissolve' }
]

export const BASEMAP_OPTIONS = [
  { id: 'satellite', name: '卫星影像', url: 'https://tiles.stadiamaps.com/tiles/stadiamapssatellite/{z}/{x}/{y}@2x.jpg' },
  { id: 'streets', name: '街道地图', url: 'https://tiles.stadiamaps.com/tiles/osm_bright/{z}/{x}/{y}@2x.jpg' },
  { id: 'terrain', name: '地形图', url: 'https://tiles.stadiamaps.com/tiles/stamenterrain/{z}/{x}/{y}@2x.jpg' }
]

export const useMapViewStore = create<MapViewState>((set, get) => ({
  layers: [],
  selectedLayer: null,
  activeTool: null,
  center: [104.0, 35.0],
  zoom: 4,
  basemap: 'satellite',

  addLayer: async (layer) => {
    const newLayer = await mapService.addLayer({
      path: layer.source,
      type: layer.type
    })
    set((state) => ({
      layers: [...state.layers, { ...newLayer, ...layer, id: newLayer.id || `layer_${Date.now()}` }]
    }))
  },

  removeLayer: async (id) => {
    await mapService.removeLayer(id)
    set((state) => ({
      layers: state.layers.filter((l) => l.id !== id),
      selectedLayer: state.selectedLayer?.id === id ? null : state.selectedLayer
    }))
  },

  toggleLayer: (id) => {
    set((state) => ({
      layers: state.layers.map((l) =>
        l.id === id ? { ...l, visible: !l.visible } : l
      )
    }))
  },

  setLayerOpacity: (id, opacity) => {
    set((state) => ({
      layers: state.layers.map((l) =>
        l.id === id ? { ...l, opacity: Math.max(0, Math.min(100, opacity)) } : l
      )
    }))
  },

  renameLayer: (id, name) => {
    const trimmed = name.trim()
    if (!trimmed) return
    set((state) => ({
      layers: state.layers.map((l) => l.id === id ? { ...l, name: trimmed } : l),
      selectedLayer: state.selectedLayer?.id === id ? { ...state.selectedLayer, name: trimmed } : state.selectedLayer,
    }))
  },

  duplicateLayer: (id) => {
    set((state) => {
      const source = state.layers.find((layer) => layer.id === id)
      if (!source) return state
      const copy: MapLayer = {
        ...source,
        id: `${source.id}_copy_${Date.now()}`,
        name: `${source.name} 副本`,
        zIndex: state.layers.length,
      }
      return { layers: [...state.layers, copy] }
    })
  },

  reorderLayers: (layerIds) => {
    set((state) => {
      const sorted = layerIds
        .map((id) => state.layers.find((l) => l.id === id))
        .filter((l): l is MapLayer => l !== undefined)
      return {
        layers: sorted.map((l, i) => ({ ...l, zIndex: i }))
      }
    })
  },

  setSelectedLayer: (layer) => {
    set({ selectedLayer: layer })
  },

  setActiveTool: (tool) => {
    set({ activeTool: tool })
  },

  setBasemap: (basemap) => {
    set({ basemap })
  },

  setView: (center, zoom) => {
    set({ center, zoom })
  }
}))

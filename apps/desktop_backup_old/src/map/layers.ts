/**
 * Layer type definitions for MapLibre + Deck.gl integration.
 */

export interface MapLayerItem {
  /** Unique identifier for the layer */
  id: string
  /** Display name of the layer */
  name: string
  /** Layer rendering kind */
  kind: 'raster' | 'vector' | 'geojson' | 'deck'
  /** Source URL or identifier */
  source: string
  /** Whether the layer is currently visible */
  visible: boolean
  /** Opacity value in range [0, 1] */
  opacity: number
  /** MapLibre style configuration (for raster/vector/geojson) */
  style?: Record<string, any>
  /** Deck.gl layer instance (for deck kind) */
  deckLayer?: any
}

/**
 * GeoJSON feature with optional elevation and color attributes for Deck.gl.
 */
export interface DeckGeoJsonFeature {
  type: 'Feature'
  geometry: {
    type: 'Point' | 'LineString' | 'Polygon'
    coordinates: number[][] | number[][][] | number[][][][]
  }
  properties?: Record<string, any>
}

/**
 * Deck.gl layer configuration derived from a MapLayerItem.
 */
export interface DeckLayerConfig {
  type: 'PointLayer' | 'LineLayer' | 'PolygonLayer' | 'HeatmapLayer'
  data: DeckGeoJsonFeature[]
  getFillColor?: (d: DeckGeoJsonFeature) => [number, number, number, number]
  getStrokeColor?: (d: DeckGeoJsonFeature) => [number, number, number, number]
  getRadius?: (d: DeckGeoJsonFeature) => number
  lineWidthScale?: number
  lineJointRounded?: boolean
  radiusMinPixels?: number
  radiusMaxPixels?: number
  opacity?: number
  visible?: boolean
}

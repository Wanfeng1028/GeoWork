import { memo, useEffect, useMemo, useRef } from 'react'
import { DeckGL, PointLayer, LineLayer, PolygonLayer, HeatmapLayer } from '@deck.gl/aggregation-layers'
import { DeckGL as DeckGLCore } from '@deck.gl/react'
import type { Layer } from '@deck.gl/core'
import type MapLibreGL from 'maplibre-gl'
import type { DeckGeoJsonFeature, MapLayerItem } from './layers'

interface DeckGlOverlayProps {
  map: MapLibreGL.Map | null
  layers: MapLayerItem[]
  width: number
  height: number
}

/**
 * Deck.gl overlay that renders Deck-layer kinds on top of MapLibre GL.
 *
 * It reads the `deckLayer` property from each MapLayerItem and composes
 * a flat array of Deck.gl layers.  Supported deckLayer types are:
 *   - PointLayer, LineLayer, PolygonLayer, HeatmapLayer
 */
const DeckGlOverlay = memo(function DeckGlOverlay({
  map,
  layers,
  width,
  height,
}: DeckGlOverlayProps) {
  const deckRef = useRef<DeckGLCore | null>(null)

  const deckLayers = useMemo<Layer[]>(() => {
    const result: Layer[] = []

    for (const item of layers) {
      if (!item.visible || !item.deckLayer) continue

      const layer = item.deckLayer
      const deckType = layer.type?.name ?? layer.type

      // Build a shallow copy with visibility/opacity from the layer item
      const props: Record<string, unknown> = {
        ...layer.props,
        opacity: item.opacity,
        visible: item.visible,
      }

      switch (deckType) {
        case 'PointLayer':
          result.push(
            new PointLayer({
              id: `deck-${item.id}`,
              data: (layer.props?.data ?? []) as DeckGeoJsonFeature[],
              getFillColor: props.getFillColor ?? (() => [22, 119, 255, 180]),
              getStrokeColor: props.getStrokeColor ?? (() => [0, 0, 0, 64]),
              getRadius: props.getRadius ?? (() => 10),
              radiusMinPixels: props.radiusMinPixels ?? 2,
              radiusMaxPixels: props.radiusMaxPixels ?? 50,
              lineWidthScale: props.lineWidthScale ?? 1,
              lineWidthMinPixels: props.lineWidthMinPixels ?? 1,
              getLineWidth: props.getLineWidth ?? (() => 1),
              pickable: true,
            })
          )
          break

        case 'LineLayer':
          result.push(
            new LineLayer({
              id: `deck-${item.id}`,
              data: (layer.props?.data ?? []) as DeckGeoJsonFeature[],
              getFillColor: props.getFillColor ?? (() => [22, 119, 255, 200]),
              getStrokeColor: props.getStrokeColor ?? (() => [0, 0, 0, 64]),
              getRadius: props.getRadius ?? (() => 1),
              lineWidthScale: props.lineWidthScale ?? 1,
              lineJointRounded: props.lineJointRounded ?? true,
              lineMiterLimit: props.lineMiterLimit ?? 2,
              pickable: true,
            })
          )
          break

        case 'PolygonLayer':
          result.push(
            new PolygonLayer({
              id: `deck-${item.id}`,
              data: (layer.props?.data ?? []) as DeckGeoJsonFeature[],
              getFillColor: props.getFillColor ?? (() => [22, 119, 255, 120]),
              getStrokeColor: props.getStrokeColor ?? (() => [0, 0, 0, 100]),
              getLineWidth: props.getLineWidth ?? (() => 1),
              lineWidthMinPixels: props.lineWidthMinPixels ?? 1,
              lineWidthMaxPixels: props.lineWidthMaxPixels ?? 4,
              pickable: true,
            })
          )
          break

        case 'HeatmapLayer':
          result.push(
            new HeatmapLayer({
              id: `deck-${item.id}`,
              data: (layer.props?.data ?? []) as DeckGeoJsonFeature[],
              radiusMinPixels: props.radiusMinPixels ?? 8,
              radiusMaxPixels: props.radiusMaxPixels ?? 25,
              weight: props.weight ?? (() => 1),
              opacity: props.opacity ?? item.opacity,
              visible: props.visible ?? item.visible,
            })
          )
          break

        default:
          // Fallback: try to use the layer as-is if it's already a Deck.gl Layer instance
          if (layer instanceof require('@deck.gl/core').Layer) {
            result.push(layer)
          }
          break
      }
    }

    return result
  }, [layers])

  // Sync Deck.gl viewport with MapLibre GL camera
  const viewState = useMemo(() => {
    if (!map) return undefined
    const center = map.getCenter()
    const zoom = map.getZoom()
    const bearing = map.getBearing()
    const pitch = map.getPitch()
    return {
      longitude: center.lng,
      latitude: center.lat,
      zoom,
      bearing,
      pitch,
      transitionInterpolator: null,
    }
  }, [map])

  // Update Deck.gl viewport when MapLibre camera changes
  useEffect(() => {
    if (!map || !deckRef.current) return

    const onMove = () => {
      // Force Deck.gl to re-render by updating viewState
      deckRef.current?.props.onViewStateChange?.({
        viewState: {
          longitude: map.getCenter().lng,
          latitude: map.getCenter().lat,
          zoom: map.getZoom(),
          bearing: map.getBearing(),
          pitch: map.getPitch(),
        },
      })
    }

    map.on('move', onMove)
    map.on('rotate', onMove)
    map.on('pitch', onMove)

    return () => {
      map.off('move', onMove)
      map.off('rotate', onMove)
      map.off('pitch', onMove)
    }
  }, [map])

  if (!map || !width || !height) return null

  return (
    <DeckGLCore
      ref={deckRef}
      width={width}
      height={height}
      viewState={viewState}
      layers={deckLayers}
      getTooltip={({ object }) => {
        if (!object) return null
        const props = (object as any).properties ?? {}
        return props.name ?? props.label ?? null
      }}
      initialViewState={{
        longitude: 104.0,
        latitude: 35.0,
        zoom: 4,
      }}
      controller={{
        type: 'orbit',
        rotateSpeed: 1,
        zoomFactor: 0.5,
      }}
    />
  )
})

export default DeckGlOverlay

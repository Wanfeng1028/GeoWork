import { memo, useEffect, useMemo, useRef } from 'react'
import { DeckGL } from '@deck.gl/react'
import { Layer } from '@deck.gl/core'
import { LineLayer, PolygonLayer, ScatterplotLayer } from '@deck.gl/layers'
import { HeatmapLayer } from '@deck.gl/aggregation-layers'
import type MapLibreGL from 'maplibre-gl'
import type { MapLayerItem } from './layers'

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
  const deckRef = useRef<any>(null)

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

      const getProp = <T,>(key: string, fallback: T): T => {
        return (props[key] ?? fallback) as T
      }

      switch (deckType) {
        case 'PointLayer':
          result.push(
            new ScatterplotLayer({
              id: `deck-${item.id}`,
              data: (getProp<any[]>('data', []) as any),
              getFillColor: getProp<(p: any) => [number, number, number, number]>('getFillColor', () => [22, 119, 255, 180]),
              getLineColor: getProp<(p: any) => [number, number, number, number]>('getStrokeColor', () => [0, 0, 0, 64]),
              getRadius: getProp<(p: any) => number>('getRadius', () => 10),
              radiusMinPixels: 2,
              radiusMaxPixels: 50,
              lineWidthScale: 1,
              lineWidthMinPixels: 1,
              getLineWidth: () => 1,
              pickable: true,
            })
          )
          break

        case 'LineLayer':
          result.push(
            new LineLayer({
              id: `deck-${item.id}`,
              data: (getProp<any[]>('data', []) as any),
              getFillColor: getProp<(p: any) => [number, number, number, number]>('getFillColor', () => [22, 119, 255, 200]),
              getStrokeColor: getProp<(p: any) => [number, number, number, number]>('getStrokeColor', () => [0, 0, 0, 64]),
              getRadius: getProp<(p: any) => number>('getRadius', () => 1),
              lineWidthScale: 1,
              lineJointRounded: true,
              lineMiterLimit: 2,
              pickable: true,
            })
          )
          break

        case 'PolygonLayer':
          result.push(
            new PolygonLayer({
              id: `deck-${item.id}`,
              data: (getProp<any[]>('data', []) as any),
              getFillColor: getProp<(p: any) => [number, number, number, number]>('getFillColor', () => [22, 119, 255, 120]),
              getStrokeColor: getProp<(p: any) => [number, number, number, number]>('getStrokeColor', () => [0, 0, 0, 100]),
              getLineWidth: getProp<(p: any) => number>('getLineWidth', () => 1),
              lineWidthMinPixels: 1,
              lineWidthMaxPixels: 4,
              pickable: true,
            })
          )
          break

        case 'HeatmapLayer':
          result.push(
            new HeatmapLayer({
              id: `deck-${item.id}`,
              data: (getProp<any[]>('data', []) as any),
              radiusMinPixels: 8,
              radiusMaxPixels: 25,
              weight: () => 1,
              opacity: item.opacity,
              visible: item.visible,
            })
          )
          break

        default:
          // Fallback: try to use the layer as-is if it's already a Deck.gl Layer instance
          if (layer instanceof Layer) {
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
      longitude: center.lng as number,
      latitude: center.lat as number,
      zoom: zoom as number,
      bearing: bearing as number,
      pitch: pitch as number,
      transitionInterpolator: null,
    } as any
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
    <DeckGL
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
      } as any}
      controller={{
        rotateSpeed: 1,
        zoomFactor: 0.5,
      } as any}
    />
  )
})

export default DeckGlOverlay

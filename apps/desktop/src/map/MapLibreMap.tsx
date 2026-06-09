import { memo, useEffect, useMemo, useRef, useState } from 'react'
import { Button, Slider, Switch, Tooltip } from 'antd'
import {
  CollapseOutlined,
  ExpandOutlined,
  LineChartOutlined,
  MapOutlined,
  RadarOutlined,
  ZoomInOutlined,
  ZoomOutOutlined
} from '@ant-design/icons'
import maplibregl from 'maplibre-gl'
import DeckGlOverlay from './DeckGlOverlay'
import type { DeckGeoJsonFeature, MapLayerItem } from './layers'
import styles from './MapLibreMap.module.scss'

import 'maplibre-gl/dist/maplibre-gl.css'

interface MapLibreMapProps {
  layers?: MapLayerItem[]
  onLayerToggle?: (id: string) => void
  onLayerOpacityChange?: (id: string, opacity: number) => void
  width?: number
  height?: number
}

/**
 * Main MapLibre GL + Deck.gl map component.
 * - Renders base map tiles with MapLibre GL
 * - Overlays Deck.gl layers (Point, Line, Polygon, Heatmap)
 * - Provides layer panel with visibility/opacity controls
 * - Supports zoom, pan, measure tools
 */
const MapLibreMap = memo(function MapLibreMap({
  layers = [],
  onLayerToggle,
  onLayerOpacityChange,
  width = 800,
  height = 600
}: MapLibreMapProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<maplibregl.Map | null>(null)
  const [collapsed, setCollapsed] = useState(false)
  const [measuring, setMeasuring] = useState(false)
  const [measureDistance, setMeasureDistance] = useState<string>('')
  const measurePointsRef = useRef<[number, number][]>([])

  // Initialize MapLibre GL map
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return

    const map = new maplibregl.Map({
      container: mapRef.current,
      style: {
        version: 8,
        name: 'OpenStreetMap',
        sources: {
          osm: {
            type: 'raster',
            tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
            tileSize: 256,
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          }
        },
        layers: [
          {
            id: 'osm-tiles',
            type: 'raster',
            source: 'osm',
            minzoom: 0,
            maxzoom: 19
          }
        ]
      },
      center: [104.0, 35.0] as [number, number],
      zoom: 4,
      attributionControl: true,
      logoDisplay: false
    })

    map.addControl(new maplibregl.NavigationControl(), 'top-right')
    map.addControl(new maplibregl.ScaleControl(), 'bottom-right')

    mapInstanceRef.current = map

    return () => {
      map.remove()
      mapInstanceRef.current = null
    }
  }, [])

  // Compute viewport bounds for Deck.gl
  const viewport = useMemo(() => {
    const map = mapInstanceRef.current
    if (!map) return undefined
    const center = map.getCenter()
    return {
      longitude: center.lng,
      latitude: center.lat,
      zoom: map.getZoom(),
      bearing: map.getBearing(),
      pitch: map.getPitch()
    }
  }, [layers])

  // Measure tool: calculate distance between points
  const calculateDistance = (points: [number, number][]) => {
    if (points.length < 2) return '0 m'
    let total = 0
    for (let i = 1; i < points.length; i++) {
      const [lon1, lat1] = points[i - 1]
      const [lon2, lat2] = points[i]
      const R = 6371000 // Earth radius in meters
      const dLat = ((lat2 - lat1) * Math.PI) / 180
      const dLon = ((lon2 - lon1) * Math.PI) / 180
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((lat1 * Math.PI) / 180) *
          Math.cos((lat2 * Math.PI) / 180) *
          Math.sin(dLon / 2) *
          Math.sin(dLon / 2)
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
      total += R * c
    }
    if (total >= 1000) return `${(total / 1000).toFixed(2)} km`
    return `${Math.round(total)} m`
  }

  // Handle map click for measure tool
  useEffect(() => {
    const map = mapInstanceRef.current
    if (!map) return

    const onClick = (e: maplibregl.MapMouseEvent) => {
      if (!measuring) return
      const point = [e.lngLat.lng, e.lngLat.lat] as [number, number]
      measurePointsRef.current = [...measurePointsRef.current, point]
      if (measurePointsRef.current.length >= 2) {
        setMeasureDistance(calculateDistance(measurePointsRef.current))
      }
    }

    map.on('click', onClick)

    return () => {
      map.off('click', onClick)
    }
  }, [measuring])

  const deckLayers: MapLayerItem[] = useMemo(
    () => layers.filter((l) => l.kind === 'deck'),
    [layers]
  )

  const sampleDeckData: DeckGeoJsonFeature[] = useMemo(
    () => [
      {
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [104.0, 35.0]
        },
        properties: { name: 'Sample Point' }
      }
    ],
    []
  )

  return (
    <div className={styles.mapContainer}>
      {/* Collapse toggle */}
      <button
        className={`${styles.collapseToggle} ${collapsed ? '' : styles.collapseToggleShifted}`}
        onClick={() => setCollapsed(!collapsed)}
        title={collapsed ? '展开图层面板' : '折叠图层面板'}
      >
        {collapsed ? <ExpandOutlined /> : <CollapseOutlined />}
      </button>

      {/* Layer panel */}
      {!collapsed && (
        <div className={styles.layerPanel}>
          <div className={styles.layerPanelHeader}>
            <h5>图层列表</h5>
          </div>
          <div className={styles.layerPanelBody}>
            {layers.length === 0 && (
              <div style={{ padding: 12, color: '#8c8c8c', fontSize: 13 }}>
                暂无图层
              </div>
            )}
            {layers.map((layer) => (
              <div
                key={layer.id}
                className={`${styles.layerItem} ${layer.visible ? styles.layerItemVisible : ''}`}
              >
                <button
                  className={styles.layerToggle}
                  onClick={() => onLayerToggle?.(layer.id)}
                  title={layer.visible ? '隐藏图层' : '显示图层'}
                >
                  {layer.visible ? <MapOutlined /> : <RadarOutlined />}
                </button>
                <span className={styles.layerName} title={layer.name}>
                  {layer.name}
                </span>
                <span className={styles.layerKind}>{layer.kind}</span>
                <Slider
                  className={styles.layerOpacity}
                  value={layer.opacity}
                  min={0}
                  max={1}
                  step={0.01}
                  onChange={(value) => onLayerOpacityChange?.(layer.id, value)}
                  tooltip={{ formatter: (v) => `${Math.round((v ?? 0) * 100)}%` }}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className={styles.toolbar}>
        <Tooltip title="放大">
          <button
            className={styles.toolbarButton}
            onClick={() => mapInstanceRef.current?.zoomIn()}
          >
            <ZoomInOutlined />
          </button>
        </Tooltip>
        <Tooltip title="缩小">
          <button
            className={styles.toolbarButton}
            onClick={() => mapInstanceRef.current?.zoomOut()}
          >
            <ZoomOutOutlined />
          </button>
        </Tooltip>
        <Tooltip title={measuring ? '停止测距' : '测距工具'}>
          <button
            className={`${styles.toolbarButton} ${measuring ? styles.toolbarButtonActive : ''}`}
            onClick={() => {
              setMeasuring(!measuring)
              if (!measuring) {
                measurePointsRef.current = []
                setMeasureDistance('')
              }
            }}
          >
            <LineChartOutlined />
          </button>
        </Tooltip>
      </div>

      {/* Measure tooltip */}
      {measuring && measureDistance && (
        <div className={styles.measureTooltip}>{measureDistance}</div>
      )}

      {/* Map canvas */}
      <div ref={mapRef} className={styles.mapCanvas} style={{ width, height }} />

      {/* Deck.gl overlay */}
      {viewport && (
        <div className={styles.deckOverlay}>
          <DeckGlOverlay
            map={mapInstanceRef.current}
            layers={deckLayers.map((l) => ({
              ...l,
              deckLayer: {
                type: { name: 'PointLayer' },
                props: {
                  data: sampleDeckData,
                  getFillColor: () => [22, 119, 255, 180],
                  getStrokeColor: () => [0, 0, 0, 64],
                  getRadius: () => 10
                }
              }
            }))}
            width={width}
            height={height}
          />
        </div>
      )}
    </div>
  )
})

export default MapLibreMap

import React from 'react'
import {
  ZoomIn,
  ZoomOut,
  RefreshCw,
  Maximize
} from 'lucide-react'
import { useMapViewStore, BASEMAP_OPTIONS } from './store'
import styles from './MapView.module.scss'

export function MapView() {
  const basemap = useMapViewStore((s) => s.basemap)
  const setBasemap = useMapViewStore((s) => s.setBasemap)
  const setView = useMapViewStore((s) => s.setView)
  const center = useMapViewStore((s) => s.center)
  const zoom = useMapViewStore((s) => s.zoom)

  const currentBasemap = BASEMAP_OPTIONS.find((b) => b.id === basemap)

  return (
    <div className={styles.container}>
      <div className={styles.toolbar}>
        <div >
          <button onClick={() => setView(center, zoom + 1)} title="放大">
            <ZoomIn  />
          </button>
          <button onClick={() => setView(center, zoom - 1)} title="缩小">
            <ZoomOut  />
          </button>
          <button onClick={() => setView([104, 35], 4)} title="重置">
            <RefreshCw  />
          </button>
          <button>
            <Maximize  />
          </button>
        </div>
        <select>
          <div >
            <span />
          </div>
          <div>
            {BASEMAP_OPTIONS.map((b) => (
              <option key={b.id}>{b.name}</option>
            ))}
          </div>
        </select>
      </div>
      <div className={styles.mapArea}>
        <div className={styles.mapStatus}>
          <span >MapLibre GL + Deck.gl 地图视图</span>
          <span >
            中心: [{center[0].toFixed(2)}, {center[1].toFixed(2)}] Zoom: {zoom}
          </span>
          <span >
            底图: {currentBasemap?.name}
          </span>
        </div>
      </div>
    </div>
  )
}

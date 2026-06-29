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
          <Button size="sm" variant="outline" onClick={() => setView(center, zoom + 1)} title="放大">
            <ZoomIn  />
          </Button>
          <Button size="sm" variant="outline" onClick={() => setView(center, zoom - 1)} title="缩小">
            <ZoomOut  />
          </Button>
          <Button size="sm" variant="outline" onClick={() => setView([104, 35], 4)} title="重置">
            <RefreshCw  />
          </Button>
          <Button size="sm" variant="outline" title="全屏">
            <Maximize  />
          </Button>
        </div>
        <Select value={basemap} onValueChange={setBasemap}>
          <SelectTrigger >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {BASEMAP_OPTIONS.map((b) => (
              <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
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

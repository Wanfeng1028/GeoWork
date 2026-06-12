import React from 'react'
import { Button } from '../../components/ui/button'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../../components/ui/select'
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
        <div className="flex gap-1">
          <Button size="sm" variant="outline" onClick={() => setView(center, zoom + 1)} title="放大">
            <ZoomIn className="w-4 h-4" />
          </Button>
          <Button size="sm" variant="outline" onClick={() => setView(center, zoom - 1)} title="缩小">
            <ZoomOut className="w-4 h-4" />
          </Button>
          <Button size="sm" variant="outline" onClick={() => setView([104, 35], 4)} title="重置">
            <RefreshCw className="w-4 h-4" />
          </Button>
          <Button size="sm" variant="outline" title="全屏">
            <Maximize className="w-4 h-4" />
          </Button>
        </div>
        <Select value={basemap} onValueChange={setBasemap}>
          <SelectTrigger className="w-[140px]">
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
          <span className="text-sm text-muted-foreground">MapLibre GL + Deck.gl 地图视图</span>
          <span className="text-xs">
            中心: [{center[0].toFixed(2)}, {center[1].toFixed(2)}] Zoom: {zoom}
          </span>
          <span className="text-xs">
            底图: {currentBasemap?.name}
          </span>
        </div>
      </div>
    </div>
  )
}

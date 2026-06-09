import React from 'react'
import { Button, Select, Space, Typography } from 'antd'
import {
  ZoomInOutlined,
  ZoomOutOutlined,
  ReloadOutlined,
  FullscreenOutlined
} from '@ant-design/icons'
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
        <Space>
          <Button size="small" icon={<ZoomInOutlined />} onClick={() => setView(center, zoom + 1)} title="放大" />
          <Button size="small" icon={<ZoomOutOutlined />} onClick={() => setView(center, zoom - 1)} title="缩小" />
          <Button size="small" icon={<ReloadOutlined />} onClick={() => setView([104, 35], 4)} title="重置" />
          <Button size="small" icon={<FullscreenOutlined />} title="全屏" />
        </Space>
        <Select
          value={basemap}
          onChange={setBasemap}
          options={BASEMAP_OPTIONS.map((b) => ({ label: b.name, value: b.id }))}
          style={{ width: 140 }}
          size="small"
        />
      </div>
      <div className={styles.mapArea}>
        <div className={styles.mapStatus}>
          <Typography.Text type="secondary">MapLibre GL + Deck.gl 地图视图</Typography.Text>
          <Typography.Text style={{ fontSize: 12 }}>
            中心: [{center[0].toFixed(2)}, {center[1].toFixed(2)}] Zoom: {zoom}
          </Typography.Text>
          <Typography.Text style={{ fontSize: 12 }}>
            底图: {currentBasemap?.name}
          </Typography.Text>
        </div>
      </div>
    </div>
  )
}

import React from 'react'
import { Layout, Card, Typography } from 'antd'
import { LayerPanel } from './LayerPanel'
import { MapView } from './MapView'
import { Toolbar } from './Toolbar'
import { useMapViewStore } from './store'
import styles from './MapAndLayers.module.scss'

const { Sider, Content } = Layout

export function MapAndLayers() {
  const selectedLayer = useMapViewStore((s) => s.selectedLayer)
  const setSelectedLayer = useMapViewStore((s) => s.setSelectedLayer)

  return (
    <Layout className="map-and-layers-layout" style={{ height: '100%', overflow: 'hidden' }}>
      <Sider width={280} theme="dark" className="map-sider">
        <Card size="small" title="图层控制" style={{ margin: 8 }}>
          <LayerPanel />
        </Card>
      </Sider>
      <Layout>
        <Content style={{ position: 'relative', overflow: 'hidden' }}>
          <MapView />
        </Content>
        <Toolbar />
      </Layout>
      {selectedLayer && (
        <Sider width={260} theme="light" className="map-detail-sider">
          <Card size="small" title="图层属性">
            <Typography.Text strong>名称：</Typography.Text>
            <Typography.Text>{selectedLayer.name}</Typography.Text>
            <Typography.Text strong>类型：</Typography.Text>
            <Typography.Text>{selectedLayer.type}</Typography.Text>
            <Typography.Text strong>数据源：</Typography.Text>
            <Typography.Text copyable style={{ wordBreak: 'break-all' }}>{selectedLayer.source}</Typography.Text>
            <Typography.Text strong>透明度：</Typography.Text>
            <Typography.Text>{selectedLayer.opacity}%</Typography.Text>
            <Typography.Text strong>元数据：</Typography.Text>
            <pre style={{ fontSize: 11, maxHeight: 200, overflow: 'auto' }}>
              {JSON.stringify(selectedLayer.metadata, null, 2)}
            </pre>
          </Card>
        </Sider>
      )}
    </Layout>
  )
}

import React from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card'
import { LayerPanel } from './LayerPanel'
import { MapView } from './MapView'
import { Toolbar } from './Toolbar'
import { useMapViewStore } from './store'
import styles from './MapAndLayers.module.scss'

export function MapAndLayers() {
  const selectedLayer = useMapViewStore((s) => s.selectedLayer)
  const setSelectedLayer = useMapViewStore((s) => s.setSelectedLayer)

  return (
    <div className="flex h-full overflow-hidden">
      <div className="w-[280px] flex-shrink-0 bg-muted/50 border-r">
        <div className="p-2">
          <Card>
            <CardHeader>
              <CardTitle>图层控制</CardTitle>
            </CardHeader>
            <CardContent>
              <LayerPanel />
            </CardContent>
          </Card>
        </div>
      </div>
      <div className="flex-1 flex flex-col">
        <div className="flex-1 relative overflow-hidden">
          <MapView />
        </div>
        <Toolbar />
      </div>
      {selectedLayer && (
        <div className="w-[260px] flex-shrink-0 border-l bg-background">
          <div className="p-2">
            <Card>
              <CardHeader>
                <CardTitle>图层属性</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div><span className="font-semibold">名称：</span>{selectedLayer.name}</div>
                  <div><span className="font-semibold">类型：</span>{selectedLayer.type}</div>
                  <div><span className="font-semibold">数据源：</span><span className="break-all">{selectedLayer.source}</span></div>
                  <div><span className="font-semibold">透明度：</span>{selectedLayer.opacity}%</div>
                  <div>
                    <span className="font-semibold">元数据：</span>
                    <pre className="text-xs max-h-[200px] overflow-auto mt-1 bg-muted p-2 rounded">
                      {JSON.stringify(selectedLayer.metadata, null, 2)}
                    </pre>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  )
}

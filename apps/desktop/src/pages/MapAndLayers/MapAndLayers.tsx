import { SlidersHorizontal, Layers3, FileJson } from 'lucide-react'
import { LayerPanel } from './LayerPanel'
import { MapView } from './MapView'
import { Toolbar } from './Toolbar'
import { useMapViewStore } from './store'
import styles from './MapAndLayers.module.scss'

export function MapAndLayers() {
  const selectedLayer = useMapViewStore((s) => s.selectedLayer)

  return (
    <div className={styles.mapShell}>
      <aside className={styles.layerRail}>
        <div className={styles.panelTitle}>
          <Layers3 size={15} />
          <span>图层控制</span>
        </div>
        <LayerPanel />
      </aside>

      <main className={styles.mapStage}>
        <div className={styles.stageTopbar}>
          <div>
            <h2>地图与图层</h2>
            <p>管理、检查和处理当前工作区的空间数据。</p>
          </div>
          <div className={styles.stageActions}>
            <button>底图</button>
            <button>坐标</button>
            <button>导出</button>
          </div>
        </div>
        <div className={styles.mapCanvasWrap}>
          <MapView />
        </div>
        <Toolbar />
      </main>

      <aside className={`${styles.detailRail} ${selectedLayer ? styles.visible : ''}`}>
        <div className={styles.panelTitle}>
          <SlidersHorizontal size={15} />
          <span>图层属性</span>
        </div>
        {selectedLayer ? (
          <div className={styles.propertyCard}>
            <div className={styles.layerBadge}>{selectedLayer.type}</div>
            <h3>{selectedLayer.name}</h3>
            <dl>
              <div><dt>类型</dt><dd>{selectedLayer.type}</dd></div>
              <div><dt>透明度</dt><dd>{selectedLayer.opacity}%</dd></div>
              <div><dt>数据源</dt><dd>{selectedLayer.source}</dd></div>
            </dl>
            <div className={styles.metadataBlock}>
              <div className={styles.metadataTitle}>
                <FileJson size={14} />
                <span>元数据</span>
              </div>
              <pre>{JSON.stringify(selectedLayer.metadata, null, 2)}</pre>
            </div>
          </div>
        ) : (
          <div className={styles.emptyDetail}>选择一个图层后查看属性</div>
        )}
      </aside>
    </div>
  )
}

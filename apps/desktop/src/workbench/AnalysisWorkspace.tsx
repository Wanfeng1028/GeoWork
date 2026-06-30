// GeoWork Desktop - Analysis Mode Workspace

import { BarChart3 } from 'lucide-react'
import styles from './AnalysisWorkspace.module.scss'

export default function AnalysisWorkspace() {
  return (
    <div className={styles.analysisWorkspace}>
      <div className={styles.content}>
        <div className={styles.header}>
          <h2 ><BarChart3  /> 分析模式</h2>
          <span >栅格/矢量分析、NDVI 计算和变化检测</span>
        </div>

        <div className={styles.panels}>
          <div className={styles.mapPanel}>
            <div>
              <div>地图视图</div>
            </div>
            <div>
              <p style={{ color: '#8c97a1', fontSize: 13 }}>MapLibre + DeckGL 地图渲染区域</p>
            </div>
          </div>
          <div className={styles.panel}>
            <div>
              <div>图表分析</div>
            </div>
            <div>
              <p style={{ color: '#8c97a1', fontSize: 13 }}>统计图表和趋势分析。</p>
            </div>
          </div>
          <div className={styles.panel}>
            <div>
              <div>分析结果</div>
            </div>
            <div>
              <p style={{ color: '#8c97a1', fontSize: 13 }}>分析结果和指标展示。</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

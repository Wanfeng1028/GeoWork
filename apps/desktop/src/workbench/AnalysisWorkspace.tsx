// GeoWork Desktop - Analysis Mode Workspace

import { BarChart3 } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card'
import styles from './AnalysisWorkspace.module.scss'

export default function AnalysisWorkspace() {
  return (
    <div className={styles.analysisWorkspace}>
      <div className={styles.content}>
        <div className={styles.header}>
          <h2 className="text-lg font-semibold flex items-center gap-2"><BarChart3 className="h-5 w-5" /> 分析模式</h2>
          <span className="text-sm text-(--gw-text-tertiary)">栅格/矢量分析、NDVI 计算和变化检测</span>
        </div>

        <div className={styles.panels}>
          <Card className={styles.mapPanel}>
            <CardHeader>
              <CardTitle>地图视图</CardTitle>
            </CardHeader>
            <CardContent>
              <p style={{ color: '#8c97a1', fontSize: 13 }}>MapLibre + DeckGL 地图渲染区域</p>
            </CardContent>
          </Card>
          <Card className={styles.panel}>
            <CardHeader>
              <CardTitle>图表分析</CardTitle>
            </CardHeader>
            <CardContent>
              <p style={{ color: '#8c97a1', fontSize: 13 }}>统计图表和趋势分析。</p>
            </CardContent>
          </Card>
          <Card className={styles.panel}>
            <CardHeader>
              <CardTitle>分析结果</CardTitle>
            </CardHeader>
            <CardContent>
              <p style={{ color: '#8c97a1', fontSize: 13 }}>分析结果和指标展示。</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

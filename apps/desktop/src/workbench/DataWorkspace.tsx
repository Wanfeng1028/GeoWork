// GeoWork Desktop - Data Mode Workspace

import { Database } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card'
import styles from './DataWorkspace.module.scss'

export default function DataWorkspace() {
  return (
    <div className={styles.dataWorkspace}>
      <div className={styles.content}>
        <div className={styles.header}>
          <h2 className="text-lg font-semibold flex items-center gap-2"><Database className="h-5 w-5" /> 数据模式</h2>
          <span className="text-sm text-[var(--gw-text-tertiary)]">数据集管理、注册和元数据浏览</span>
        </div>

        <div className={styles.panels}>
          <Card className={styles.panel}>
            <CardHeader>
              <CardTitle>数据集列表</CardTitle>
            </CardHeader>
            <CardContent>
              <p style={{ color: '#8c97a1', fontSize: 13 }}>数据集列表将在此显示。前往数据中心管理数据集。</p>
            </CardContent>
          </Card>
          <Card className={styles.panel}>
            <CardHeader>
              <CardTitle>元数据详情</CardTitle>
            </CardHeader>
            <CardContent>
              <p style={{ color: '#8c97a1', fontSize: 13 }}>选择数据集查看元数据详情。</p>
            </CardContent>
          </Card>
          <Card className={styles.panel}>
            <CardHeader>
              <CardTitle>数据预览</CardTitle>
            </CardHeader>
            <CardContent>
              <p style={{ color: '#8c97a1', fontSize: 13 }}>栅格/矢量数据预览区域。</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

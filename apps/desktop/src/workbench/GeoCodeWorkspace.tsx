// GeoWork Desktop - GeoCode Mode Workspace

import { Code } from 'lucide-react'
import styles from './GeoCodeWorkspace.module.scss'

export default function GeoCodeWorkspace() {
  return (
    <div className={styles.geocodeWorkspace}>
      <div className={styles.content}>
        <div className={styles.header}>
          <h2 ><Code  /> 编码模式</h2>
          <span >地理编码、脚本生成和 GEE 集成</span>
        </div>

        <div className={styles.panels}>
          <Card className={styles.panel}>
            <CardHeader>
              <CardTitle>脚本编辑器</CardTitle>
            </CardHeader>
            <CardContent>
              <pre style={{ color: '#8c97a1', fontSize: 13, margin: 0 }}># Python 脚本编辑器</pre>
            </CardContent>
          </Card>
          <Card className={styles.panel}>
            <CardHeader>
              <CardTitle>GEE 集成</CardTitle>
            </CardHeader>
            <CardContent>
              <p style={{ color: '#8c97a1', fontSize: 13 }}>Google Earth Engine 配置和数据集选择。</p>
            </CardContent>
          </Card>
          <Card className={styles.panel}>
            <CardHeader>
              <CardTitle>终端</CardTitle>
            </CardHeader>
            <CardContent>
              <pre style={{ color: '#8c97a1', fontSize: 13, margin: 0 }}>$ 终端输出区域</pre>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

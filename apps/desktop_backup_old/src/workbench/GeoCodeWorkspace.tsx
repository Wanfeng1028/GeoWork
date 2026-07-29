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
          <div className={styles.panel}>
            <div>
              <div>脚本编辑器</div>
            </div>
            <div>
              <pre style={{ color: '#8c97a1', fontSize: 13, margin: 0 }}># Python 脚本编辑器</pre>
            </div>
          </div>
          <div className={styles.panel}>
            <div>
              <div>GEE 集成</div>
            </div>
            <div>
              <p style={{ color: '#8c97a1', fontSize: 13 }}>Google Earth Engine 配置和数据集选择。</p>
            </div>
          </div>
          <div className={styles.panel}>
            <div>
              <div>终端</div>
            </div>
            <div>
              <pre style={{ color: '#8c97a1', fontSize: 13, margin: 0 }}>$ 终端输出区域</pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

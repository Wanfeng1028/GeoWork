// GeoWork Desktop - Data Mode Workspace

import { Database } from 'lucide-react'
import styles from './DataWorkspace.module.scss'

export default function DataWorkspace() {
  return (
    <div className={styles.dataWorkspace}>
      <div className={styles.content}>
        <div className={styles.header}>
          <h2 ><Database  /> 数据模式</h2>
          <span >数据集管理、注册和元数据浏览</span>
        </div>

        <div className={styles.panels}>
          <div className={styles.panel}>
            <div>
              <div>数据集列表</div>
            </div>
            <div>
              <p style={{ color: '#8c97a1', fontSize: 13 }}>数据集列表将在此显示。前往数据中心管理数据集。</p>
            </div>
          </div>
          <div className={styles.panel}>
            <div>
              <div>元数据详情</div>
            </div>
            <div>
              <p style={{ color: '#8c97a1', fontSize: 13 }}>选择数据集查看元数据详情。</p>
            </div>
          </div>
          <div className={styles.panel}>
            <div>
              <div>数据预览</div>
            </div>
            <div>
              <p style={{ color: '#8c97a1', fontSize: 13 }}>栅格/矢量数据预览区域。</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

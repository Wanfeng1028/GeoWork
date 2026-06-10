// GeoWork OutputPanel - General output placeholder

import { Empty } from 'antd'
import styles from './OutputPanel.module.scss'

export function OutputPanel() {
  return (
    <div className={styles.panel}>
      <Empty
        description="输出面板将在 v0.3.0 中实现"
        className={styles.empty}
      />
    </div>
  )
}

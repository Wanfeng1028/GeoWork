// GeoWork LogsPanel - Log viewer placeholder

import { Empty } from 'antd'
import styles from './LogsPanel.module.scss'

export function LogsPanel() {
  return (
    <div className={styles.panel}>
      <Empty
        description="日志查看功能将在 v0.3.0 中实现"
        className={styles.empty}
      />
    </div>
  )
}

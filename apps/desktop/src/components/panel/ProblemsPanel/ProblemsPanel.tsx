// GeoWork ProblemsPanel - Problems/warnings placeholder

import { Empty } from 'antd'
import styles from './ProblemsPanel.module.scss'

export function ProblemsPanel() {
  return (
    <div className={styles.panel}>
      <Empty
        description="问题面板将在 v0.3.0 中实现"
        className={styles.empty}
      />
    </div>
  )
}

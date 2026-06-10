// GeoWork BrowserPanel - Browser bridge placeholder

import { Empty } from 'antd'
import styles from './BrowserPanel.module.scss'

export function BrowserPanel() {
  return (
    <div className={styles.panel}>
      <Empty
        description="浏览器桥接功能将在 v0.3.0 中实现"
        className={styles.empty}
      />
    </div>
  )
}

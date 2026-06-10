// GeoWork TopBar

import { Tag, Typography } from 'antd'
import { CheckCircleOutlined } from '@ant-design/icons'
import useShellStore from '../../../stores/shellStore'
import styles from './TopBar.module.scss'

const modes = ['Research', 'Data', 'GeoCode', 'Analysis', 'Write']

export function TopBar() {
  const { activeMode, setActiveMode } = useShellStore()

  return (
    <header className={styles.topbar}>
      <div className={styles.left}>
        <Typography.Title level={4} className={styles.title}>GeoWork</Typography.Title>
        <span className={styles.subtitle}>地理遥感科研工程 Agent 工作台</span>
      </div>
      
      <div className={styles.center}>
        {modes.map((mode) => (
          <Tag
            key={mode}
            color={activeMode === mode.toLowerCase().replace('code', 'code') ? 'blue' : 'default'}
            className={styles.modeTag}
            onClick={() => setActiveMode(mode.toLowerCase() as any)}
            style={{ cursor: 'pointer' }}
          >
            {mode}
          </Tag>
        ))}
      </div>
      
      <div className={styles.right}>
        <Tag icon={<CheckCircleOutlined />} color="green">
          Ready
        </Tag>
      </div>
    </header>
  )
}

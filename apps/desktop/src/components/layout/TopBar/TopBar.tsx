// GeoWork TopBar - Enhanced with search, notifications, settings

import { Tag, Typography, Input, Badge, Dropdown, Space } from 'antd'
import {
  CheckCircleOutlined,
  SearchOutlined,
  BellOutlined,
  SettingOutlined,
  MenuOutlined,
} from '@ant-design/icons'
import useShellStore from '../../../stores/shellStore'
import styles from './TopBar.module.scss'

const modes = ['Research', 'Data', 'GeoCode', 'Analysis', 'Write']

export function TopBar() {
  const { activeMode, setActiveMode, setActiveNavKey, toggleSidebar } = useShellStore()

  const settingsMenu = {
    items: [
      { key: 'settings', label: '⚙️ 设置', icon: <SettingOutlined /> },
      { key: 'workspaces', label: '📂 工作空间', icon: <MenuOutlined /> },
      { key: 'about', label: 'ℹ️ 关于 GeoWork', icon: null },
    ],
    onClick: ({ key }: { key: string }) => {
      if (key === 'settings') {
        setActiveNavKey('settings')
      }
    },
  }

  return (
    <header className={styles.topbar}>
      <div className={styles.left}>
        <button className={styles.menuBtn} onClick={toggleSidebar}>
          <MenuOutlined />
        </button>
        <Typography.Title level={4} className={styles.title}>GeoWork</Typography.Title>
      </div>

      <div className={styles.center}>
        <Input
          prefix={<SearchOutlined />}
          placeholder="全局搜索 (Ctrl+P)"
          className={styles.searchInput}
          size="small"
        />
        <div className={styles.modeDivider} />
        <div className={styles.modeTags}>
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
      </div>

      <div className={styles.right}>
        <Badge count={0} size="small">
          <button className={styles.iconBtn}>
            <BellOutlined />
          </button>
        </Badge>
        <Dropdown menu={settingsMenu} placement="bottomRight">
          <button className={styles.iconBtn}>
            <SettingOutlined />
          </button>
        </Dropdown>
        <Tag icon={<CheckCircleOutlined />} color="green" className={styles.statusTag}>
          Ready
        </Tag>
      </div>
    </header>
  )
}

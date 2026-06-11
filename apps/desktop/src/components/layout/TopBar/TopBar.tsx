// GeoWork TopBar

import { useEffect } from 'react'
import { Badge, Dropdown, Input, List, Modal, Tag, Typography } from 'antd'
import {
  BellOutlined,
  CheckCircleOutlined,
  MenuOutlined,
  SearchOutlined,
  SettingOutlined,
} from '@ant-design/icons'
import useShellStore from '../../../stores/shellStore'
import { commandPaletteActions, runAction } from '../../../services/actionRegistry'
import styles from './TopBar.module.scss'

const modes = ['Research', 'Data', 'GeoCode', 'Analysis', 'Write']

export function TopBar() {
  const {
    activeMode,
    setActiveMode,
    commandPaletteOpen,
    setCommandPaletteOpen
  } = useShellStore()

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'p') {
        event.preventDefault()
        runAction('openCommandPalette')
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const settingsMenu = {
    items: [
      { key: 'settings', label: '设置', icon: <SettingOutlined /> },
      { key: 'workspaces', label: '工作空间', icon: <MenuOutlined /> },
      { key: 'about', label: '关于 GeoWork' },
    ],
    onClick: ({ key }: { key: string }) => {
      if (key === 'settings') {
        runAction('openSettings')
      } else {
        runAction('switchMainModule', key)
      }
    },
  }

  return (
    <header className={styles.topbar}>
      <div className={styles.left}>
        <button className={styles.menuBtn} onClick={() => runAction('toggleSidebar')} title="折叠侧栏">
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
          readOnly
          onFocus={() => runAction('openCommandPalette')}
        />
        <div className={styles.modeDivider} />
        <div className={styles.modeTags}>
          {modes.map((mode) => (
            <Tag
              key={mode}
              color={activeMode === mode.toLowerCase() ? 'blue' : 'default'}
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
          <button className={styles.iconBtn} onClick={() => runAction('openBottomDock', 'events')} title="事件">
            <BellOutlined />
          </button>
        </Badge>
        <Dropdown menu={settingsMenu} placement="bottomRight">
          <button className={styles.iconBtn} title="设置">
            <SettingOutlined />
          </button>
        </Dropdown>
        <Tag icon={<CheckCircleOutlined />} color="green" className={styles.statusTag}>
          Ready
        </Tag>
      </div>

      <Modal
        title="命令面板"
        open={commandPaletteOpen}
        onCancel={() => setCommandPaletteOpen(false)}
        footer={null}
        width={520}
        destroyOnHidden
      >
        <List
          dataSource={commandPaletteActions}
          renderItem={(action) => (
            <List.Item
              className={styles.commandItem}
              onClick={() => {
                setCommandPaletteOpen(false)
                if (action.id === 'openBottomDock') {
                  runAction(action.id, 'terminal')
                } else if (action.id === 'openRightDock') {
                  runAction(action.id, 'task')
                } else {
                  runAction(action.id)
                }
              }}
            >
              <List.Item.Meta
                title={action.label}
                description={action.status === 'dev' ? action.fallbackMessage : '可用'}
              />
            </List.Item>
          )}
        />
      </Modal>
    </header>
  )
}

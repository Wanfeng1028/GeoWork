import type { ReactNode } from 'react'
import { Button, Tooltip, theme } from 'antd'
// TODO: Replace @ant-design/icons with lucide-react (Plus, Home, Clock, ListChecks, Smartphone, Settings, Sun, Moon)
import styles from './IconRail.module.css'

export interface IconRailItem {
  key: string
  icon: ReactNode
  label: string
}

export interface IconRailBottomItem {
  key: string
  icon: ReactNode
  label: string
  onClick: () => void
}

interface IconRailProps {
  items: IconRailItem[]
  activeKey: string
  onNavigate: (key: string) => void
  bottomItems?: IconRailBottomItem[]
  onCreateTask: () => void
}

export function IconRail({
  items,
  activeKey,
  onNavigate,
  bottomItems = [],
  onCreateTask,
}: IconRailProps) {
  const { token } = theme.useToken()

  return (
    <nav
      className={styles.rail}
      style={{
        background: token.colorBgContainer,
        borderRight: `1px solid ${token.colorBorderSecondary}`,
      }}
    >
      <Tooltip title="新任务" placement="right">
        <Button
          type="primary"
          icon={<PlusOutlined />}
          className={styles.createBtn}
          onClick={onCreateTask}
        />
      </Tooltip>

      <div className={styles.navList}>
        {items.map((item) => {
          const isActive = item.key === activeKey
          return (
            <Tooltip key={item.key} title={item.label} placement="right">
              <Button
                type={isActive ? 'primary' : 'text'}
                icon={item.icon}
                className={styles.navBtn}
                onClick={() => onNavigate(item.key)}
              />
            </Tooltip>
          )
        })}
      </div>

      <div className={styles.spacer} />

      <div className={styles.bottomList}>
        {bottomItems.map((item) => (
          <Tooltip key={item.key} title={item.label} placement="right">
            <Button
              type="text"
              icon={item.icon}
              className={styles.navBtn}
              onClick={item.onClick}
            />
          </Tooltip>
        ))}
      </div>
    </nav>
  )
}
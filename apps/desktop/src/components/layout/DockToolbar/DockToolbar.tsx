// GeoWork - DockToolbar Component
// Reusable toolbar for dock panel footers with icon + label buttons

import React from 'react'
import classNames from 'classnames'
import styles from './DockToolbar.module.scss'
import { Tooltip } from 'antd'
import {
  SaveOutlined,
  ReloadOutlined,
  SettingOutlined,
  ShareAltOutlined,
} from '@ant-design/icons'

export interface DockToolbarItem {
  icon: React.ReactNode
  label: string
  onClick?: () => void
  active?: boolean
  disabled?: boolean
}

export interface DockToolbarProps {
  items?: DockToolbarItem[]
  className?: string
}

const DEFAULT_ITEMS: DockToolbarItem[] = [
  {
    icon: <SaveOutlined />,
    label: '保存',
  },
  {
    icon: <ReloadOutlined />,
    label: '刷新',
  },
  {
    icon: <SettingOutlined />,
    label: '设置',
  },
  {
    icon: <ShareAltOutlined />,
    label: '分享',
  },
]

export const DockToolbar: React.FC<DockToolbarProps> = ({ items, className }) => {
  const displayItems = items && items.length > 0 ? items : DEFAULT_ITEMS

  return (
    <div className={classNames(styles.toolbar, className)}>
      {displayItems.map((item, index) => (
        <Tooltip title={item.label} key={index}>
          <button
            className={classNames(styles.item, {
              [styles.active]: item.active,
              [styles.disabled]: item.disabled,
            })}
            onClick={item.onClick}
            disabled={item.disabled}
            type="button"
          >
            <span className={styles.icon}>{item.icon}</span>
            <span className={styles.label}>{item.label}</span>
          </button>
        </Tooltip>
      ))}
    </div>
  )
}

export default DockToolbar

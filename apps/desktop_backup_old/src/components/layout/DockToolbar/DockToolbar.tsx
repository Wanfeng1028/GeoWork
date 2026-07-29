// GeoWork - DockToolbar Component
// Reusable toolbar for dock panel footers with icon + label buttons

import React from 'react'
import { Save, RotateCw, Settings, Share2 } from 'lucide-react'
import styles from './DockToolbar.module.scss'

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
  { icon: <Save size={14} />, label: '保存' },
  { icon: <RotateCw size={14} />, label: '刷新' },
  { icon: <Settings size={14} />, label: '设置' },
  { icon: <Share2 size={14} />, label: '分享' },
]

function classNames(...classes: (string | boolean | undefined | null | Record<string, boolean | undefined | null>)[]): string {
  return classes.flatMap((c) => {
    if (typeof c === 'boolean' || c == null) return []
    if (typeof c === 'string') return [c]
    return Object.entries(c)
      .filter(([, v]) => v)
      .map(([k]) => k)
  }).join(' ')
}

export const DockToolbar: React.FC<DockToolbarProps> = ({ items, className }) => {
  const displayItems = items && items.length > 0 ? items : DEFAULT_ITEMS

  return (
    <div className={classNames(styles.toolbar, className)}>
      {displayItems.map((item, index) => (
        <button
          key={index}
          className={classNames(styles.item, {
            [styles.active]: item.active,
            [styles.disabled]: item.disabled,
          })}
          onClick={item.onClick}
          disabled={item.disabled}
          type="button"
          title={item.label}
        >
          <span className={styles.icon}>{item.icon}</span>
          <span className={styles.label}>{item.label}</span>
        </button>
      ))}
    </div>
  )
}

export default DockToolbar

// GeoWork - GwTabs Component
// Tabbed interface with multiple activation styles

import React, { useState } from 'react'
import classNames from 'classnames'
import styles from './GwTabs.module.scss'

export type GwTabsSize = 'small' | 'default' | 'large'
export type GwTabsTabType = 'line' | 'card' | 'segmented'

export interface GwTabsProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: GwTabsSize
  tabType?: GwTabsTabType
  activeKey: string
  onChange?: (key: string) => void
  items?: TabItem[]
  centered?: boolean
}

export interface TabItem {
  key: string
  label: React.ReactNode
  disabled?: boolean
  icon?: React.ReactNode
  badge?: number
  badgeColor?: string
  children?: React.ReactNode
}

const sizeClasses: Record<GwTabsSize, string> = {
  small: styles.small,
  default: styles.default,
  large: styles.large,
}

const tabTypeClasses: Record<GwTabsTabType, string> = {
  line: styles.line,
  card: styles.card,
  segmented: styles.segmented,
}

export const GwTabs: React.FC<GwTabsProps> = ({
  size = 'default',
  tabType = 'line',
  activeKey,
  onChange,
  items = [],
  centered = false,
  children,
  className,
  ...rest
}) => {
  const handleTabClick = (key: string) => {
    const item = items.find(i => i.key === key)
    if (item?.disabled) return
    onChange?.(key)
  }

  return (
    <div
      className={classNames(styles.tabs, sizeClasses[size], tabTypeClasses[tabType], { [styles.centered]: centered }, className)}
      {...rest}
    >
      <div className={styles.tabList}>
        {items.map((item) => {
          const isActive = item.key === activeKey
          return (
            <button
              key={item.key}
              className={classNames(styles.tabItem, { [styles.active]: isActive, [styles.disabled]: item.disabled })}
              onClick={() => handleTabClick(item.key)}
              disabled={item.disabled}
            >
              {item.icon && <span className={styles.tabIcon}>{item.icon}</span>}
              <span className={styles.tabLabel}>{item.label}</span>
              {item.badge !== undefined && (
                <span
                  className={styles.badge}
                  style={{ background: item.badgeColor }}
                >
                  {item.badge > 99 ? '99+' : item.badge}
                </span>
              )}
            </button>
          )
        })}
      </div>
      <div className={styles.tabContent}>
        {children || items.find(i => i.key === activeKey)?.children}
      </div>
    </div>
  )
}

export default GwTabs

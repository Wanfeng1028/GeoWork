// GeoWork LeftSidebar

import { navigationGroups, bottomTabs, userCard } from '../../../mocks/navigation.mock'
import useShellStore from '../../../stores/shellStore'
import { useState } from 'react'
import styles from './LeftSidebar.module.scss'

interface LeftSidebarProps {
  collapsed?: boolean
}

export function LeftSidebar({ collapsed = false }: LeftSidebarProps) {
  const { activeNavKey, setActiveNavKey } = useShellStore()
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    agent: true,
    extensions: true,
    knowledge: true,
    geo: true
  })

  const toggleGroup = (key: string) => {
    setExpandedGroups((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  if (collapsed) {
    return (
      <aside className={styles.sidebarCollapsed}>
        <div className={styles.collapsedIcon}>GW</div>
      </aside>
    )
  }

  return (
    <aside className={styles.sidebar}>
      <button className={styles.newTaskBtn}>+ 新建任务</button>
      
      <div className={styles.tabs}>
        {bottomTabs.map((tab) => (
          <button key={tab.key} className={styles.tab}>
            {tab.label}
          </button>
        ))}
      </div>
      
      <nav className={styles.navigation}>
        {navigationGroups.map((group) => (
          <div key={group.key} className={styles.navGroup}>
            <button 
              className={styles.groupHeader}
              onClick={() => toggleGroup(group.key)}
            >
              <span className={styles.groupLabel}>{group.label}</span>
              <span className={styles.groupArrow}>
                {expandedGroups[group.key] ? '▾' : '▸'}
              </span>
            </button>
            
            {expandedGroups[group.key] && (
              <div className={styles.groupItems}>
                {group.items.map((item) => (
                  <button
                    key={item.key}
                    className={`${styles.navItem} ${activeNavKey === item.key ? styles.activeNavItem : ''}`}
                    onClick={() => setActiveNavKey(item.key)}
                  >
                    <span className={styles.navIcon}>{item.icon}</span>
                    <span className={styles.navLabel}>{item.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </nav>
      
      <div className={styles.userCard}>
        <span className={styles.userAvatar}>{userCard.avatar}</span>
        <div className={styles.userInfo}>
          <div className={styles.userNickname}>{userCard.nickname}</div>
          <div className={styles.userSubscription}>{userCard.subscription}</div>
        </div>
        <button 
          className={styles.settingsBtn}
          onClick={() => setActiveNavKey(userCard.settingsKey)}
        >
          ⚙️
        </button>
      </div>
    </aside>
  )
}

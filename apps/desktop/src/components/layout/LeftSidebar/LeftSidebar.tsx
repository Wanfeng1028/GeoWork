// GeoWork LeftSidebar

import type { ReactNode } from 'react'
import {
  Plug,
  LayoutGrid,
  Bell,
  BookOpen,
  Calendar,
  Cloud,
  Compass,
  FileSearch,
  FolderOpen,
  Home,
  PanelLeftClose,
  PanelLeftOpen,
  MessageSquare,
  Plus,
  Bot,
  Clock,
  Settings,
  Share2,
  Wrench,
  User,
} from 'lucide-react'
import useShellStore from '../../../stores/shellStore'
import { runAction } from '../../../services/actionRegistry'
import styles from './LeftSidebar.module.scss'

interface LeftSidebarProps {
  collapsed?: boolean
}

type NavTuple = [string, string, ReactNode]

export function LeftSidebar({ collapsed = false }: LeftSidebarProps) {
  const { activeNavKey, toggleSidebar } = useShellStore()

  const openNav = (key: string) => {
    runAction('switchMainModule', key)
  }

  return (
    <aside className={`${styles.sidebar} ${collapsed ? styles.collapsed : ''}`}>
      <div className={styles.brandRow}>
        <button className={styles.brandMark} onClick={() => openNav('workbench')} aria-label="GeoWork">
          <Compass size={20} />
        </button>
        {!collapsed && <span className={styles.brandText}>GeoWork</span>}
        <button className={styles.collapseBtn} onClick={toggleSidebar} aria-label="折叠侧栏">
          {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
        </button>
      </div>

      <button className={styles.newTaskBtn} onClick={() => openNav('workbench')} title="新建任务">
        <Plus size={16} />
        {!collapsed && <span>新建任务</span>}
      </button>

      <nav className={styles.navigation}>
        <NavSection collapsed={collapsed} label="主能力" items={[
          ['expert', '专家系统', <Bot size={16} />],
          ['assistant', '助理系统', <User size={16} />],
          ['automation', '自动化', <Clock size={16} />],
          ['skills', '技能', <Wrench size={16} />],
          ['extensions', '扩展 / 插件', <LayoutGrid size={16} />],
          ['mcp', 'MCP', <Plug size={16} />],
          ['scheduler', '定时任务', <Calendar size={16} />],
        ]} activeKey={activeNavKey} onOpen={openNav} />

        <NavSection collapsed={collapsed} label="知识资料" items={[
          ['files', '文件系统', <FolderOpen size={16} />],
          ['papers', '论文检索', <FileSearch size={16} />],
          ['knowledge', '知识库', <BookOpen size={16} />],
        ]} activeKey={activeNavKey} onOpen={openNav} />

        <NavSection collapsed={collapsed} label="地理空间" items={[
          ['map', '地图与图层', <Share2 size={16} />],
          ['gee', 'GEE 平台', <Cloud size={16} />],
        ]} activeKey={activeNavKey} onOpen={openNav} />

        <NavSection collapsed={collapsed} label="任务 / 频道" items={[
          ['tasks', '任务', <Home size={16} />],
          ['channels', '频道', <MessageSquare size={16} />],
          ['messaging', '消息入口', <Bell size={16} />],
        ]} activeKey={activeNavKey} onOpen={openNav} />
      </nav>

      <div className={styles.userCard}>
        <span className={styles.userAvatar}><User size={16} /></span>
        {!collapsed && (
          <div className={styles.userInfo}>
            <div className={styles.userNickname}>GeoWork User</div>
            <div className={styles.userSubscription}>Free</div>
          </div>
        )}
        <button className={styles.settingsBtn} onClick={() => openNav('settings')} title="设置">
          <Settings size={16} />
        </button>
      </div>
    </aside>
  )
}

function NavSection({
  label,
  items,
  activeKey,
  collapsed,
  onOpen,
}: {
  label: string
  items: NavTuple[]
  activeKey: string
  collapsed: boolean
  onOpen: (key: string) => void
}) {
  return (
    <div className={styles.navGroup}>
      {!collapsed && <div className={styles.groupHeader}>{label}</div>}
      <div className={styles.groupItems}>
        {items.map(([key, itemLabel, icon]) => (
          <button
            key={key}
            title={itemLabel}
            className={`${styles.navItem} ${activeKey === key ? styles.activeNavItem : ''}`}
            onClick={() => onOpen(key)}
          >
            <span className={styles.navIcon}>{icon}</span>
            {!collapsed && <span className={styles.navLabel}>{itemLabel}</span>}
          </button>
        ))}
      </div>
    </div>
  )
}

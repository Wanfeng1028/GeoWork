// GeoWork LeftSidebar

import type { ReactNode } from 'react'
import {
  ApiOutlined,
  AppstoreOutlined,
  BellOutlined,
  BookOutlined,
  CalendarOutlined,
  CloudOutlined,
  CompassOutlined,
  FileSearchOutlined,
  FolderOpenOutlined,
  HomeOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  MessageOutlined,
  PlusOutlined,
  RobotOutlined,
  ScheduleOutlined,
  SettingOutlined,
  ShareAltOutlined,
  ToolOutlined,
  UserOutlined,
} from '@ant-design/icons'
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
          <CompassOutlined />
        </button>
        {!collapsed && <span className={styles.brandText}>GeoWork</span>}
        <button className={styles.collapseBtn} onClick={toggleSidebar} aria-label="折叠侧栏">
          {collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
        </button>
      </div>

      <button className={styles.newTaskBtn} onClick={() => openNav('workbench')} title="新建任务">
        <PlusOutlined />
        {!collapsed && <span>新建任务</span>}
      </button>

      <nav className={styles.navigation}>
        <NavSection collapsed={collapsed} label="主能力" items={[
          ['expert', '专家系统', <RobotOutlined />],
          ['assistant', '助理系统', <UserOutlined />],
          ['automation', '自动化', <ScheduleOutlined />],
          ['skills', '技能', <ToolOutlined />],
          ['extensions', '扩展 / 插件', <AppstoreOutlined />],
          ['mcp', 'MCP', <ApiOutlined />],
          ['scheduler', '定时任务', <CalendarOutlined />],
        ]} activeKey={activeNavKey} onOpen={openNav} />

        <NavSection collapsed={collapsed} label="知识资料" items={[
          ['files', '文件系统', <FolderOpenOutlined />],
          ['papers', '论文检索', <FileSearchOutlined />],
          ['knowledge', '知识库', <BookOutlined />],
        ]} activeKey={activeNavKey} onOpen={openNav} />

        <NavSection collapsed={collapsed} label="地理空间" items={[
          ['map', '地图与图层', <ShareAltOutlined />],
          ['gee', 'GEE 平台', <CloudOutlined />],
        ]} activeKey={activeNavKey} onOpen={openNav} />

        <NavSection collapsed={collapsed} label="任务 / 频道" items={[
          ['tasks', '任务', <HomeOutlined />],
          ['channels', '频道', <MessageOutlined />],
          ['messaging', '消息入口', <BellOutlined />],
        ]} activeKey={activeNavKey} onOpen={openNav} />
      </nav>

      <div className={styles.userCard}>
        <span className={styles.userAvatar}><UserOutlined /></span>
        {!collapsed && (
          <div className={styles.userInfo}>
            <div className={styles.userNickname}>GeoWork User</div>
            <div className={styles.userSubscription}>Free</div>
          </div>
        )}
        <button className={styles.settingsBtn} onClick={() => openNav('settings')} title="设置">
          <SettingOutlined />
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

import type { ReactNode } from 'react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  App,
  BorderBeam,
  Button,
  Divider,
  Dropdown,
  Empty,
  Input,
  Menu,
  Modal,
  Space,
  Tooltip,
  Typography,
  theme,
} from 'antd'
import {
  Plus,
  LayoutGrid,
  Clock,
  List,
  Smartphone,
  Sun,
  Moon,
  Monitor,
  Settings,
  Check,
  ChevronDown,
  ChevronRight,
  UserCog,
  Wrench,
  Cable,
  Link,
  Folder,
  MoreHorizontal,
  Pin,
  Pencil,
  Upload,
  Inbox,
} from 'lucide-react'
import { Outlet, useLocation, useNavigate, useSearchParams } from 'react-router'
import { useAppearanceStore } from '../shared/stores/appearanceStore'
import type { Appearance } from '../shared/stores/appearanceStore'
import { useTaskStore } from '../shared/stores/taskStore'
import type { SidebarTaskItem } from '../shared/stores/taskStore'
import { useSession } from '../shared/session/react'
import { readConversation, writeConversation } from '../shared/session/conversationCache'
import { ErrorBoundary } from '../shell/feedback'
import { ShortcutsModal } from './ShortcutsModal'
import { FeedbackModal } from './FeedbackModal'
import { UsageModal } from './UsageModal'
import { UserMenu } from './UserMenu'
import { GlobalSearchModal } from './GlobalSearchModal'
import { RightWorkspacePanel } from './RightWorkspacePanel'
import { TitleBar } from './TitleBar'
import { CapsuleButton } from './components/CapsuleButton'
import { CapsuleTabs } from './components/CapsuleTabs'
import { CapsuleTag } from './components/CapsuleTag'
import styles from './AppShell.module.css'

type SidebarSegment = 'tasks' | 'channels'

const { Text } = Typography

/* ── 主功能入口数据 ── */
const navItems = [
  { key: '/new-task', icon: <Plus />, label: '新任务' },
  { key: '/tasks', icon: <Clock />, label: '定时任务' },
  { key: '/mobile-control', icon: <Smartphone />, label: '移动端控制' },
]

/* 路由 → 已在当前页时的提示文案 */
const alreadyHereMap: Record<string, string> = {
  '/new-task': '当前已在新任务页面',
  '/tasks': '当前已在任务页面',
  '/agent-studio': '当前已在 Agent Studio',
  '/mobile-control': '当前已在移动端控制页面',
  '/data-center': '当前已在数据中心',
  '/settings': '当前已在设置页面',
}

/* 扩展子项数据 */
const extChildren = [
  { key: 'experts', label: '专家', icon: <UserCog />, route: '/extensions/experts' },
  { key: 'skills', label: '技能', icon: <Wrench />, route: '/extensions/skills' },
  { key: 'mcp', label: 'MCP', icon: <Cable />, route: '/extensions/mcp' },
  { key: 'connectors', label: '连接器', icon: <Link />, route: '/extensions/connectors' },
]

const extRoutes = extChildren.map((c) => c.route)

export function AppShell() {
  const navigate = useNavigate()
  const location = useLocation()
  const { appearance, setAppearance } = useAppearanceStore()
  const { token } = theme.useToken()
  const { message } = App.useApp()

  /* 侧栏 Tab 直接由路由派生，杜绝状态不同步 */
  const segment: SidebarSegment = location.pathname === '/mobile-control' ? 'channels' : 'tasks'
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [modalOpen, setModalOpen] = useState<'usage' | 'shortcuts' | 'feedback' | null>(null)
  const [extOpen, setExtOpen] = useState(false)
  const [extHeaderHover, setExtHeaderHover] = useState(false)
  const [globalSearchOpen, setGlobalSearchOpen] = useState(false)
  /* 侧栏任务：zustand 单一真相源（CustomEvent 通知已删除） */
  const sidebarTasks = useTaskStore((s) => s.tasks)
  const workspaceMeta = useTaskStore((s) => s.workspaces)
  const refreshFromCore = useTaskStore((s) => s.refreshFromCore)
  const updateTaskLocal = useTaskStore((s) => s.updateLocal)
  const archiveTasksByWorkspace = useTaskStore((s) => s.archiveByWorkspace)
  const upsertWorkspaceMeta = useTaskStore((s) => s.upsertWorkspace)
  const upsertTaskLocal = useTaskStore((s) => s.upsertLocal)
  const [searchParams] = useSearchParams()
  const activeConvId = searchParams.get('conversationId')

  /* ── 重命名弹窗状态 ─ */
  const [renameModalOpen, setRenameModalOpen] = useState(false)
  const [renameTargetId, setRenameTargetId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')

  /* ── 右侧面板宽度拖拽 ── */
  const RW_WIDTH_LS = 'geowork.rightWorkspace.width'
  const RW_COLLAPSED_LS = 'geowork.rightWorkspace.collapsed'
  const RW_DEFAULT_WIDTH = 380
  const RW_MIN_WIDTH = 320
  const RW_MAX_WIDTH = 960

  function safeReadWidth(key: string, fallback: number): number {
    try {
      const v = localStorage.getItem(key)
      if (v === null) return fallback
      const n = Number(v)
      if (!Number.isFinite(n) || n < RW_MIN_WIDTH || n > RW_MAX_WIDTH) return fallback
      return n
    } catch {
      return fallback
    }
  }

  const [rightPanelWidth, setRightPanelWidth] = useState(() =>
    safeReadWidth(RW_WIDTH_LS, RW_DEFAULT_WIDTH),
  )
  const [rightWorkspaceCollapsed, setRightWorkspaceCollapsed] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(RW_COLLAPSED_LS) ?? 'false') === true
    } catch {
      return false
    }
  })
  const [isDragging, setIsDragging] = useState(false)

  const rootRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const isDraggingRef = useRef(false)
  const rootRectRef = useRef<DOMRect | null>(null)

  const handleDragStart = useCallback((e: React.PointerEvent) => {
    e.preventDefault()
    isDraggingRef.current = true
    setIsDragging(true)
    rootRectRef.current = rootRef.current?.getBoundingClientRect() ?? null
  }, [])

  useEffect(() => {
    if (!isDragging) return

    const onMove = (e: PointerEvent) => {
      if (!isDraggingRef.current) return
      const rect = rootRectRef.current
      const containerRight = rect ? rect.right : window.innerWidth
      const rawWidth = containerRight - e.clientX
      const maxWidth = Math.min(RW_MAX_WIDTH, window.innerWidth * 0.65)
      const newWidth = Math.min(Math.max(rawWidth, RW_MIN_WIDTH), maxWidth)
      if (panelRef.current) {
        panelRef.current.style.width = `${newWidth}px`
        panelRef.current.style.flexBasis = `${newWidth}px`
      }
    }

    const onUp = () => {
      if (!isDraggingRef.current) return
      isDraggingRef.current = false
      setIsDragging(false)
      if (panelRef.current) {
        const w = parseInt(panelRef.current.style.width, 10)
        if (Number.isFinite(w)) {
          setRightPanelWidth(w)
          localStorage.setItem(RW_WIDTH_LS, String(w))
        }
      }
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }

    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)

    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [isDragging])

  /* ── 右侧面板折叠持久化 ── */
  useEffect(() => {
    localStorage.setItem(RW_COLLAPSED_LS, JSON.stringify(rightWorkspaceCollapsed))
  }, [rightWorkspaceCollapsed])

  /* ── 侧栏任务同步：启动拉 Core，跨标签页 storage 事件回填 ── */
  useEffect(() => {
    void refreshFromCore()
    const hydrate = () => useTaskStore.getState().hydrate()
    window.addEventListener('storage', hydrate)
    return () => {
      window.removeEventListener('storage', hydrate)
    }
  }, [refreshFromCore])

  /* ── 当前会话状态 → 侧栏任务（替代原 NewTaskPage 内的同步 effect） ── */
  const activeSnap = useSession(activeConvId)
  useEffect(() => {
    if (!activeConvId) return
    const messages = activeSnap.messages
    const last = messages.at(-1)
    if (!last) return
    let sidebarStatus: SidebarTaskItem['status'] = 'idle'
    if (
      activeSnap.runStatus === 'thinking' ||
      activeSnap.runStatus === 'planning' ||
      activeSnap.runStatus === 'running'
    ) {
      sidebarStatus = 'streaming'
    } else if (activeSnap.runStatus === 'completed') {
      sidebarStatus = 'completed'
    } else if (activeSnap.runStatus === 'stopped') {
      sidebarStatus = 'stopped'
    } else if (activeSnap.runStatus === 'failed') {
      sidebarStatus = 'failed'
    } else {
      return
    }
    const existing = useTaskStore.getState().tasks.find((t) => t.id === activeConvId)
    upsertTaskLocal({
      id: activeConvId,
      title: existing?.title ?? activeSnap.title,
      lastMessage: last.content.slice(0, 50),
      status: sidebarStatus,
      updatedAt: Date.now(),
      workspaceId: existing?.workspaceId ?? 'default',
      workspaceName: existing?.workspaceName ?? '默认',
      workDirName: existing?.workDirName,
      pinned: existing?.pinned,
      archived: existing?.archived,
    })
  }, [activeConvId, activeSnap.runStatus, activeSnap.messages, activeSnap.title, upsertTaskLocal])

  const isOnExtension = extRoutes.includes(location.pathname)

  /* 路由在扩展子页面时自动展开 */
  useEffect(() => {
    if (isOnExtension) setExtOpen(true)
  }, [isOnExtension])

  const isLight = appearance === 'light'

  /* BorderBeam 条件包装：仅亮色模式启用流光 */
  const Beam = ({
    children,
    className,
    style,
  }: {
    children: ReactNode
    className?: string
    style?: React.CSSProperties
  }) => {
    if (!isLight)
      return (
        <div className={className} style={style}>
          {children}
        </div>
      )
    return (
      <BorderBeam color={token.colorPrimary} outset={0}>
        <div className={className} style={style}>
          {children}
        </div>
      </BorderBeam>
    )
  }

  /* 路由匹配 → nav 选中态 */
  const selectedKey = navItems.find((item) => item.key === location.pathname)?.key ?? ''

  /* 展开态菜单项 */
  const menuItems = navItems.map((item) => ({
    key: item.key,
    icon: item.icon,
    label: item.label,
  }))

  /* 导航点击：已在当前页则提示，否则跳转 */
  const handleNavClick = (key: string) => {
    if (key === location.pathname) {
      if (key === '/new-task') {
        /* 新任务页点击时重置会话状态 */
        navigate('/new-task', { state: { resetKey: Date.now() } })
      } else {
        message.info(alreadyHereMap[key] ?? '当前已在该页面')
      }
    } else {
      navigate(key)
    }
  }

  /* 创建任务按钮 */
  const handleCreateTask = () => {
    navigate('/new-task', { state: { resetKey: Date.now() } })
  }

  /* ── 分组逻辑 ── */
  const groupedTasks = useMemo(() => {
    const visibleTasks = sidebarTasks.filter((t) => !t.archived)
    const groupMap = new Map<
      string,
      {
        workspaceId: string
        workspaceName: string
        tasks: SidebarTaskItem[]
        latestUpdatedAt: number
      }
    >()

    for (const task of visibleTasks) {
      const wsId = task.workspaceId || 'default'
      const wsName = task.workspaceName || '默认'
      const existing = groupMap.get(wsId)
      if (existing) {
        existing.tasks.push(task)
        if (task.updatedAt > existing.latestUpdatedAt) {
          existing.latestUpdatedAt = task.updatedAt
        }
      } else {
        groupMap.set(wsId, {
          workspaceId: wsId,
          workspaceName: wsName,
          tasks: [task],
          latestUpdatedAt: task.updatedAt,
        })
      }
    }

    const groups = Array.from(groupMap.values())

    /* 工作空间 meta 映射 */
    const metaMap = new Map(workspaceMeta.map((m) => [m.id, m]))

    /* 组内排序：pinned 靠前，updatedAt 新的靠前 */
    for (const group of groups) {
      group.tasks.sort((a, b) => {
        if (a.pinned && !b.pinned) return -1
        if (!a.pinned && b.pinned) return 1
        return b.updatedAt - a.updatedAt
      })
    }

    /* 组排序：pinned workspace 靠前，然后最新 updatedAt 靠前 */
    groups.sort((a, b) => {
      const aMeta = metaMap.get(a.workspaceId)
      const bMeta = metaMap.get(b.workspaceId)
      const aPinned = aMeta?.pinned ?? false
      const bPinned = bMeta?.pinned ?? false
      if (aPinned && !bPinned) return -1
      if (!aPinned && bPinned) return 1
      return b.latestUpdatedAt - a.latestUpdatedAt
    })

    return { groups, metaMap }
  }, [sidebarTasks, workspaceMeta])

  /* ── 对话项操作 ── */
  const handleRenameOpen = useCallback((task: SidebarTaskItem) => {
    setRenameTargetId(task.id)
    setRenameValue(task.title)
    setRenameModalOpen(true)
  }, [])

  const handleRenameConfirm = useCallback(() => {
    if (!renameTargetId || !renameValue.trim()) return
    const newTitle = renameValue.trim()
    /* 更新侧栏 */
    updateTaskLocal(renameTargetId, { title: newTitle })
    /* 同步更新会话缓存 title */
    const conv = readConversation(renameTargetId)
    if (conv) {
      writeConversation({ ...conv, title: newTitle, updatedAt: Date.now() })
    }
    setRenameModalOpen(false)
    setRenameTargetId(null)
    setRenameValue('')
  }, [renameTargetId, renameValue, updateTaskLocal])

  const handleTogglePin = useCallback(
    (task: SidebarTaskItem) => {
      updateTaskLocal(task.id, { pinned: !task.pinned })
    },
    [updateTaskLocal],
  )

  const handleExportChat = useCallback(
    (_task: SidebarTaskItem) => {
      message.info('导出对话记录后续接入')
    },
    [message],
  )

  const handleArchiveTask = useCallback(
    (task: SidebarTaskItem) => {
      Modal.confirm({
        title: '归档对话',
        content: `确定归档「${task.title}」吗？归档后可在需要时恢复。`,
        okText: '归档',
        cancelText: '取消',
        onOk: () => {
          updateTaskLocal(task.id, { archived: true })
        },
      })
    },
    [message, updateTaskLocal],
  )

  const getTaskDropdownItems = useCallback(
    (task: SidebarTaskItem) => ({
      items: [
        { key: 'rename', icon: <Pencil />, label: '重命名' },
        {
          key: 'pin',
          icon: task.pinned ? <Pin /> : <Pin />,
          label: task.pinned ? '取消置顶' : '置顶',
        },
        { key: 'export', icon: <Upload />, label: '导出对话记录' },
        { type: 'divider' as const },
        { key: 'archive', icon: <Inbox />, label: '归档', danger: true },
      ],
      onClick: ({ key }: { key: string }) => {
        switch (key) {
          case 'rename':
            handleRenameOpen(task)
            break
          case 'pin':
            handleTogglePin(task)
            break
          case 'export':
            handleExportChat(task)
            break
          case 'archive':
            handleArchiveTask(task)
            break
        }
      },
    }),
    [handleRenameOpen, handleTogglePin, handleExportChat, handleArchiveTask],
  )

  /* ── 工作空间操作 ── */
  const handleWorkspaceNewChat = useCallback(
    (wsId: string, wsName: string) => {
      const workDirName = wsId.startsWith('workdir:') ? wsId.slice('workdir:'.length) : undefined
      navigate('/new-task', {
        state: {
          resetKey: Date.now(),
          workspaceId: wsId,
          workspaceName: wsName,
          workDirName,
        },
      })
    },
    [navigate],
  )

  const handleToggleWorkspacePin = useCallback(
    (wsId: string, wsName: string) => {
      const existing = useTaskStore.getState().workspaces.find((m) => m.id === wsId)
      upsertWorkspaceMeta({
        id: wsId,
        name: wsName,
        pinned: !(existing?.pinned ?? false),
      })
    },
    [upsertWorkspaceMeta],
  )

  const handleOpenFolder = useCallback(() => {
    message.info('打开文件夹需要桌面端能力，后续接入')
  }, [message])

  const handleArchiveWorkspace = useCallback(
    (wsId: string, wsName: string) => {
      Modal.confirm({
        title: '归档整组对话',
        content: `确定归档「${wsName}」下的所有对话吗？`,
        okText: '归档',
        cancelText: '取消',
        onOk: () => {
          archiveTasksByWorkspace(wsId)
        },
      })
    },
    [archiveTasksByWorkspace],
  )

  const getWorkspaceDropdownItems = useCallback(
    (wsId: string, wsName: string) => {
      const meta = groupedTasks.metaMap.get(wsId)
      const isPinned = meta?.pinned ?? false
      return {
        items: [
          { key: 'pin', icon: isPinned ? <Pin /> : <Pin />, label: isPinned ? '取消置顶' : '置顶' },
          { key: 'open-folder', icon: <Folder />, label: '在文件夹中打开' },
          { type: 'divider' as const },
          { key: 'archive-all', icon: <Inbox />, label: '归档整组对话', danger: true },
        ],
        onClick: ({ key }: { key: string }) => {
          switch (key) {
            case 'pin':
              handleToggleWorkspacePin(wsId, wsName)
              break
            case 'open-folder':
              handleOpenFolder()
              break
            case 'archive-all':
              handleArchiveWorkspace(wsId, wsName)
              break
          }
        },
      }
    },
    [groupedTasks.metaMap, handleToggleWorkspacePin, handleOpenFolder, handleArchiveWorkspace],
  )

  /* 设置按钮 */
  const handleSettingsClick = () => {
    if (location.pathname === '/settings') {
      message.info(alreadyHereMap['/settings'])
    } else {
      navigate('/settings')
    }
  }

  /* 主题 Dropdown */
  const themeMenuItems = [
    {
      key: 'editorial',
      icon: <Sun />,
      label: (
        <Space>
          亮色
          {appearance === 'editorial' && <Check />}
        </Space>
      ),
    },
    {
      key: 'editorial-dark',
      icon: <Moon />,
      label: (
        <Space>
          暗色
          {appearance === 'editorial-dark' && <Check />}
        </Space>
      ),
    },
    {
      key: 'mode-system',
      icon: <Monitor />,
      label: (
        <Space>
          跟随系统
          {appearance === 'system' && <Check />}
        </Space>
      ),
    },
  ]

  /* Divider 公共样式 */
  const dividerStyle = {
    margin: '4px 0',
    borderColor: token.colorBorderSecondary,
  }

  return (
    <div className={styles.root} ref={rootRef} data-testid="app-shell">
      <TitleBar
        sidebarCollapsed={sidebarCollapsed}
        onToggleSidebar={() => setSidebarCollapsed((v) => !v)}
        rightPanelCollapsed={rightWorkspaceCollapsed}
        onToggleRightPanel={() => setRightWorkspaceCollapsed((v) => !v)}
        onOpenSearch={() => setGlobalSearchOpen(true)}
        onOpenModal={(m) => setModalOpen(m)}
      />
      {/* ── Sidebar ── */}
      <aside
        data-testid="sidebar"
        className={`${styles.sidebar} ${sidebarCollapsed ? styles.sidebarCollapsed : ''}`}
        style={{
          background: token.colorBgLayout,
          borderRight: `1px solid ${token.colorBorderSecondary}`,
        }}
      >
        {/* Divider 1: 工具区下 */}
        <Divider style={dividerStyle} />

        {/* 主功能入口 */}
        {sidebarCollapsed ? (
          <Beam className={styles.sidebarBodyCollapsed}>
            {navItems.map((item, idx) => {
              const isActive = location.pathname === item.key
              return (
                <Tooltip key={idx} title={item.label} placement="right">
                  <Button
                    type={isActive ? 'primary' : 'text'}
                    icon={item.icon}
                    style={{
                      width: 40,
                      height: 40,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 16,
                    }}
                    onClick={() => handleNavClick(item.key)}
                  />
                </Tooltip>
              )
            })}

            {/* 扩展入口 - 折叠态 Dropdown */}
            <Dropdown
              trigger={['hover']}
              placement="bottomRight"
              getPopupContainer={() => document.body}
              menu={{
                items: extChildren.map((item) => ({
                  key: item.key,
                  icon: item.icon,
                  label: item.label,
                  onClick: () => navigate(item.route),
                })),
              }}
            >
              <Tooltip title="扩展" placement="right">
                <Button
                  type={isOnExtension ? 'primary' : 'text'}
                  icon={<LayoutGrid />}
                  style={{
                    width: 40,
                    height: 40,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 16,
                  }}
                />
              </Tooltip>
            </Dropdown>
          </Beam>
        ) : (
          <Beam className={styles.sidebarBody}>
            <Menu
              mode="inline"
              selectedKeys={selectedKey ? [selectedKey] : []}
              items={menuItems}
              onClick={({ key }) => handleNavClick(key)}
              style={{ border: 'none', background: 'transparent' }}
            />

            {/* 扩展入口 - 展开态 click */}
            <div
              className={styles.extensionBlock}
              onMouseEnter={() => setExtHeaderHover(true)}
              onMouseLeave={() => setExtHeaderHover(false)}
            >
              <div
                className={styles.extensionHeader}
                style={{
                  background: extOpen || extHeaderHover ? token.colorFillSecondary : 'transparent',
                  paddingInline: 16,
                  marginInline: 12,
                }}
                onClick={() => setExtOpen((v) => !v)}
              >
                <LayoutGrid />
                <span style={{ flex: 1 }}>扩展</span>
                <span
                  style={{
                    fontSize: 10,
                    color: token.colorTextTertiary,
                    opacity: extOpen || extHeaderHover ? 1 : 0,
                    transition: 'opacity 0.15s ease',
                  }}
                >
                  {extOpen ? <ChevronDown /> : <ChevronRight />}
                </span>
              </div>
              {extOpen && (
                <div className={styles.extensionChildren}>
                  {extChildren.map((item) => {
                    const isActive = location.pathname === item.route
                    return (
                      <button
                        key={item.key}
                        type="button"
                        role="menuitem"
                        className={styles.extensionChildRow}
                        style={
                          {
                            color: isActive ? token.colorPrimary : token.colorText,
                            fontWeight: isActive ? 500 : 400,
                            '--hover-bg': token.colorFillSecondary,
                          } as React.CSSProperties
                        }
                        onClick={() => navigate(item.route)}
                      >
                        <span style={{ marginRight: 8, fontSize: 14, display: 'inline-flex' }}>
                          {item.icon}
                        </span>
                        {item.label}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Segmented 切换区 */}
            <div className={styles.sidebarSegmented}>
              <CapsuleTabs
                block
                testId="sidebar-segment"
                value={segment}
                onChange={(val) => {
                  if (val === 'tasks') navigate('/tasks')
                  else if (val === 'channels') navigate('/mobile-control')
                }}
                options={[
                  { label: '任务', value: 'tasks', icon: <List /> },
                  { label: '移动端控制', value: 'channels', icon: <Smartphone /> },
                ]}
                size="small"
              />
            </div>

            {/* 内容区：任务列表或空状态 */}
            <div className={styles.sidebarEmpty}>
              {segment === 'tasks' ? (
                groupedTasks.groups.length > 0 ? (
                  <div className={styles.taskList} data-testid="sidebar-task-list">
                    {groupedTasks.groups.map((group) => (
                      <div key={group.workspaceId} className={styles.workspaceGroup}>
                        {/* 工作空间标题 */}
                        <div
                          className={styles.workspaceHeader}
                          style={
                            {
                              color: token.colorTextSecondary,
                              '--hover-bg': token.colorFillSecondary,
                            } as React.CSSProperties
                          }
                        >
                          <Folder style={{ fontSize: 12, flexShrink: 0 }} />
                          <span className={styles.workspaceHeaderName}>{group.workspaceName}</span>
                          <span className={styles.workspaceHeaderActions}>
                            <Dropdown
                              menu={getWorkspaceDropdownItems(
                                group.workspaceId,
                                group.workspaceName,
                              )}
                              trigger={['click']}
                              getPopupContainer={() => document.body}
                            >
                              <Button
                                type="text"
                                size="small"
                                icon={<MoreHorizontal />}
                                style={{ width: 20, height: 20, minWidth: 20, fontSize: 10 }}
                                onClick={(e) => e.stopPropagation()}
                              />
                            </Dropdown>
                            <Tooltip title="新建对话">
                              <Button
                                type="text"
                                size="small"
                                icon={<Plus />}
                                style={{ width: 20, height: 20, minWidth: 20, fontSize: 10 }}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleWorkspaceNewChat(group.workspaceId, group.workspaceName)
                                }}
                              />
                            </Tooltip>
                          </span>
                        </div>
                        {/* 组内对话列表 */}
                        <div className={styles.workspaceTaskList}>
                          {group.tasks.map((task) => {
                            const isActive = task.id === activeConvId
                            return (
                              <div
                                key={task.id}
                                className={styles.taskItem}
                                style={
                                  {
                                    background: isActive ? token.colorPrimaryBg : undefined,
                                    '--hover-bg': token.colorFillSecondary,
                                  } as React.CSSProperties
                                }
                                onClick={() =>
                                  navigate(
                                    `/new-task?conversationId=${encodeURIComponent(task.id)}`,
                                  )
                                }
                              >
                                <div className={styles.taskItemTitle}>
                                  {task.pinned && (
                                    <Pin
                                      style={{
                                        fontSize: 10,
                                        color: token.colorPrimary,
                                        flexShrink: 0,
                                      }}
                                    />
                                  )}
                                  <span className={styles.taskItemTitleText}>
                                    <Text ellipsis style={{ fontSize: 13 }}>
                                      {task.title}
                                    </Text>
                                  </span>
                                  <span className={styles.taskItemActions}>
                                    <Dropdown
                                      menu={getTaskDropdownItems(task)}
                                      trigger={['click']}
                                      getPopupContainer={() => document.body}
                                    >
                                      <Button
                                        type="text"
                                        size="small"
                                        icon={<MoreHorizontal />}
                                        style={{
                                          width: 20,
                                          height: 20,
                                          minWidth: 20,
                                          fontSize: 10,
                                        }}
                                        onClick={(e) => e.stopPropagation()}
                                      />
                                    </Dropdown>
                                  </span>
                                </div>
                                <div className={styles.taskItemMeta}>
                                  {task.status === 'streaming' && (
                                    <CapsuleTag color="processing">进行中</CapsuleTag>
                                  )}
                                  {task.status === 'completed' && (
                                    <CapsuleTag color="success">完成</CapsuleTag>
                                  )}
                                  {task.status === 'stopped' && <CapsuleTag>已停止</CapsuleTag>}
                                  {task.status === 'failed' && (
                                    <CapsuleTag color="error">失败</CapsuleTag>
                                  )}
                                  {task.status === 'idle' && <CapsuleTag>空闲</CapsuleTag>}
                                  <Text type="secondary" style={{ fontSize: 12 }}>
                                    {new Date(task.updatedAt).toLocaleTimeString(undefined, {
                                      hour: '2-digit',
                                      minute: '2-digit',
                                    })}
                                  </Text>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无任务">
                    {isLight ? (
                      <BorderBeam color={token.colorPrimary} outset={0}>
                        <CapsuleButton type="primary" size="small" onClick={handleCreateTask}>
                          创建任务
                        </CapsuleButton>
                      </BorderBeam>
                    ) : (
                      <CapsuleButton type="primary" size="small" onClick={handleCreateTask}>
                        创建任务
                      </CapsuleButton>
                    )}
                  </Empty>
                )
              ) : (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无移动端控制会话" />
              )}
            </div>
          </Beam>
        )}

        {/* Divider 2: 主入口区下 */}
        <Divider style={dividerStyle} />

        {/* 底部 */}
        <Beam
          className={`${styles.sidebarFooter} ${sidebarCollapsed ? styles.sidebarFooterCollapsed : ''}`}
        >
          <UserMenu
            collapsed={sidebarCollapsed}
            onOpenShortcuts={() => setModalOpen('shortcuts')}
          />
          <Tooltip title="设置" placement={sidebarCollapsed ? 'right' : undefined}>
            <Button
              type="text"
              icon={<Settings />}
              size={sidebarCollapsed ? 'middle' : 'small'}
              onClick={handleSettingsClick}
              data-testid="sidebar-settings"
            />
          </Tooltip>
          <Dropdown
            menu={{
              items: themeMenuItems,
              onClick: ({ key }) => {
                const value = key.startsWith('mode-') ? key.slice(5) : key
                setAppearance(value as Appearance)
              },
            }}
            trigger={['click']}
            placement="topRight"
          >
            <Tooltip title="切换主题" placement={sidebarCollapsed ? 'right' : undefined}>
              <Button
                type="text"
                icon={isLight ? <Sun /> : <Moon />}
                size={sidebarCollapsed ? 'middle' : 'small'}
              />
            </Tooltip>
          </Dropdown>
        </Beam>
      </aside>

      {/* ── MainWorkspace ── */}
      <main
        data-testid="main-workspace"
        className={styles.workspace}
        style={{
          background: token.colorBgLayout,
        }}
      >
        <ErrorBoundary>
          <Outlet />
        </ErrorBoundary>
      </main>

      {/* ── 拖拽分隔条 ── */}
      {!rightWorkspaceCollapsed && (
        <div
          className={styles.rightResizeHandle}
          onPointerDown={handleDragStart}
          style={
            {
              '--accent-color': token.colorPrimary,
              background: token.colorBgLayout,
            } as React.CSSProperties
          }
        />
      )}

      {/* ── 右侧任务工作台 ── */}
      <RightWorkspacePanel
        collapsed={rightWorkspaceCollapsed}
        setCollapsed={setRightWorkspaceCollapsed}
        width={rightPanelWidth}
        panelRef={panelRef}
        parentConversationId={activeConvId}
      />

      {/* ── 工具弹窗 ── */}
      <UsageModal open={modalOpen === 'usage'} onClose={() => setModalOpen(null)} />

      <ShortcutsModal open={modalOpen === 'shortcuts'} onClose={() => setModalOpen(null)} />

      <FeedbackModal open={modalOpen === 'feedback'} onClose={() => setModalOpen(null)} />

      <GlobalSearchModal open={globalSearchOpen} onClose={() => setGlobalSearchOpen(false)} />

      {/* 重命名弹窗 */}
      <Modal
        title="重命名对话"
        open={renameModalOpen}
        onOk={handleRenameConfirm}
        onCancel={() => {
          setRenameModalOpen(false)
          setRenameTargetId(null)
        }}
        okText="确定"
        cancelText="取消"
        destroyOnHidden
      >
        <Input
          value={renameValue}
          onChange={(e) => setRenameValue(e.target.value)}
          placeholder="输入新名称"
          autoFocus
          onPressEnter={handleRenameConfirm}
        />
      </Modal>
    </div>
  )
}

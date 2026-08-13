import { useCallback, useEffect, useState } from 'react'
import type { RefObject } from 'react'
import {
  Button,
  Dropdown,
  Empty,
  Space,
  Tabs,
  Tag,
  Tooltip,
  Typography,
  theme,
} from 'antd'
import {
  Plus,
  Code,
  Eye,
  FolderOpen,
  Copy,
  Maximize2,
  RotateCw,
  FileText,
  Diff,
  Globe,
  MessageSquare,
  PanelRightClose,
  PanelRightOpen,
} from 'lucide-react'
import styles from './RightWorkspacePanel.module.css'
import { FileTreePanel } from './panels/FileTreePanel'
import { ReviewPanel } from './panels/ReviewPanel'
import { BrowserPanel } from './panels/BrowserPanel'
import { TerminalPanel } from './panels/TerminalPanel'
import { AssistantChatPanel } from './panels/AssistantChatPanel'

const { Text } = Typography

const isElectron = typeof window !== 'undefined' && !!window.geowork?.desktop

/* ── 类型定义 ── */
type StaticTabKey = 'review'
type SystemTabKey = 'task' | StaticTabKey
type DynamicTabKey = 'files' | 'browser' | 'terminal' | 'preview' | 'context'
/** 辅助对话 Tab：key 格式为 `chat-${sessionId}` */
type ChatTabKey = `chat-${string}`

type WorkspaceTabKey = SystemTabKey | DynamicTabKey | ChatTabKey

const VALID_DYNAMIC_TABS: DynamicTabKey[] = ['files', 'browser', 'terminal', 'preview', 'context']

const DYNAMIC_TAB_CONFIG: Record<DynamicTabKey, { label: string; icon: React.ReactNode }> = {
  files: { label: '文件', icon: <FileText /> },
  browser: { label: '浏览器', icon: <Globe /> },
  terminal: { label: '终端', icon: <Code /> },
  preview: { label: '预览', icon: <Eye /> },
  context: { label: '上下文', icon: <FolderOpen /> },
}

/* ── localStorage 工具 ── */
const LS_PREFIX = 'geowork.rightWorkspace.'
const LS_ACTIVE = `${LS_PREFIX}activeTab`
const LS_OPEN_TABS = `${LS_PREFIX}openTabsV2`
const LS_CHAT_SESSIONS = `${LS_PREFIX}chatSessions`

function safeReadString(key: string, fallback: string): string {
  try {
    const v = localStorage.getItem(key)
    return typeof v === 'string' ? v : fallback
  } catch { return fallback }
}

function safeReadArray<T>(key: string, validator: (v: unknown) => v is T): T[] {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(validator)
  } catch { return [] }
}

const isDynamicTab = (v: unknown): v is DynamicTabKey =>
  typeof v === 'string' && VALID_DYNAMIC_TABS.includes(v as DynamicTabKey)

const isChatTab = (v: unknown): v is ChatTabKey =>
  typeof v === 'string' && v.startsWith('chat-')

const isValidOpenTab = (v: unknown): v is DynamicTabKey | ChatTabKey =>
  isDynamicTab(v) || isChatTab(v)

/* ── Mock 数据 ── */
const MOCK_CONTEXT_FILES = [
  'package.json',
  'src/App.tsx',
  'src/shell/AppShell.tsx',
  'src/pages/NewTask/NewTaskPage.tsx',
  'src/shell/RightWorkspacePanel.tsx',
]

const MOCK_MODIFIED_FILES = [
  'RightWorkspacePanel.tsx',
  'RightWorkspacePanel.module.css',
  'AppShell.tsx',
  'AppShell.module.css',
]

/* ── Tab 内容组件 ── */

function PreviewPanelContent({ token }: { token: ReturnType<typeof theme.useToken>['token'] }) {
  return (
    <div className={styles.content}>
      <div className={styles.previewBar}>
        <div
          style={{
            flex: 1,
            padding: '4px 10px',
            borderRadius: 6,
            fontSize: 12,
            fontFamily: "'SF Mono', 'Cascadia Code', monospace",
            background: token.colorFillQuaternary,
            color: token.colorTextSecondary,
          }}
        >
          http://localhost:5173/
        </div>
        <Space size={0}>
          <Tooltip title="刷新">
            <Button type="text" size="small" icon={<RotateCw />} style={{ fontSize: 12 }} />
          </Tooltip>
          <Tooltip title="外部打开">
            <Button type="text" size="small" icon={<Maximize2 />} style={{ fontSize: 12 }} />
          </Tooltip>
          <Tooltip title="复制地址">
            <Button type="text" size="small" icon={<Copy />} style={{ fontSize: 12 }} />
          </Tooltip>
        </Space>
      </div>
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description={
          <Text type="secondary" style={{ fontSize: 13 }}>
            暂无预览地址，启动 dev server 后可在此查看页面。
          </Text>
        }
      />
    </div>
  )
}

function ContextPanelContent({ token }: { token: ReturnType<typeof theme.useToken>['token'] }) {
  return (
    <div className={styles.content}>
      {/* 工作目录 */}
      <div className={styles.contextSection}>
        <div className={styles.cardTitle} style={{ color: token.colorTextSecondary }}>工作目录</div>
        <div
          style={{
            padding: '6px 10px',
            borderRadius: 6,
            fontSize: 12,
            fontFamily: "'SF Mono', 'Cascadia Code', monospace",
            background: token.colorFillQuaternary,
            color: token.colorText,
          }}
        >
          E:\code\javascript\project\GeoFrontend2.0
        </div>
      </div>

      {/* 相关文件 */}
      <div className={styles.contextSection}>
        <div className={styles.cardTitle} style={{ color: token.colorTextSecondary }}>相关文件</div>
        <div className={styles.fileList}>
          {MOCK_CONTEXT_FILES.map((f, i) => (
            <div key={i} className={styles.fileItem} style={{ color: token.colorText }}>
              <span style={{ fontSize: 12, color: token.colorTextTertiary }}>{f}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 修改文件 */}
      <div className={styles.contextSection}>
        <div className={styles.cardTitle} style={{ color: token.colorTextSecondary }}>修改文件</div>
        <div className={styles.fileList}>
          {MOCK_MODIFIED_FILES.map((f, i) => (
            <div key={i} className={styles.fileItem} style={{ color: token.colorText }}>
              <Tag color="processing" style={{ fontSize: 11, lineHeight: '18px', padding: '0 4px', marginRight: 4 }}>M</Tag>
              <span style={{ fontSize: 12 }}>{f}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 技术栈 */}
      <div className={styles.contextSection}>
        <div className={styles.cardTitle} style={{ color: token.colorTextSecondary }}>技术栈</div>
        <div className={styles.tagRow}>
          {['React', 'TypeScript', 'Vite', 'Ant Design', 'CSS Modules'].map((t) => (
            <Tag key={t} style={{ fontSize: 11, margin: 0 }}>{t}</Tag>
          ))}
        </div>
      </div>

      {/* MCP / 工具调用 */}
      <div className={styles.contextSection}>
        <div className={styles.cardTitle} style={{ color: token.colorTextSecondary }}>MCP / 工具调用</div>
        <Text type="secondary" style={{ fontSize: 12 }}>
          暂无工具调用记录，后续接入任务运行时后展示。
        </Text>
      </div>
    </div>
  )
}

/* ── 辅助函数：ChatTabKey ↔ sessionId ── */
const chatTabKey = (sessionId: string): ChatTabKey => `chat-${sessionId}`
const extractChatSessionId = (key: ChatTabKey): string => key.slice('chat-'.length)

/* ── 主组件 ── */
interface RightWorkspacePanelProps {
  collapsed: boolean
  setCollapsed: (v: boolean) => void
  width: number
  panelRef: RefObject<HTMLDivElement | null>
  /** 当前工作区绝对路径(用于文件树面板) */
  workspacePath?: string
  /** 当前主对话 id，传递给辅助对话用于继承上下文 */
  parentConversationId?: string | null
}

const DEFAULT_CHAT_SESSION = 'default'

export function RightWorkspacePanel({
  collapsed,
  setCollapsed,
  width,
  panelRef,
  workspacePath,
  parentConversationId,
}: RightWorkspacePanelProps) {
  const { token } = theme.useToken()

  /* 打开的 Tab 列表（不含静态 system tab）：动态 Tab + Chat Tab */
  const [openTabs, setOpenTabs] = useState<(DynamicTabKey | ChatTabKey)[]>(() => {
    const restored = safeReadArray(LS_OPEN_TABS, isValidOpenTab)
    if (restored.length > 0) return restored
    /* 默认打开第一个辅助对话 Tab */
    return [chatTabKey(DEFAULT_CHAT_SESSION)]
  })

  /* 聊天会话列表（按顺序存储，用于生成序号标签） */
  const [chatSessions, setChatSessions] = useState<string[]>(() => {
    const restored = safeReadArray(LS_CHAT_SESSIONS, (v): v is string => typeof v === 'string')
    if (restored.length > 0) return restored
    return [DEFAULT_CHAT_SESSION]
  })

  const [activeTab, setActiveTab] = useState<WorkspaceTabKey>(() => {
    const restored = safeReadString(LS_ACTIVE, chatTabKey(DEFAULT_CHAT_SESSION)) as WorkspaceTabKey
    return restored
  })

  /* ── 持久化 ── */
  useEffect(() => {
    localStorage.setItem(LS_ACTIVE, activeTab)
  }, [activeTab])

  useEffect(() => {
    localStorage.setItem(LS_OPEN_TABS, JSON.stringify(openTabs))
  }, [openTabs])

  useEffect(() => {
    localStorage.setItem(LS_CHAT_SESSIONS, JSON.stringify(chatSessions))
  }, [chatSessions])

  /* ── activeTab 校验：确保 active 在 openTabs 或 system tab 中 ── */
  useEffect(() => {
    const systemTabs: WorkspaceTabKey[] = ['review']
    if (
      activeTab !== 'task' &&
      !systemTabs.includes(activeTab) &&
      !openTabs.includes(activeTab as DynamicTabKey | ChatTabKey)
    ) {
      /* 优先切到第一个 chat tab，否则第一个 open tab，否则 review */
      const firstChat = openTabs.find((k): k is ChatTabKey => isChatTab(k))
      if (firstChat) {
        setActiveTab(firstChat)
      } else if (openTabs.length > 0) {
        setActiveTab(openTabs[0])
      } else {
        setActiveTab('review')
      }
    }
  }, [openTabs, activeTab])

  /* ── 打开动态 Tab ── */
  const openDynamicTab = useCallback((key: DynamicTabKey) => {
    setOpenTabs((prev) => {
      if (prev.includes(key)) return prev
      return [...prev, key]
    })
    setActiveTab(key)
  }, [])

  /* ── 新建辅助对话会话 ── */
  const createNewChatTab = useCallback(() => {
    const newSessionId = `sess_${Date.now()}`
    const newKey = chatTabKey(newSessionId)
    setChatSessions((prev) => [...prev, newSessionId])
    setOpenTabs((prev) => [...prev, newKey])
    setActiveTab(newKey)
  }, [])

  /* ── 关闭 Tab ── */
  const closeTab = useCallback((key: DynamicTabKey | ChatTabKey) => {
    setOpenTabs((prev) => prev.filter((k) => k !== key))
    /* 若关闭的是 chat tab，也从 chatSessions 移除 */
    if (isChatTab(key)) {
      const sessionId = extractChatSessionId(key)
      setChatSessions((prev) => prev.filter((s) => s !== sessionId))
    }
    /* 切到默认：优先 review，否则第一个 open */
    setActiveTab((curr) => {
      if (curr !== key) return curr
      return 'review'
    })
  }, [])

  /* ── Tab 变更 ── */
  const handleTabChange = useCallback((key: string) => {
    setActiveTab(key as WorkspaceTabKey)
  }, [])

  /* ── Tab 关闭（editable-card 的 onEdit） ── */
  const handleTabEdit = useCallback((
    targetKey: string | React.MouseEvent | React.KeyboardEvent,
    action: 'add' | 'remove',
  ) => {
    if (action === 'remove' && typeof targetKey === 'string') {
      const k = targetKey as WorkspaceTabKey
      if (k === 'review' || k === 'task') return /* system tab 不可关闭 */
      closeTab(k as DynamicTabKey | ChatTabKey)
    } else if (action === 'add') {
      createNewChatTab()
    }
  }, [closeTab, createNewChatTab])

  /* ── "+" Dropdown 菜单（打开其他动态 Tab，新建辅助对话） ── */
  const plusMenuItems = [
    {
      key: '__new_chat',
      label: '新建辅助对话',
      icon: <MessageSquare />,
      onClick: createNewChatTab,
      extra: <Tag color="blue" style={{ fontSize: 10, padding: '0 4px' }}>常用</Tag>,
    },
    { type: 'divider' as const },
    ...VALID_DYNAMIC_TABS.map((key) => ({
      key,
      label: DYNAMIC_TAB_CONFIG[key].label,
      icon: DYNAMIC_TAB_CONFIG[key].icon,
      onClick: () => openDynamicTab(key),
    })),
  ]

  /* ── 获取聊天会话的序号显示（辅助对话 1、辅助对话 2…） ── */
  const getChatTabLabel = (sessionId: string): string => {
    const idx = chatSessions.indexOf(sessionId)
    if (idx === -1) return '辅助对话'
    return `辅助对话 ${idx + 1}`
  }

  /* ── 构建 Tabs items：按用户要求顺序：审查 → 辅助对话们 → 其他动态 Tab ── */
  const tabItems: {
    key: string
    label: React.ReactNode
    closable: boolean
    children: React.ReactNode
  }[] = []

  /* 1. 审查 Tab（静态，不可关） */
  tabItems.push({
    key: 'review',
    label: (
      <Space size={4}>
        <Diff />
        <span>审查</span>
      </Space>
    ),
    closable: false,
    children: <ReviewPanel />,
  })

  /* 2. 辅助对话 Tab（可关闭，除了 default 可能保留） */
  for (const tabKey of openTabs) {
    if (isChatTab(tabKey)) {
      const sessionId = extractChatSessionId(tabKey)
      tabItems.push({
        key: tabKey,
        label: (
          <Space size={4}>
            <MessageSquare />
            <span>{getChatTabLabel(sessionId)}</span>
          </Space>
        ),
        closable: true,
        children: (
          <AssistantChatPanel
            sessionId={sessionId}
            parentConversationId={parentConversationId}
          />
        ),
      })
    }
  }

  /* 3. 其他动态 Tab */
  for (const tabKey of openTabs) {
    if (!isChatTab(tabKey)) {
      const dynKey = tabKey as DynamicTabKey
      tabItems.push({
        key: dynKey,
        label: (
          <Space size={4}>
            {DYNAMIC_TAB_CONFIG[dynKey].icon}
            <span>{DYNAMIC_TAB_CONFIG[dynKey].label}</span>
          </Space>
        ),
        closable: true,
        children: dynKey === 'files' ? <FileTreePanel workspacePath={workspacePath} />
          : dynKey === 'browser' ? <BrowserPanel active={activeTab === 'browser'} />
          : dynKey === 'terminal' ? <TerminalPanel active={activeTab === 'terminal'} />
          : dynKey === 'preview' ? <PreviewPanelContent token={token} />
          : <ContextPanelContent token={token} />,
      })
    }
  }

  /* ── 收起态：Electron 下控制按钮在顶栏，完全隐藏；浏览器 dev 模式渲染 fallback 按钮 ── */
  if (collapsed) {
    if (isElectron) return null
    return (
      <Tooltip title="展开工作台" placement="left">
        <Button
          type="text"
          icon={<PanelRightOpen style={{ fontSize: 16 }} />}
          onClick={() => setCollapsed(false)}
          style={{
            position: 'fixed',
            right: 8,
            top: '50%',
            transform: 'translateY(-50%)',
            zIndex: 100,
            width: 32,
            height: 32,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        />
      </Tooltip>
    )
  }

  return (
    <div
      ref={panelRef}
      className={styles.panel}
      style={{
        width,
        flexBasis: width,
        flexShrink: 0,
        background: token.colorBgContainer,
      }}
    >
      {/* 面板头部 */}
      <div className={styles.panelHeader}>
        <span className={styles.panelHeaderTitle} />
      </div>

      {/* Tabs */}
      <div className={styles.tabsWrap}>
        <Tabs
          type="editable-card"
          activeKey={activeTab}
          onChange={handleTabChange}
          onEdit={handleTabEdit}
          items={tabItems}
          tabBarExtraContent={
            <Dropdown
              menu={{ items: plusMenuItems }}
              trigger={['click']}
              getPopupContainer={() => document.body}
            >
              <Button
                type="text"
                icon={<Plus />}
                size="small"
                style={{ marginRight: 4 }}
              />
            </Dropdown>
          }
        />
      </div>
    </div>
  )
}

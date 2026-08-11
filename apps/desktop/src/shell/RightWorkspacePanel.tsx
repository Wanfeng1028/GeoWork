import { useCallback, useEffect, useState } from 'react'
import type { RefObject } from 'react'
import {
  Button,
  Dropdown,
  Empty,
  Progress,
  Space,
  Tabs,
  Tag,
  Tooltip,
  Typography,
  theme,
} from 'antd'
import {
  PlusOutlined,
  CodeOutlined,
  EyeOutlined,
  FolderOpenOutlined,
  LeftOutlined,
  RightOutlined,
  CheckCircleFilled,
  ClockCircleOutlined,
  CopyOutlined,
  ExpandOutlined,
  ReloadOutlined,
  FileTextOutlined,
  DiffOutlined,
  GlobalOutlined,
  MessageOutlined,
} from '@ant-design/icons'
import styles from './RightWorkspacePanel.module.css'
import { FileTreePanel } from './panels/FileTreePanel'
import { ReviewPanel } from './panels/ReviewPanel'
import { BrowserPanel } from './panels/BrowserPanel'
import { TerminalPanel } from './panels/TerminalPanel'
import { AssistantChatPanel } from './panels/AssistantChatPanel'

const { Text } = Typography

/* ── 类型定义 ── */
type StaticTabKey = 'review'
type SystemTabKey = 'task' | StaticTabKey
type DynamicTabKey = 'files' | 'browser' | 'terminal' | 'preview' | 'context'
/** 辅助对话 Tab：key 格式为 `chat-${sessionId}` */
type ChatTabKey = `chat-${string}`

type WorkspaceTabKey = SystemTabKey | DynamicTabKey | ChatTabKey

const VALID_DYNAMIC_TABS: DynamicTabKey[] = ['files', 'browser', 'terminal', 'preview', 'context']

const DYNAMIC_TAB_CONFIG: Record<DynamicTabKey, { label: string; icon: React.ReactNode }> = {
  files: { label: '文件', icon: <FileTextOutlined /> },
  browser: { label: '浏览器', icon: <GlobalOutlined /> },
  terminal: { label: '终端', icon: <CodeOutlined /> },
  preview: { label: '预览', icon: <EyeOutlined /> },
  context: { label: '上下文', icon: <FolderOpenOutlined /> },
}

const STATIC_TAB_CONFIG: Record<StaticTabKey, { label: string; icon: React.ReactNode; closable: boolean }> = {
  review: { label: '审查', icon: <DiffOutlined />, closable: false },
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
const MOCK_TASK = {
  title: '新增右侧任务工作台面板',
  status: '执行中',
  progress: 62,
  stage: '正在改造为 IDE 式可关闭标签页',
}

const MOCK_CHECKLIST = [
  { text: '分析现有布局', done: true },
  { text: '创建 RightWorkspacePanel', done: true },
  { text: '改造为 IDE 式可关闭 Tab', done: true },
  { text: '接入动态终端 Tab', done: true },
  { text: '接入动态预览 Tab', done: true },
  { text: '补充产物区域', done: false },
  { text: '补充上下文文件区域', done: false },
  { text: '完成暗色模式适配', done: false },
]

const MOCK_ARTIFACTS = [
  { name: 'RightWorkspacePanel.tsx', type: '新增', desc: '右侧任务工作台主组件' },
  { name: 'RightWorkspacePanel.module.css', type: '新增', desc: '右侧任务工作台样式' },
  { name: 'AppShell.tsx', type: '修改', desc: '接入右侧面板三栏布局' },
  { name: 'AppShell.module.css', type: '修改', desc: '补强 flex 布局约束' },
]

const MOCK_CONTEXT_FILES = [
  'package.json',
  'src/App.tsx',
  'src/shell/AppShell.tsx',
  'src/pages/NewTask/NewTaskPage.tsx',
  'src/shell/RightWorkspacePanel.tsx',
]

const MOCK_LOGS = [
  { time: '19:50', text: '已读取当前布局文件' },
  { time: '19:51', text: '已确认项目使用 Ant Design' },
  { time: '19:52', text: '已创建右侧工作台组件' },
  { time: '19:53', text: '已切换为动态 Tab 结构' },
  { time: '19:54', text: '等待接入真实任务状态' },
]

const MOCK_MODIFIED_FILES = [
  'RightWorkspacePanel.tsx',
  'RightWorkspacePanel.module.css',
  'AppShell.tsx',
  'AppShell.module.css',
]

/* ── Tab 内容组件 ── */

function TaskPanelContent({ token }: { token: ReturnType<typeof theme.useToken>['token'] }) {
  return (
    <div className={styles.content}>
      {/* 任务概览 */}
      <div className={styles.cardSection}>
        <div className={styles.cardTitle} style={{ color: token.colorTextSecondary }}>任务概览</div>
        <div style={{ marginBottom: 8 }}>
          <Text strong style={{ fontSize: 14 }}>{MOCK_TASK.title}</Text>
        </div>
        <Space size={8} style={{ marginBottom: 12 }}>
          <Tag color="processing">{MOCK_TASK.status}</Tag>
          <Text type="secondary" style={{ fontSize: 12 }}>{MOCK_TASK.stage}</Text>
        </Space>
        <Progress
          percent={MOCK_TASK.progress}
          size="small"
          strokeColor={token.colorPrimary}
          format={(p) => `${p}%`}
        />
      </div>

      {/* 待办 Checklist */}
      <div className={styles.cardSection}>
        <div className={styles.cardTitle} style={{ color: token.colorTextSecondary }}>待办</div>
        <div className={styles.checklist}>
          {MOCK_CHECKLIST.map((item, i) => (
            <div key={i} className={`${styles.checklistItem} ${item.done ? styles.checklistDone : ''}`}>
              <span className={styles.checklistIcon} style={{ color: item.done ? token.colorSuccess : token.colorTextQuaternary }}>
                {item.done ? <CheckCircleFilled /> : <ClockCircleOutlined />}
              </span>
              <Text
                type={item.done ? 'secondary' : undefined}
                style={{ fontSize: 13, textDecoration: item.done ? 'line-through' : 'none' }}
              >
                {item.text}
              </Text>
            </div>
          ))}
        </div>
      </div>

      {/* 产物 Artifacts */}
      <div className={styles.cardSection}>
        <div className={styles.cardTitle} style={{ color: token.colorTextSecondary }}>产物</div>
        <div className={styles.artifactList}>
          {MOCK_ARTIFACTS.map((a, i) => (
            <div
              key={i}
              className={styles.artifactItem}
              style={{ background: token.colorFillQuaternary }}
            >
              <div className={styles.artifactName} style={{ color: token.colorText }}>
                {a.name}
              </div>
              <div className={styles.artifactMeta}>
                <Tag
                  color={a.type === '新增' ? 'success' : 'processing'}
                  style={{ fontSize: 11, lineHeight: '18px', padding: '0 4px', marginRight: 6 }}
                >
                  {a.type}
                </Tag>
                <Text type="secondary" style={{ fontSize: 11 }}>{a.desc}</Text>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 上下文文件 */}
      <div className={styles.cardSection}>
        <div className={styles.cardTitle} style={{ color: token.colorTextSecondary }}>上下文文件</div>
        <div className={styles.fileList}>
          {MOCK_CONTEXT_FILES.map((f, i) => (
            <div key={i} className={styles.fileItem} style={{ color: token.colorText }}>
              <span style={{ fontSize: 12, color: token.colorTextTertiary }}>{f}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 最近日志 */}
      <div className={styles.cardSection}>
        <div className={styles.cardTitle} style={{ color: token.colorTextSecondary }}>最近日志</div>
        <div className={styles.logList}>
          {MOCK_LOGS.map((log, i) => (
            <div key={i} className={styles.logItem}>
              <span className={styles.logTime} style={{ color: token.colorTextTertiary }}>{log.time}</span>
              <Text style={{ fontSize: 12 }}>{log.text}</Text>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

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
            <Button type="text" size="small" icon={<ReloadOutlined />} style={{ fontSize: 12 }} />
          </Tooltip>
          <Tooltip title="外部打开">
            <Button type="text" size="small" icon={<ExpandOutlined />} style={{ fontSize: 12 }} />
          </Tooltip>
          <Tooltip title="复制地址">
            <Button type="text" size="small" icon={<CopyOutlined />} style={{ fontSize: 12 }} />
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
      icon: <MessageOutlined />,
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
        <DiffOutlined />
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
            <MessageOutlined />
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

  /* ── 收起态 ── */
  if (collapsed) {
    return (
      <div
        ref={panelRef}
        className={`${styles.panel} ${styles.panelCollapsed}`}
        style={{
          borderLeft: `1px solid ${token.colorBorderSecondary}`,
          background: token.colorBgContainer,
        }}
      >
        <div className={styles.collapsedBar}>
          <Tooltip title="展开工作台" placement="left">
            <Button
              type="text"
              icon={<LeftOutlined />}
              size="small"
              onClick={() => setCollapsed(false)}
            />
          </Tooltip>
        </div>
      </div>
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
        borderLeft: `1px solid ${token.colorBorderSecondary}`,
        background: token.colorBgContainer,
      }}
    >
      {/* 面板头部：收起按钮 */}
      <div className={styles.panelHeader}>
        <span className={styles.panelHeaderTitle} />
        <Button
          type="text"
          icon={<RightOutlined />}
          size="small"
          onClick={() => setCollapsed(true)}
        />
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
                icon={<PlusOutlined />}
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

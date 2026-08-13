import { useEffect, useRef, useState } from 'react'
import { useLocation, useSearchParams, useNavigate } from 'react-router'
import {
  App,
  Button,
  Dropdown,
  Tour,
  Typography,
  theme,
} from 'antd'
import { Loader2, FolderOpen, Boxes, Code, MapPin } from 'lucide-react'
import { ChatComposer } from './components/ChatComposer'
import { ContextPickerModal } from './components/ContextPickerModal'
import type { ContextPickerType } from './components/ContextPickerModal'
import { ConversationMessageView } from './components/ConversationMessage'
import { activeAdapter, getCoreConversationId, setCoreConversationId } from './components/streamAdapters'
import type { ConversationMessage, RunStatus, ToolCallLog, SelectedContextItem, SelectedContextKind, WorkMode } from './components/conversationStorage'
import { createEmptyConversation, getConversation, upsertConversation } from './components/conversationStorage'
import type { Conversation } from './components/conversationStorage'
import { apiGet } from '../../shared/api/client'
import { upsertSidebarTask } from '../../shared/stores/taskSidebarStore'
import type { SidebarTaskStatus } from '../../shared/stores/taskSidebarStore'
import { CapsuleTabs } from '../../shell/components/CapsuleTabs'
import { CapsuleTag } from '../../shell/components/CapsuleTag'
import { PageSkeleton } from '../../shell/feedback'
import styles from './NewTaskPage.module.css'
// 主界面大 logo 已注释，暂不需要该资源
// import logoAnimated from '../../assets/brand/geowork-logo-horizontal-gradient.svg'

const { Title, Text } = Typography

/* ── WorkMode 文案映射 ── */
const WORK_MODE_COPY: Record<WorkMode, { title: string; subtitle: string; placeholder: string }> = {
  work: {
    title: '用自然语言搞定空间智能工作流',
    subtitle: '用自然语言连接数据、地图、模型与工具，完成可追溯的 GIS 分析。',
    placeholder: '描述你的 GIS 任务……',
  },
  code: {
    title: '用代码驱动空间分析开发',
    subtitle: '编写脚本、调试算法、构建空间分析流水线。',
    placeholder: '描述你的开发任务……',
  },
  map: {
    title: '用对话完成专题制图',
    subtitle: '快速生成专题地图、调整样式、导出制图成果。',
    placeholder: '描述你的制图任务……',
  },
}

const WORK_MODE_OPTIONS = [
  { value: 'work', icon: <Boxes />, label: 'Work' },
  { value: 'code', icon: <Code />, label: 'Code' },
  { value: 'map', icon: <MapPin />, label: 'Map' },
] as const

/* ── Core API 响应类型 ── */
interface CoreConversation {
  id: string
  workspaceId?: string
  title?: string
  mode?: string
  status?: string
  createdAt?: string
  updatedAt?: string
}

interface CoreMessage {
  id: string
  conversationId?: string
  role: string
  content: string
  toolCalls?: string
  metadata?: string
  tokenCount?: number
  createdAt?: string
}

/** Core mode → 前端 WorkMode 映射。 */
function mapCoreModeToWorkMode(mode?: string): WorkMode {
  switch (mode) {
    case 'Code':
      return 'code'
    case 'Analysis':
      return 'map'
    case 'Work':
    default:
      return 'work'
  }
}

/**
 * 从 Core API 加载会话 + 消息历史。
 * 任何错误（网络/404/解析）都返回 null，由调用方降级到 localStorage。
 */
async function loadConversationFromCore(convId: string): Promise<Conversation | null> {
  try {
    const coreConv = await apiGet<CoreConversation>(`/api/conversations/${encodeURIComponent(convId)}`)
    if (!coreConv || !coreConv.id) return null

    const msgsRes = await apiGet<{ total: number; messages: CoreMessage[] }>(
      `/api/conversations/${encodeURIComponent(convId)}/messages?limit=500`,
    )
    const coreMsgs = msgsRes?.messages ?? []

    const messages: ConversationMessage[] = coreMsgs
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .map((m) => ({
        id: m.id,
        role: m.role as 'user' | 'assistant',
        content: m.content ?? '',
        status: 'done' as const,
        createdAt: m.createdAt ? Date.parse(m.createdAt) : Date.now(),
      }))

    const now = Date.now()
    return {
      id: convId,
      title: coreConv.title || '新任务',
      messages,
      model: 'Auto',
      mode: coreConv.mode ?? '通用 GIS',
      workMode: mapCoreModeToWorkMode(coreConv.mode),
      runStatus: 'idle',
      createdAt: coreConv.createdAt ? Date.parse(coreConv.createdAt) : now,
      updatedAt: coreConv.updatedAt ? Date.parse(coreConv.updatedAt) : now,
      workspaceId: coreConv.workspaceId,
      coreConversationId: coreConv.id,
    }
  } catch {
    return null
  }
}

export function NewTaskPage() {
  const { message } = App.useApp()
  const { token } = theme.useToken()
  const messageRef = useRef(message)
  messageRef.current = message

  /* ── 核心状态 ── */
  const [prompt, setPrompt] = useState('')
  const [model, setModel] = useState('Auto')
  const [workDir, setWorkDir] = useState<string | null>(null)
  const [messages, setMessages] = useState<ConversationMessage[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [runStatus, setRunStatus] = useState<RunStatus>('idle')
  const [workMode, setWorkMode] = useState<WorkMode>('work')
  const [isConversationLoading, setIsConversationLoading] = useState(false)

  /* ── 上下文选择状态 ── */
  const [selectedContexts, setSelectedContexts] = useState<SelectedContextItem[]>([])
  const [contextPickerType, setContextPickerType] = useState<ContextPickerType | null>(null)

  const MAX_TOTAL_CONTEXTS = 8
  const MAX_PER_KIND: Record<ContextPickerType, number> = { skill: 5, expert: 3, mcp: 5 }

  const hasConversation = messages.length > 0
  const abortRef = useRef<AbortController | null>(null)
  const messageListRef = useRef<HTMLDivElement>(null)
  const currentTaskIdRef = useRef<string | null>(null)
  const taskTitleRef = useRef<string>('新任务')

  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const currentConvIdRef = useRef<string | null>(null)

  /* ── 工作空间上下文（可从 location.state 继承） ── */
  const [workspaceOverride, setWorkspaceOverride] = useState<{
    workspaceId?: string
    workspaceName?: string
    workDirName?: string
  } | null>(null)

  /* ── location state 兼容（initialPrompt + resetKey + workspace） ── */
  const location = useLocation()
  const promptFilledRef = useRef(false)
  const lastResetKeyRef = useRef<number | null>(null)

  useEffect(() => {
    const state = location.state as {
      initialPrompt?: string
      resetKey?: number
      workspaceId?: string
      workspaceName?: string
      workDirName?: string
    } | null

    /* resetKey：侧栏"新任务"点击时重置会话 */
    if (state?.resetKey && state.resetKey !== lastResetKeyRef.current) {
      lastResetKeyRef.current = state.resetKey
      abortRef.current?.abort()
      setMessages([])
      setIsStreaming(false)
      setRunStatus('idle')
      setPrompt('')
      setWorkMode('work')
      /* 重置会话引用，不删除侧栏任务 */
      currentTaskIdRef.current = null
      currentConvIdRef.current = null
      taskTitleRef.current = '新任务'
      /* 清除 URL 中的 conversationId */
      if (searchParams.has('conversationId')) {
        const params = new URLSearchParams(searchParams)
        params.delete('conversationId')
        const next = params.toString()
        navigate(next ? `/new-task?${next}` : '/new-task', { replace: true })
      }
      /* 设置工作空间上下文 */
      if (state.workspaceId || state.workDirName) {
        setWorkspaceOverride({
          workspaceId: state.workspaceId,
          workspaceName: state.workspaceName,
          workDirName: state.workDirName,
        })
        if (state.workDirName) {
          setWorkDir(state.workDirName)
        }
      } else {
        setWorkspaceOverride(null)
      }
    }

    /* initialPrompt：定时任务页面传入的提示词 */
    if (state?.initialPrompt && !promptFilledRef.current) {
      setPrompt((prev) => {
        if (prev === '') {
          promptFilledRef.current = true
          messageRef.current.success('已生成定时任务提示词，请继续补充细节')
          return state.initialPrompt!
        }
        return prev
      })
    }
  }, [location.state])

  /* ── 从 URL conversationId 加载历史会话（先 Core，失败降级 localStorage） ── */
  useEffect(() => {
    const convId = searchParams.get('conversationId')
    if (!convId) return
    if (currentConvIdRef.current === convId) return

    let cancelled = false
    setIsConversationLoading(true)

    const applyConv = (conv: Conversation) => {
      if (cancelled) return
      currentConvIdRef.current = convId
      currentTaskIdRef.current = convId
      taskTitleRef.current = conv.title
      setMessages(conv.messages)
      setModel(conv.model)
      setRunStatus(conv.runStatus)
      setWorkDir(conv.workDirName ?? null)
      setWorkMode(conv.workMode ?? 'work')
      if (conv.coreConversationId) {
        setCoreConversationId(convId, conv.coreConversationId)
      }
      setIsConversationLoading(false)
    }

    const fail = () => {
      if (cancelled) return
      setIsConversationLoading(false)
      messageRef.current.error('未找到该会话记录')
      navigate('/new-task', { replace: true })
    }

    loadConversationFromCore(convId)
      .then((coreConv) => {
        if (cancelled) return
        if (coreConv) {
          setCoreConversationId(convId, coreConv.coreConversationId ?? convId)
          upsertConversation(coreConv)
          applyConv(coreConv)
          return
        }
        const localConv = getConversation(convId)
        if (localConv) {
          applyConv(localConv)
        } else {
          fail()
        }
      })
      .catch(() => {
        if (cancelled) return
        const localConv = getConversation(convId)
        if (localConv) {
          applyConv(localConv)
        } else {
          fail()
        }
      })

    return () => {
      cancelled = true
    }
  }, [searchParams, navigate])

  /* ── 自动滚动到底部 ── */
  useEffect(() => {
    const el = messageListRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages])

  /* ── 计算当前工作空间信息 ── */
  const currentWorkspaceId = workspaceOverride?.workspaceId ?? (workDir ? `workdir:${workDir}` : 'default')
  const currentWorkspaceName = workspaceOverride?.workspaceName ?? (workDir || '默认')

  /* ── 侧栏任务同步 ── */
  useEffect(() => {
    const taskId = currentTaskIdRef.current
    if (!taskId) return
    let sidebarStatus: SidebarTaskStatus = 'idle'
    if (isStreaming) {
      sidebarStatus = 'streaming'
    } else if (runStatus === 'completed') {
      sidebarStatus = 'completed'
    } else if (runStatus === 'stopped') {
      sidebarStatus = 'stopped'
    } else if (runStatus === 'failed') {
      sidebarStatus = 'failed'
    } else {
      return
    }
    upsertSidebarTask({
      id: taskId,
      title: taskTitleRef.current,
      lastMessage: messages.length > 0 ? messages[messages.length - 1].content.slice(0, 50) : '',
      status: sidebarStatus,
      updatedAt: Date.now(),
      workspaceId: currentWorkspaceId,
      workspaceName: currentWorkspaceName,
      workDirName: workDir ?? undefined,
    })
  }, [runStatus, isStreaming, messages, currentWorkspaceId, currentWorkspaceName, workDir])

  /* ── 会话持久化到 localStorage ── */
  useEffect(() => {
    const convId = currentConvIdRef.current
    if (!convId) return
    if (messages.length === 0) return
    upsertConversation({
      id: convId,
      title: taskTitleRef.current,
      messages,
      model,
      mode: '通用 GIS',
      workMode,
      workDirName: workDir ?? undefined,
      runStatus,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      workspaceId: currentWorkspaceId,
      workspaceName: currentWorkspaceName,
      /* 同步持久化 Core 会话映射，刷新后仍可复用同一 Core 会话 */
      coreConversationId: getCoreConversationId(convId),
    })
  }, [messages, runStatus, isStreaming, currentWorkspaceId, currentWorkspaceName, workDir, workMode])

  /* ── Tour refs ── */
  const [tourOpen, setTourOpen] = useState(false)
  const composerRef = useRef<HTMLDivElement>(null)
  const modeSwitcherRef = useRef<HTMLDivElement>(null)

  /* ── 引导入口（设置 → 引导 → 开始引导 携带 ?guide=1 打开工作流引导） ── */
  useEffect(() => {
    if (searchParams.get('guide') === '1') {
      setTourOpen(true)
      const params = new URLSearchParams(searchParams)
      params.delete('guide')
      const next = params.toString()
      navigate(next ? `/new-task?${next}` : '/new-task', { replace: true })
    }
  }, [searchParams, navigate])

  /* ── Typewriter ── */
  const heroText = WORK_MODE_COPY[workMode].title
  const [typedIndex, setTypedIndex] = useState(0)
  const [loop, setLoop] = useState(0)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    if (mq.matches) { setTypedIndex(heroText.length); return }
    if (typedIndex >= heroText.length) {
      const pause = setTimeout(() => { setTypedIndex(0); setLoop((l) => l + 1) }, 2000)
      return () => clearTimeout(pause)
    }
    const timer = setTimeout(() => setTypedIndex((prev) => prev + 1), 100)
    return () => clearTimeout(timer)
  }, [typedIndex, heroText.length, loop])

  /* workMode 切换时重置打字机 */
  useEffect(() => {
    setTypedIndex(0)
    setLoop((l) => l + 1)
  }, [workMode])

  /* ── 上下文管理 ── */
  const handleOpenContextPicker = (type: ContextPickerType) => {
    setContextPickerType(type)
  }

  const handleContextConfirm = (items: SelectedContextItem[]) => {
    const type = contextPickerType
    if (!type) return

    /* 移除同类型的旧选项 */
    const filtered = selectedContexts.filter((ctx) => ctx.kind !== type)
    /* 合并新选项，检查限制 */
    const perKindLimit = MAX_PER_KIND[type]
    const newItems = items.slice(0, perKindLimit)
    const merged = [...filtered, ...newItems]

    if (merged.length > MAX_TOTAL_CONTEXTS) {
      message.warning(`上下文总数最多 ${MAX_TOTAL_CONTEXTS} 个`)
      setSelectedContexts(merged.slice(0, MAX_TOTAL_CONTEXTS))
    } else {
      setSelectedContexts(merged)
    }

    setContextPickerType(null)
  }

  const handleRemoveContext = (id: string, kind: SelectedContextKind) => {
    setSelectedContexts((prev) => prev.filter((ctx) => !(ctx.id === id && ctx.kind === kind)))
  }

  const handleClearContexts = () => {
    setSelectedContexts([])
  }

  /* ── 发送消息 ── */
  const handleSend = () => {
    if (!prompt.trim()) return

    /* 首次发送：创建会话和侧栏任务 */
    if (!currentConvIdRef.current) {
      const conv = createEmptyConversation(model, '通用 GIS', workMode)
      conv.title = prompt.trim().slice(0, 20) || '新任务'
      conv.workDirName = workDir ?? undefined
      conv.workspaceId = currentWorkspaceId
      conv.workspaceName = currentWorkspaceName
      currentConvIdRef.current = conv.id
      currentTaskIdRef.current = conv.id
      taskTitleRef.current = conv.title
      upsertSidebarTask({
        id: conv.id,
        title: conv.title,
        lastMessage: prompt.trim().slice(0, 50),
        status: 'streaming',
        updatedAt: Date.now(),
        workspaceId: currentWorkspaceId,
        workspaceName: currentWorkspaceName,
        workDirName: workDir ?? undefined,
      })
      /* 同步 URL */
      navigate(`/new-task?conversationId=${encodeURIComponent(conv.id)}`, { replace: true })
    }

    const userMsg: ConversationMessage = {
      id: `msg_${Date.now()}_u`,
      role: 'user',
      content: prompt.trim(),
      createdAt: Date.now(),
      contexts: selectedContexts.length > 0 ? [...selectedContexts] : undefined,
    }
    const assistantMsg: ConversationMessage = {
      id: `msg_${Date.now()}_a`,
      role: 'assistant',
      content: '',
      status: 'streaming',
      createdAt: Date.now(),
    }

    setMessages((prev) => [...prev, userMsg, assistantMsg])
    setPrompt('')
    setIsStreaming(true)
    setRunStatus('thinking')

    /* 启动 mock streaming */
    const controller = new AbortController()
    abortRef.current = controller

    activeAdapter.start(
      {
        conversationId: currentConvIdRef.current ?? 'current',
        input: userMsg.content,
        model,
        mode: '通用 GIS',
        workMode,
        workDirName: workDir ?? undefined,
        contexts: selectedContexts.length > 0 ? selectedContexts : undefined,
      },
      {
        onDelta: (delta) => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMsg.id
                ? { ...m, content: m.content + delta }
                : m,
            ),
          )
        },
        onStatus: (status: RunStatus) => {
          setRunStatus(status)
        },
        onToolCall: (log: ToolCallLog) => {
          setMessages((prev) =>
            prev.map((m) => {
              if (m.id !== assistantMsg.id) return m
              const existing = m.toolCalls ?? []
              const idx = existing.findIndex((t) => t.id === log.id)
              if (idx >= 0) {
                /* 同 id 合并更新 */
                const updated = [...existing]
                updated[idx] = log
                return { ...m, toolCalls: updated }
              }
              return { ...m, toolCalls: [...existing, log] }
            }),
          )
        },
        onWorkflow: (steps) => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMsg.id ? { ...m, workflow: steps } : m,
            ),
          )
        },
        onDone: () => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMsg.id ? { ...m, status: 'done' as const } : m,
            ),
          )
          setIsStreaming(false)
        },
        onError: (error) => {
          setRunStatus('failed')
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMsg.id
                ? { ...m, status: 'error' as const, content: m.content + '\n\n执行出错：' + error.message }
                : m,
            ),
          )
          setIsStreaming(false)
        },
      },
      controller.signal,
    )
  }

  /* ── 停止生成 ── */
  const handleStop = () => {
    abortRef.current?.abort()
    setRunStatus('stopped')
    setMessages((prev) =>
      prev.map((m) =>
        m.status === 'streaming'
          ? { ...m, status: 'done' as const, content: m.content + '\n\n生成已停止。' }
          : m,
      ),
    )
    setIsStreaming(false)
    message.info('已停止生成')
  }

  /* ── 确认执行 ── */
  const handleConfirmRun = () => {
    setRunStatus('running')
    message.info('GeoWork 已开始前端模拟执行')
    window.setTimeout(() => {
      setRunStatus('completed')
      message.success('工作流已完成前端模拟执行')
    }, 1000)
  }

  /* ── 调整计划 ── */
  const handleAdjustPlan = () => {
    message.info('计划调整功能后续接入')
  }

  /* ── 工作目录选择 ── */
  const handlePickDirectory = async () => {
    const pickerWindow = window as { showDirectoryPicker?: (opts?: { mode?: string }) => Promise<{ kind: string; name: string }> }
    if (!pickerWindow.showDirectoryPicker) {
      message.warning('当前浏览器不支持直接选择文件夹，请使用 Chrome 或 Edge')
      return
    }
    try {
      const handle = await pickerWindow.showDirectoryPicker({ mode: 'read' })
      setWorkDir(handle.name)
      message.success(`工作目录已设置为：${handle.name}`)
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        message.info('已取消选择工作目录')
      } else {
        message.error('选择工作目录失败，请稍后重试')
      }
    }
  }

  const workDirMenu = {
    items: [
      {
        type: 'group' as const,
        label: '选择目录',
        children: [
          { key: 'choose-folder', icon: <FolderOpen />, label: '选择目录', onClick: handlePickDirectory },
        ],
      },
      {
        type: 'group' as const,
        label: '最近的目录',
        children: [
          { key: 'geo-frontend', label: 'E:\\code\\javascript\\project\\GeoFrontend2.0', onClick: () => { setWorkDir('E:\\code\\javascript\\project\\GeoFrontend2.0'); message.success('工作目录已设置') } },
          { key: 'geowork', label: 'E:\\code\\javascript\\project\\GeoWork', onClick: () => { setWorkDir('E:\\code\\javascript\\project\\GeoWork'); message.success('工作目录已设置') } },
        ],
      },
    ],
  }

  /* ── 清理 ── */
  useEffect(() => {
    return () => { abortRef.current?.abort() }
  }, [])

  /* ══════════════ Home 态 ══════════════ */
  const homeView = (
    <div className={styles.homeView}>
      {/* Animated Logo (顶部居中，循环播放) —— 主界面大 logo，暂不需要，注释掉
      <img className={styles.logoAnimated} src={logoAnimated} alt="GeoWork" />
      */}

      {/* Mode Switcher —— 使用 CapsuleTabs 胶囊组件 */}
      <div ref={modeSwitcherRef} className={styles.modeSwitcherWrap}>
        <CapsuleTabs
          options={WORK_MODE_OPTIONS.map((opt) => ({
            value: opt.value,
            icon: opt.icon,
            label: opt.label,
          }))}
          value={workMode}
          onChange={(val) => setWorkMode(val as WorkMode)}
          size="middle"
        />
      </div>

      {/* Hero */}
      <div className={styles.hero}>
        {/* heroLogo 暂时隐藏
        <svg className={styles.heroLogo} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="4" y="4" width="56" height="56" rx="8" stroke="currentColor" strokeWidth="2" opacity="0.3" />
          <line x1="4" y1="24" x2="60" y2="24" stroke="currentColor" strokeWidth="1.5" opacity="0.25" />
          <line x1="4" y1="44" x2="60" y2="44" stroke="currentColor" strokeWidth="1.5" opacity="0.25" />
          <line x1="24" y1="4" x2="24" y2="60" stroke="currentColor" strokeWidth="1.5" opacity="0.25" />
          <line x1="44" y1="4" x2="44" y2="60" stroke="currentColor" strokeWidth="1.5" opacity="0.25" />
          <circle cx="32" cy="28" r="5" fill={token.colorPrimary} opacity="0.85" />
          <path d="M32 33 L28 28 A4 4 0 1 1 36 28 Z" fill={token.colorPrimary} />
          <path d="M12 50 L32 40 L52 50 L32 60 Z" stroke="currentColor" strokeWidth="1.5" fill={token.colorPrimary} opacity="0.12" />
          <path d="M12 46 L32 36 L52 46" stroke="currentColor" strokeWidth="1.5" opacity="0.3" fill="none" />
        </svg>
        */}
        <Title level={2} className={styles.heroTitle} style={{ color: token.colorText }}>
          {heroText.slice(0, typedIndex)}
          <span className={styles.typewriterCursor} style={{ color: token.colorPrimary, fontWeight: 400 }}>▎</span>
        </Title>
        <Text type="secondary" className={styles.heroSubtitle}>
          {WORK_MODE_COPY[workMode].subtitle}
        </Text>
      </div>

      {/* Composer */}
      <div ref={composerRef} className={styles.homeComposerWrap}>
        <div className={styles.homeComposerInner}>
          <ChatComposer
            prompt={prompt}
            onPromptChange={setPrompt}
            onSend={handleSend}
            onStop={handleStop}
            isStreaming={isStreaming}
            model={model}
            onModelChange={setModel}
            placeholder={WORK_MODE_COPY[workMode].placeholder}
            onOpenContextPicker={handleOpenContextPicker}
            onPickDirectory={handlePickDirectory}
            selectedContexts={selectedContexts}
            onRemoveContext={handleRemoveContext}
            onClearContexts={handleClearContexts}
          />
        </div>
      </div>

      {/* Work Dir */}
      <div className={styles.workDirRow}>
        <Dropdown menu={workDirMenu} trigger={['click']} placement="topLeft" getPopupContainer={() => document.body}>
          <Button type="text" size="small" icon={<FolderOpen />} shape="round">
            {workDir ? workDir : '选择工作目录'}
          </Button>
        </Dropdown>
        <Text type="secondary" style={{ fontSize: 12 }}>
          {workDir ? `当前工作目录：${workDir}` : '未选择工作目录'}
        </Text>
      </div>
    </div>
  )

  /* ══════════════ Conversation 态 ══════════════ */
  const conversationView = (
    <div className={styles.conversationView}>
      {/* Header */}
      <div
        className={styles.convHeader}
        style={{ borderBottom: `1px solid ${token.colorBorderSecondary}` }}
      >
        <div className={styles.convHeaderLeft}>
          <Title level={5} className={styles.convHeaderTitle}>新任务</Title>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {model} · {workDir ?? '未选择目录'}
          </Text>
          {isStreaming && (
            <CapsuleTag color="processing" icon={<Loader2 />}>
              {runStatus === 'thinking' ? '理解任务' : runStatus === 'planning' ? '生成计划' : '思考中'}
            </CapsuleTag>
          )}
          {!isStreaming && runStatus === 'waiting-confirmation' && (
            <CapsuleTag color="warning">等待确认</CapsuleTag>
          )}
          {!isStreaming && runStatus === 'running' && (
            <CapsuleTag color="processing" icon={<Loader2 />}>执行中</CapsuleTag>
          )}
          {!isStreaming && runStatus === 'completed' && (
            <CapsuleTag color="success">已完成</CapsuleTag>
          )}
          {!isStreaming && runStatus === 'stopped' && (
            <CapsuleTag>已停止</CapsuleTag>
          )}
          {!isStreaming && runStatus === 'failed' && (
            <CapsuleTag color="error">失败</CapsuleTag>
          )}
        </div>
      </div>

      {/* Message List */}
      <div className={styles.messageList} ref={messageListRef}>
        {messages.map((msg, idx) => {
          /* 找到最后一条 assistant message 的索引 */
          let lastAssistantIdx = -1
          for (let i = messages.length - 1; i >= 0; i--) {
            if (messages[i].role === 'assistant') {
              lastAssistantIdx = i
              break
            }
          }
          return (
            <ConversationMessageView
              key={msg.id}
              data={msg}
              runStatus={idx === lastAssistantIdx ? runStatus : undefined}
              onConfirmRun={idx === lastAssistantIdx ? handleConfirmRun : undefined}
              onAdjustPlan={idx === lastAssistantIdx ? handleAdjustPlan : undefined}
              isLastAssistant={idx === lastAssistantIdx}
            />
          )
        })}
      </div>

      {/* Work Dir Row */}
      <div className={styles.workDirRowConv}>
        <Dropdown menu={workDirMenu} trigger={['click']} placement="topLeft" getPopupContainer={() => document.body}>
          <Button type="text" size="small" icon={<FolderOpen />} shape="round">
            {workDir ? workDir : '选择工作目录'}
          </Button>
        </Dropdown>
        <Text type="secondary" style={{ fontSize: 12 }}>
          {workDir ? `当前工作目录：${workDir}` : '未选择工作目录'}
        </Text>
      </div>

      {/* Composer */}
      <div className={styles.composerArea}>
        <ChatComposer
          prompt={prompt}
          onPromptChange={setPrompt}
          onSend={handleSend}
          onStop={handleStop}
          isStreaming={isStreaming}
          model={model}
          onModelChange={setModel}
          conversationMode
          placeholder={WORK_MODE_COPY[workMode].placeholder}
          onOpenContextPicker={handleOpenContextPicker}
          onPickDirectory={handlePickDirectory}
          selectedContexts={selectedContexts}
          onRemoveContext={handleRemoveContext}
          onClearContexts={handleClearContexts}
        />
      </div>
    </div>
  )

  return (
    <div
      className={styles.root}
      style={{ background: token.colorBgLayout }}
    >
      {isConversationLoading && !isStreaming && messages.length === 0 ? (
        <PageSkeleton variant="conversation" />
      ) : hasConversation ? conversationView : homeView}

      {/* Tour */}
      <Tour
        open={tourOpen}
        onClose={() => setTourOpen(false)}
        steps={[
          {
            target: () => composerRef.current!,
            title: '输入任务描述',
            description: '在这里用自然语言描述您的 GIS 任务，例如缓冲区分析、专题制图等。',
            placement: 'bottom',
          },
          {
            target: () => modeSwitcherRef.current!,
            title: '选择工作模式',
            description: '根据任务类型在 Work / Code / Map 之间切换，GeoWork 会匹配对应的空间分析工具。',
            placement: 'bottom',
          },
        ]}
      />

      {/* 上下文选择弹窗 */}
      {contextPickerType && (
        <ContextPickerModal
          open={contextPickerType !== null}
          type={contextPickerType}
          selectedIds={selectedContexts.filter((c) => c.kind === contextPickerType).map((c) => c.id)}
          onCancel={() => setContextPickerType(null)}
          onConfirm={handleContextConfirm}
        />
      )}
    </div>
  )
}

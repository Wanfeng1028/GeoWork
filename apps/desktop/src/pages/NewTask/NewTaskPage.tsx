import { useEffect, useRef, useState } from 'react'
import { useLocation, useSearchParams, useNavigate } from 'react-router'
import { Alert, App, Button, Dropdown, Tour, Typography, theme } from 'antd'
import { Loader2, FolderOpen, Boxes, Code, MapPin } from 'lucide-react'
import { ChatComposer } from './components/ChatComposer'
import { ContextPickerModal } from './components/ContextPickerModal'
import type { ContextPickerType } from './components/ContextPickerModal'
import { ConversationMessageView } from './components/ConversationMessage'
import { ApprovalCard } from './components/ApprovalCard'
import { sessionManager } from '../../shared/session/SessionManager'
import { useSession } from '../../shared/session/react'
import { readConversation } from '../../shared/session/conversationCache'
import type { SelectedContextItem, WorkMode } from '../../shared/session/types'
import { useTaskStore } from '../../shared/stores/taskStore'
import { loadSettings, updateSettingsPatch } from '../Settings/settingsStorage'
import { CapsuleTabs } from '../../shell/components/CapsuleTabs'
import { CapsuleTag } from '../../shell/components/CapsuleTag'
import { PageSkeleton } from '../../shell/feedback'
import styles from './NewTaskPage.module.css'

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

const MAX_RECENT_DIRS = 5

function makeConversationId(): string {
  return `conv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

export function NewTaskPage() {
  const { message } = App.useApp()
  const { token } = theme.useToken()
  const messageRef = useRef(message)
  messageRef.current = message

  /* ── 会话接线：流式状态住进对象层，组件只订阅快照 ── */
  const [convId, setConvId] = useState<string | null>(null)
  const convIdRef = useRef<string | null>(null)
  const snap = useSession(convId)
  const messages = snap.messages
  const runStatus = snap.runStatus
  const isStreaming =
    runStatus === 'thinking' || runStatus === 'planning' || runStatus === 'running'
  const isConversationLoading = snap.phase === 'loading' && messages.length === 0

  /* ── 本地 UI 瞬时态（输入/选择，不进对象层） ── */
  const [prompt, setPrompt] = useState('')
  const [model, setModel] = useState('Auto')
  const [workDir, setWorkDir] = useState<string | null>(null)
  const [workMode, setWorkMode] = useState<WorkMode>('work')
  const [selectedContexts, setSelectedContexts] = useState<SelectedContextItem[]>([])
  const [contextPickerType, setContextPickerType] = useState<ContextPickerType | null>(null)
  const [recentDirs, setRecentDirs] = useState<string[]>(() => loadSettings().recentWorkDirs)

  const MAX_TOTAL_CONTEXTS = 8
  const MAX_PER_KIND: Record<ContextPickerType, number> = { skill: 5, expert: 3, mcp: 5 }

  const hasConversation = messages.length > 0
  const messageListRef = useRef<HTMLDivElement>(null)

  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

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

    /* resetKey：侧栏"新任务"点击时销毁会话对象并重置 UI */
    if (state?.resetKey && state.resetKey !== lastResetKeyRef.current) {
      lastResetKeyRef.current = state.resetKey
      if (convIdRef.current) sessionManager.reset(convIdRef.current)
      convIdRef.current = null
      setConvId(null)
      setPrompt('')
      setWorkMode('work')
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
        if (state.workDirName) setWorkDir(state.workDirName)
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
  }, [location.state, searchParams, navigate])

  /* ── 从 URL conversationId 加载历史会话（对象层 open：core → cache → error） ── */
  useEffect(() => {
    const urlId = searchParams.get('conversationId')
    if (!urlId || urlId === convIdRef.current) return
    convIdRef.current = urlId
    setConvId(urlId)
    void sessionManager.ensure(urlId).open()
  }, [searchParams])

  /* ── 会话元数据恢复（model/workDir/workMode 从缓存回填 UI 选择器） ── */
  useEffect(() => {
    if (!convId || (snap.phase !== 'live' && snap.phase !== 'frozen')) return
    const cached = readConversation(convId)
    if (!cached) return
    setModel(cached.model || 'Auto')
    setWorkDir(cached.workDirName ?? null)
    setWorkMode(cached.workMode ?? 'work')
  }, [convId, snap.phase])

  /* ── 自动滚动到底部 ── */
  useEffect(() => {
    const el = messageListRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages])

  /* ── 计算当前工作空间信息 ── */
  const currentWorkspaceId =
    workspaceOverride?.workspaceId ?? (workDir ? `workdir:${workDir}` : 'default')
  const currentWorkspaceName = workspaceOverride?.workspaceName ?? (workDir || '默认')

  /* TODO(P5)：会话状态 → 侧栏任务的同步将迁入 taskStore 订阅，替代旧 effect */

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

  /* ── Hero 文案 ── */
  const heroText = WORK_MODE_COPY[workMode].title

  /* ── 上下文管理 ── */
  const handleContextConfirm = (items: SelectedContextItem[]) => {
    const type = contextPickerType
    if (!type) return
    const filtered = selectedContexts.filter((ctx) => ctx.kind !== type)
    const merged = [...filtered, ...items.slice(0, MAX_PER_KIND[type])]
    if (merged.length > MAX_TOTAL_CONTEXTS) {
      message.warning(`上下文总数最多 ${MAX_TOTAL_CONTEXTS} 个`)
      setSelectedContexts(merged.slice(0, MAX_TOTAL_CONTEXTS))
    } else {
      setSelectedContexts(merged)
    }
    setContextPickerType(null)
  }

  const handleRemoveContext = (id: string, kind: SelectedContextItem['kind']) => {
    setSelectedContexts((prev) => prev.filter((ctx) => !(ctx.id === id && ctx.kind === kind)))
  }

  /* ── 发送消息：乐观插入与流式状态均由 Session 驱动 ── */
  const handleSend = () => {
    const text = prompt.trim()
    if (!text) return

    let id = convIdRef.current
    if (!id) {
      id = makeConversationId()
      convIdRef.current = id
      setConvId(id)
      useTaskStore.getState().upsertLocal({
        id,
        title: text.slice(0, 20) || '新任务',
        lastMessage: text.slice(0, 50),
        status: 'streaming',
        updatedAt: Date.now(),
        workspaceId: currentWorkspaceId,
        workspaceName: currentWorkspaceName,
        workDirName: workDir ?? undefined,
      })
      navigate(`/new-task?conversationId=${encodeURIComponent(id)}`, { replace: true })
    }

    void sessionManager.ensure(id).send(text, {
      model,
      mode: '通用 GIS',
      workMode,
      workDirName: workDir ?? undefined,
      workspaceId: currentWorkspaceId,
      workspaceName: currentWorkspaceName,
      contexts: selectedContexts.length > 0 ? selectedContexts : undefined,
    })
    setPrompt('')
  }

  /* ── 停止生成 ── */
  const handleStop = () => {
    const id = convIdRef.current
    if (!id) return
    sessionManager.ensure(id).cancel()
    message.info('已停止生成')
  }

  /* ── 确认执行（D2）：轮询真实 run 状态，不再 setTimeout 假完成 ── */
  const handleConfirmRun = async () => {
    const id = convIdRef.current
    const runId = id ? sessionManager.get(id)?.getSnapshot().currentRunId : undefined
    if (!id || !runId) {
      message.warning('无可执行的运行（Core 未返回 runId）')
      return
    }
    message.info('已开始执行，正在跟踪运行状态')
    try {
      await sessionManager.ensure(id).confirmRun()
      if (sessionManager.get(id)?.getSnapshot().runStatus === 'completed') {
        message.success('工作流已执行完成')
      }
    } catch {
      message.error('运行状态查询失败')
    }
  }

  /* ── 调整计划 ── */
  const handleAdjustPlan = () => {
    message.info('计划调整功能后续接入')
  }

  /* ── 工作目录选择（最近目录来自 settingsStorage，不再硬编码开发机路径） ── */
  const rememberWorkDir = (dir: string) => {
    const next = [dir, ...recentDirs.filter((d) => d !== dir)].slice(0, MAX_RECENT_DIRS)
    setRecentDirs(next)
    updateSettingsPatch({ recentWorkDirs: next })
  }

  const handlePickDirectory = async () => {
    const pickerWindow = window as {
      showDirectoryPicker?: (opts?: { mode?: string }) => Promise<{ kind: string; name: string }>
    }
    if (!pickerWindow.showDirectoryPicker) {
      message.warning('当前浏览器不支持直接选择文件夹，请使用 Chrome 或 Edge')
      return
    }
    try {
      const handle = await pickerWindow.showDirectoryPicker({ mode: 'read' })
      setWorkDir(handle.name)
      rememberWorkDir(handle.name)
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
          {
            key: 'choose-folder',
            icon: <FolderOpen />,
            label: '选择目录',
            onClick: handlePickDirectory,
          },
        ],
      },
      {
        type: 'group' as const,
        label: '最近的目录',
        children:
          recentDirs.length > 0
            ? recentDirs.map((dir) => ({
                key: dir,
                label: dir,
                onClick: () => {
                  setWorkDir(dir)
                  message.success('工作目录已设置')
                },
              }))
            : [{ key: 'empty', label: '暂无最近目录', disabled: true }],
      },
    ],
  }

  /* ── 通道提示条：演示模式标注（D1）与离线黄条（frozen/error） ── */
  const channelBanner = snap.isDemo ? (
    <Alert
      type="warning"
      showIcon
      banner
      message="演示模式（未连接后端）——当前输出为本地模拟，不代表真实执行"
    />
  ) : snap.phase === 'frozen' || snap.phase === 'error' ? (
    <Alert
      type="warning"
      showIcon
      banner
      message={snap.lastError ?? 'GeoWork Core 不可达，已暂停接收新输出'}
    />
  ) : null

  /* ══════════════ Home 态 ══════════════ */
  const homeView = (
    <div className={styles.homeView}>
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
        <Title level={2} className={styles.heroTitle} style={{ color: token.colorText }}>
          {heroText}
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
            onOpenContextPicker={setContextPickerType}
            onPickDirectory={handlePickDirectory}
            selectedContexts={selectedContexts}
            onRemoveContext={handleRemoveContext}
            onClearContexts={() => setSelectedContexts([])}
          />
        </div>
      </div>

      {/* Work Dir */}
      <div className={styles.workDirRow}>
        <Dropdown
          menu={workDirMenu}
          trigger={['click']}
          placement="topLeft"
          getPopupContainer={() => document.body}
        >
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
          <Title level={5} className={styles.convHeaderTitle}>
            {snap.title}
          </Title>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {model} · {workDir ?? '未选择目录'}
          </Text>
          {isStreaming && (
            <CapsuleTag color="processing" icon={<Loader2 />}>
              {runStatus === 'thinking'
                ? '理解任务'
                : runStatus === 'planning'
                  ? '生成计划'
                  : '执行中'}
            </CapsuleTag>
          )}
          {!isStreaming && runStatus === 'waiting-confirmation' && (
            <CapsuleTag color="warning">等待确认</CapsuleTag>
          )}
          {!isStreaming && runStatus === 'completed' && (
            <CapsuleTag color="success">已完成</CapsuleTag>
          )}
          {!isStreaming && runStatus === 'stopped' && <CapsuleTag>已停止</CapsuleTag>}
          {!isStreaming && runStatus === 'failed' && <CapsuleTag color="error">失败</CapsuleTag>}
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

      {/* A1 审批卡片：governar approval_request 事件驱动 */}
      {snap.pendingApproval && (
        <ApprovalCard
          approval={snap.pendingApproval}
          onResolve={(approved, reason) => {
            const id = convIdRef.current
            if (!id) return Promise.reject(new Error('无活动会话'))
            return sessionManager.ensure(id).resolveApproval(approved, reason)
          }}
        />
      )}

      {/* Work Dir Row */}
      <div className={styles.workDirRowConv}>
        <Dropdown
          menu={workDirMenu}
          trigger={['click']}
          placement="topLeft"
          getPopupContainer={() => document.body}
        >
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
          onOpenContextPicker={setContextPickerType}
          onPickDirectory={handlePickDirectory}
          selectedContexts={selectedContexts}
          onRemoveContext={handleRemoveContext}
          onClearContexts={() => setSelectedContexts([])}
        />
      </div>
    </div>
  )

  return (
    <div className={styles.root} style={{ background: token.colorBgLayout }}>
      {channelBanner}
      {isConversationLoading && !isStreaming && messages.length === 0 ? (
        <PageSkeleton variant="conversation" />
      ) : hasConversation ? (
        conversationView
      ) : (
        homeView
      )}

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
            description:
              '根据任务类型在 Work / Code / Map 之间切换，GeoWork 会匹配对应的空间分析工具。',
            placement: 'bottom',
          },
        ]}
      />

      {/* 上下文选择弹窗 */}
      {contextPickerType && (
        <ContextPickerModal
          open={contextPickerType !== null}
          type={contextPickerType}
          selectedIds={selectedContexts
            .filter((c) => c.kind === contextPickerType)
            .map((c) => c.id)}
          onCancel={() => setContextPickerType(null)}
          onConfirm={handleContextConfirm}
        />
      )}
    </div>
  )
}

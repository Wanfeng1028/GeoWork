/**
 * Session — 会话状态机（React-free，doc/21 §P2）
 *
 * 吸收原 streamAdapters.realStreamAdapter 的全部执行链路：
 *   ensureCoreConversation → POST messages → 订阅 /events SSE → 事件驱动状态机
 *
 * 快照契约：getSnapshot() 永远返回缓存引用（useSyncExternalStore 要求），
 * 状态变更经 Notifier 微任务合批后重建快照并通知。差分纪律：未变更的
 * ConversationMessage 对象引用不动。
 *
 * 数据通道（SessionPhase）：
 *   live   core 在线正常收发；frozen core 不可达但有本地缓存（只读）；
 *   error  core 不可达且无缓存。宁可诚实地空着，不假装在工作。
 */

import { coreEventSource, coreFetch } from '../api/coreApi'
import type {
  CoreConversation,
  CoreEventPayload,
  CoreMessageListResponse,
  CorePostMessageResponse,
  CoreRun,
  CoreRunStep,
} from '../api/types'
import { mockStreamAdapter } from './demoAdapter'
import { isDemoModeEnabled } from './demoMode'
import { readConversation, writeConversation } from './conversationCache'
import { Notifier } from './notifier'
import type {
  Conversation,
  ConversationMessage,
  ConversationSnapshot,
  ObservableSnapshot,
  RunStatus,
  SendOptions,
  SessionPhase,
  StreamAdapterCallbacks,
  ToolCallLog,
  WorkflowStep,
  WorkMode,
} from './types'

/* ── 传输抽象（生产走 coreApi，测试注入 fake） ── */

export interface EventSourceLike {
  addEventListener(type: string, listener: (event: { data?: string }) => void): void
  close(): void
}

export interface SessionTransport {
  fetchJson(
    path: string,
    init?: { method?: 'GET' | 'POST'; body?: unknown; signal?: AbortSignal },
  ): Promise<{ ok: boolean; status: number; data?: unknown }>
  openEvents(path: string): EventSourceLike
}

const defaultTransport: SessionTransport = {
  async fetchJson(path, init) {
    const res = await coreFetch(path, {
      method: init?.method ?? 'GET',
      headers: init?.body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
      signal: init?.signal,
    })
    let data: unknown
    try {
      data = await res.json()
    } catch {
      data = undefined
    }
    return { ok: res.ok, status: res.status, data }
  },
  openEvents(path) {
    return coreEventSource(path) as unknown as EventSourceLike
  },
}

export interface SessionOptions {
  transport?: SessionTransport
  /** 已知的 Core 会话 id（URL 直连/缓存恢复时注入，避免重复建会话） */
  coreId?: string
  /** SSE 断线重连退避基数（毫秒），默认 500 */
  resyncBaseMs?: number
  /** 退避上限，默认 10s */
  resyncMaxMs?: number
  /** D2 确认执行的 run 状态轮询间隔（毫秒），默认 1000 */
  confirmPollMs?: number
}

/** 前端 WorkMode → orchestrator mode 映射。 */
export function mapWorkModeToMode(workMode?: WorkMode): string {
  switch (workMode) {
    case 'code':
      return 'Code'
    case 'map':
      return 'Analysis'
    case 'work':
    default:
      return 'Work'
  }
}

/** Core mode → 前端 WorkMode 映射。 */
export function mapCoreModeToWorkMode(mode?: string): WorkMode {
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

/** Core Run status（aiagent.Status）→ 前端 RunStatus 映射（D2 轮询用）。 */
export function mapRunStatus(status: string): RunStatus {
  switch (status) {
    case 'completed':
      return 'completed'
    case 'failed':
      return 'failed'
    case 'stopped':
      return 'stopped'
    case 'paused':
      return 'waiting-confirmation'
    case 'pending':
    case 'running':
    case 'recovery':
    default:
      return 'running'
  }
}

let messageSeq = 0
function nextMessageId(suffix: string): string {
  messageSeq += 1
  return `msg_${Date.now()}_${messageSeq}_${suffix}`
}

export class Session implements ObservableSnapshot<ConversationSnapshot> {
  readonly id: string

  private transport: SessionTransport
  private resyncBaseMs: number
  private resyncMaxMs: number

  private coreId: string | undefined
  private phase: SessionPhase = 'idle'
  private runStatus: RunStatus = 'idle'
  private title = '新任务'
  private messages: ConversationMessage[] = []
  private meta: SendOptions = {}
  private demo = false
  private lastError: string | undefined
  private currentRunId: string | undefined
  private createdAt = Date.now()

  private notifier = new Notifier()
  private snapshot: ConversationSnapshot
  private es: EventSourceLike | null = null
  private abortController: AbortController | null = null
  private resyncTimer: ReturnType<typeof setTimeout> | null = null
  private resyncAttempts = 0
  private confirmPollMs: number
  private pollToken = 0
  private disposed = false

  constructor(id: string, opts: SessionOptions = {}) {
    this.id = id
    this.transport = opts.transport ?? defaultTransport
    this.coreId = opts.coreId
    this.resyncBaseMs = opts.resyncBaseMs ?? 500
    this.resyncMaxMs = opts.resyncMaxMs ?? 10_000
    this.confirmPollMs = opts.confirmPollMs ?? 1_000
    this.snapshot = this.buildSnapshot()
  }

  /* ══════════ 快照契约 ══════════ */

  getSnapshot(): ConversationSnapshot {
    return this.snapshot
  }

  subscribe(fn: () => void): () => void {
    return this.notifier.subscribe(fn)
  }

  /** 同步执行挂起的合批刷新（测试与用户手势回显用）。 */
  flushSync(): void {
    this.notifier.flushSync()
  }

  get coreConversationId(): string | undefined {
    return this.coreId
  }

  /** 采纳外部已知的 Core 会话映射（URL 直连恢复缓存）。 */
  adoptCoreId(coreId: string): void {
    if (this.coreId === coreId) return
    this.coreId = coreId
    this.commit()
  }

  /* ══════════ open：加载会话（core → cache → error 三级） ══════════ */

  async open(): Promise<void> {
    if (this.disposed) return
    this.phase = 'loading'
    this.commit()

    const core = await this.tryLoadFromCore(this.coreId ?? this.id)
    if (this.disposed) return
    if (core) {
      this.adoptCoreConversation(core)
      this.phase = 'live'
      this.resyncAttempts = 0
      this.persist()
      this.commit()
      return
    }

    const cached = readConversation(this.id)
    if (cached) {
      this.adoptLocal(cached)
      this.phase = 'frozen'
      this.lastError = 'GeoWork Core 不可达，正在显示本地缓存'
      this.commit()
      return
    }

    this.phase = 'error'
    this.lastError = 'GeoWork Core 不可达，且无本地缓存'
    this.commit()
  }

  /** GET conversation + messages；任何失败返回 null（含 404：URL id 非 core id）。 */
  private async tryLoadFromCore(coreId: string): Promise<Conversation | null> {
    try {
      const convRes = await this.transport.fetchJson(
        `/api/conversations/${encodeURIComponent(coreId)}`,
      )
      if (!convRes.ok) return null
      const coreConv = convRes.data as CoreConversation
      if (!coreConv || !coreConv.id) return null

      const msgsRes = await this.transport.fetchJson(
        `/api/conversations/${encodeURIComponent(coreId)}/messages?limit=500`,
      )
      const coreMsgs = (msgsRes.data as CoreMessageListResponse | undefined)?.messages ?? []

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
        id: this.id,
        title: coreConv.title || '新任务',
        messages,
        model: this.meta.model ?? 'Auto',
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

  /* ══════════ send：乐观插入 + core 执行链 + D1 分支 ══════════ */

  async send(input: string, opts: SendOptions = {}, cb?: StreamAdapterCallbacks): Promise<void> {
    if (this.disposed) return
    const text = input.trim()
    if (!text) return
    this.meta = { ...this.meta, ...opts }

    const assistantId = nextMessageId('a')
    const userMsg: ConversationMessage = {
      id: nextMessageId('u'),
      role: 'user',
      content: text,
      createdAt: Date.now(),
      contexts: opts.contexts,
    }
    const assistantMsg: ConversationMessage = {
      id: assistantId,
      role: 'assistant',
      content: '',
      status: 'streaming',
      createdAt: Date.now(),
    }
    if (!this.messages.length) this.title = text.slice(0, 20) || '新任务'

    this.messages = [...this.messages, userMsg, assistantMsg]
    this.runStatus = 'thinking'
    this.commit()
    cb?.onStatus?.('thinking')

    this.clearResyncTimer()
    const controller = new AbortController()
    this.abortController = controller

    try {
      const coreId = await this.ensureCoreConversation(text, controller.signal)
      const mode = mapWorkModeToMode(opts.workMode ?? this.meta.workMode)

      const res = await this.transport.fetchJson(
        `/api/conversations/${encodeURIComponent(coreId)}/messages`,
        { method: 'POST', body: { content: text, mode }, signal: controller.signal },
      )
      if (!res.ok) throw new Error(`send message failed: HTTP ${res.status}`)
      const body = (res.data ?? {}) as CorePostMessageResponse
      if (body.error) throw new Error(body.error)

      this.currentRunId = body.runId
      this.phase = 'live'
      this.runStatus = 'planning'
      this.commit()
      cb?.onStatus?.('planning')

      await this.subscribeEvents(coreId, body.runId, assistantId, cb, controller.signal)
    } catch (err) {
      if (controller.signal.aborted || this.disposed) return
      this.handleSendFailure(err, assistantId, cb, controller.signal)
    } finally {
      if (this.abortController === controller) this.abortController = null
    }
  }

  /** send 初始阶段失败：D1 演示分支 / 诚实失败。 */
  private async handleSendFailure(
    err: unknown,
    assistantId: string,
    cb: StreamAdapterCallbacks | undefined,
    signal: AbortSignal,
  ): Promise<void> {
    const message = err instanceof Error ? err.message : String(err)

    if (isDemoModeEnabled()) {
      this.demo = true
      this.degradePhase('演示模式：未连接 GeoWork Core')
      this.commit()
      await this.runDemo(assistantId, cb, signal)
      return
    }

    this.demo = false
    this.degradePhase(message)
    this.runStatus = 'failed'
    this.failAssistantMessage(assistantId, message)
    this.persist()
    this.commit()
    cb?.onError(new Error(message))
  }

  /** D1：演示模式走 mock 流式，快照标注 isDemo。 */
  private async runDemo(
    assistantId: string,
    cb: StreamAdapterCallbacks | undefined,
    signal: AbortSignal,
  ): Promise<void> {
    await mockStreamAdapter.start(
      {
        conversationId: this.id,
        input: this.messages.find((m) => m.id === assistantId)?.content ?? this.title,
        model: this.meta.model ?? 'Auto',
        mode: this.meta.mode ?? '通用 GIS',
        workMode: this.meta.workMode,
        workDirName: this.meta.workDirName,
        contexts: this.meta.contexts,
      },
      {
        onDelta: (delta) => this.appendDelta(assistantId, delta, cb),
        onDone: () => {
          this.finishAssistantMessage(assistantId, 'waiting-confirmation', cb)
          this.persist()
          this.commit()
        },
        onError: (error) => {
          this.runStatus = 'failed'
          this.failAssistantMessage(assistantId, error.message)
          this.persist()
          this.commit()
          cb?.onError(error)
        },
        onStatus: (status) => {
          this.runStatus = status
          this.commit()
          cb?.onStatus?.(status)
        },
        onToolCall: (log) => {
          this.upsertToolCall(assistantId, log)
          cb?.onToolCall?.(log)
        },
        onWorkflow: (steps) => {
          this.applyWorkflow(assistantId, steps)
          cb?.onWorkflow?.(steps)
        },
      },
      signal,
    )
  }

  /** 确保 Core 会话存在：首次发送时创建并缓存映射（迁自 realStreamAdapter）。 */
  private async ensureCoreConversation(input: string, signal: AbortSignal): Promise<string> {
    if (this.coreId) return this.coreId
    const mode = mapWorkModeToMode(this.meta.workMode)
    const res = await this.transport.fetchJson('/api/conversations', {
      method: 'POST',
      body: {
        workspaceId: this.meta.workspaceId ?? 'default',
        title: input.slice(0, 40) || '新任务',
        mode,
      },
      signal,
    })
    if (!res.ok) throw new Error(`create conversation failed: HTTP ${res.status}`)
    const conv = (res.data ?? {}) as { id?: string }
    if (!conv.id) throw new Error('create conversation failed: empty id')
    this.coreId = conv.id
    this.commit()
    return conv.id
  }

  /* ══════════ SSE 订阅与事件状态机（迁自 realStreamAdapter L520-629） ══════════ */

  private subscribeEvents(
    coreId: string,
    runId: string | undefined,
    assistantId: string,
    cb: StreamAdapterCallbacks | undefined,
    signal: AbortSignal,
  ): Promise<void> {
    return new Promise<void>((resolve) => {
      if (signal.aborted) {
        resolve()
        return
      }

      const es = this.transport.openEvents(
        `/api/conversations/${encodeURIComponent(coreId)}/events`,
      )
      this.es = es
      let resolved = false
      const finish = () => {
        if (resolved) return
        resolved = true
        es.close()
        if (this.es === es) this.es = null
        resolve()
      }

      signal.addEventListener('abort', finish)

      const parse = (e: { data?: string }): CoreEventPayload => {
        try {
          return JSON.parse(e.data ?? '') as CoreEventPayload
        } catch {
          return { type: 'unknown' }
        }
      }

      // 计划就绪：拉取 run 详情填充工作流步骤
      es.addEventListener('plan', () => {
        this.runStatus = 'planning'
        this.commit()
        cb?.onStatus?.('planning')
        if (!runId) return
        this.transport
          .fetchJson(`/api/agent/runs/${encodeURIComponent(runId)}`)
          .then((r) => (r.ok ? r.data : null))
          .then((run) => {
            const steps = (run as CoreRun | null)?.plan
            if (!steps || steps.length === 0) return
            this.applyWorkflow(
              assistantId,
              steps.map((s: CoreRunStep, idx) => this.mapRunStepToWorkflowStep(s, idx)),
            )
            const workflow = this.findMessage(assistantId)?.workflow
            if (workflow) cb?.onWorkflow?.(workflow)
          })
          .catch(() => {
            /* 拉取计划失败不影响主流程 */
          })
      })

      // 步骤开始：登记 running 工具调用
      es.addEventListener('step_start', (e) => {
        const d = (parse(e).data ?? {}) as Record<string, unknown>
        const log: ToolCallLog = {
          id: String(d.stepId ?? `step-${Date.now()}`),
          name: String(d.title ?? d.tool ?? '执行步骤'),
          status: 'running',
          inputSummary: d.tool ? `工具：${String(d.tool)}` : '',
          startedAt: Date.now(),
        }
        this.upsertToolCall(assistantId, log)
        this.runStatus = 'running'
        this.commit()
        cb?.onToolCall?.(log)
        cb?.onStatus?.('running')
      })

      // 步骤完成：更新工具调用为 success
      es.addEventListener('step_done', (e) => {
        const d = (parse(e).data ?? {}) as Record<string, unknown>
        const prev = this.findMessage(assistantId)?.toolCalls?.find(
          (t) => t.id === String(d.stepId ?? ''),
        )
        const log: ToolCallLog = {
          id: String(d.stepId ?? `step-${Date.now()}`),
          name: String(d.title ?? d.tool ?? '执行步骤'),
          status: 'success',
          inputSummary: d.tool ? `工具：${String(d.tool)}` : '',
          outputSummary: d.duration ? `耗时 ${String(d.duration)}ms` : '已完成',
          startedAt: prev?.startedAt ?? Date.now(),
          endedAt: Date.now(),
        }
        this.upsertToolCall(assistantId, log)
        cb?.onToolCall?.(log)
      })

      // 完成：输出摘要、终态落盘（唯一常规写点）
      es.addEventListener('done', (e) => {
        const evt = parse(e)
        this.appendDelta(assistantId, `\n\n✅ 执行完成（run: ${runIdOf(evt, runId)}）`, cb)
        this.finishAssistantMessage(assistantId, 'completed', cb)
        this.phase = 'live'
        this.resyncAttempts = 0
        this.persist()
        this.commit()
        finish()
      })

      // 服务端 error 事件（MessageEvent 带 data）vs 连接级中断
      es.addEventListener('error', (e) => {
        if (signal.aborted || this.disposed) {
          finish()
          return
        }
        const me = e as { data?: string }
        if (me && typeof me.data === 'string') {
          const evt = parse(me)
          const message = evt.error || evt.message || '执行失败'
          this.runStatus = 'failed'
          this.failAssistantMessage(assistantId, message)
          this.persist()
          this.commit()
          cb?.onError(new Error(message))
        } else {
          // 连接级错误：冻结当前视图，指数退避重连（500ms×2 → 10s）
          this.lastError = '与 GeoWork Core 的连接中断，正在重连…'
          this.commit()
          this.scheduleResync()
        }
        finish()
      })
    })
  }

  private mapRunStepToWorkflowStep(s: CoreRunStep, idx: number): WorkflowStep {
    return {
      key: s.id || `step-${idx}`,
      title: s.title || s.tool || `步骤 ${idx + 1}`,
      description: s.tool ? `工具：${s.tool}` : '',
      status: s.status === 'completed' ? 'finish' : s.status === 'running' ? 'process' : 'wait',
    }
  }

  /* ══════════ confirmRun（D2）/ cancel / resync / dispose ══════════ */

  /**
   * D2：确认执行——轮询 GET /api/agent/runs/{currentRunId} 真实状态，
   * 1s 间隔、上限 5 分钟；completed/failed/stopped 终止轮询并落盘。
   * runId 缺失时抛错（UI 层禁用按钮并提示"无可执行的运行"）。
   */
  async confirmRun(): Promise<void> {
    const runId = this.currentRunId
    if (!runId) throw new Error('无可执行的运行')

    const token = ++this.pollToken
    this.runStatus = 'running'
    this.commit()

    const deadline = Date.now() + 5 * 60_000
    while (Date.now() < deadline && !this.disposed && token === this.pollToken) {
      let status: string | undefined
      try {
        const res = await this.transport.fetchJson(`/api/agent/runs/${encodeURIComponent(runId)}`)
        status = res.ok ? (res.data as CoreRun | undefined)?.status : undefined
      } catch {
        status = undefined /* 网络失败：下一轮重试 */
      }
      if (this.disposed || token !== this.pollToken) return

      if (status) {
        const mapped = mapRunStatus(status)
        if (mapped !== this.runStatus) {
          this.runStatus = mapped
          this.commit()
        }
        if (mapped === 'completed' || mapped === 'failed' || mapped === 'stopped') {
          this.persist()
          return
        }
      }
      await new Promise((resolve) => setTimeout(resolve, this.confirmPollMs))
    }

    if (token === this.pollToken && !this.disposed) {
      this.lastError = '运行状态查询超时（5 分钟）'
      this.commit()
    }
  }

  /** 停止生成：关闭 SSE + 占位消息定格为停止态并落盘。 */
  cancel(): void {
    this.clearResyncTimer()
    this.pollToken += 1 /* 终止 confirmRun 轮询 */
    this.abortController?.abort()
    this.abortController = null
    this.es?.close()
    this.es = null

    if (
      this.runStatus === 'thinking' ||
      this.runStatus === 'planning' ||
      this.runStatus === 'running'
    ) {
      this.runStatus = 'stopped'
      this.updateMessages((m) =>
        m.status === 'streaming'
          ? { ...m, status: 'done' as const, content: `${m.content}\n\n生成已停止。` }
          : m,
      )
      this.persist()
      this.commit()
    }
  }

  /** 清窗口重建（SSE 断线恢复）。 */
  async resync(): Promise<void> {
    if (this.disposed) return
    this.clearResyncTimer()
    this.es?.close()
    this.es = null
    this.abortController?.abort()
    this.abortController = null
    this.messages = []
    this.runStatus = 'idle'
    this.commit()
    await this.open()
  }

  private scheduleResync(): void {
    if (this.resyncTimer || this.disposed) return
    const delay = Math.min(this.resyncBaseMs * 2 ** this.resyncAttempts, this.resyncMaxMs)
    this.resyncAttempts += 1
    this.resyncTimer = setTimeout(() => {
      this.resyncTimer = null
      void this.resync()
    }, delay)
  }

  private clearResyncTimer(): void {
    if (this.resyncTimer) {
      clearTimeout(this.resyncTimer)
      this.resyncTimer = null
    }
  }

  /** 销毁会话（SessionManager.reset 用）：停流、清定时器、断订阅。 */
  dispose(): void {
    this.disposed = true
    this.clearResyncTimer()
    this.abortController?.abort()
    this.abortController = null
    this.es?.close()
    this.es = null
  }

  /* ══════════ 内部：消息/快照/持久化 ══════════ */

  private findMessage(id: string): ConversationMessage | undefined {
    return this.messages.find((m) => m.id === id)
  }

  /** 差分更新：仅替换目标消息，其余元素保持原引用。 */
  private updateMessages(
    mutate: (m: ConversationMessage) => ConversationMessage,
    targetId?: string,
  ): void {
    this.messages = this.messages.map((m) =>
      targetId ? (m.id === targetId ? mutate(m) : m) : mutate(m),
    )
    this.commit()
  }

  private appendDelta(assistantId: string, delta: string, cb?: StreamAdapterCallbacks): void {
    this.updateMessages((m) => ({ ...m, content: m.content + delta }), assistantId)
    cb?.onDelta(delta)
  }

  private upsertToolCall(assistantId: string, log: ToolCallLog): void {
    this.updateMessages((m) => {
      const existing = m.toolCalls ?? []
      const idx = existing.findIndex((t) => t.id === log.id)
      if (idx >= 0) {
        const updated = [...existing]
        updated[idx] = log
        return { ...m, toolCalls: updated }
      }
      return { ...m, toolCalls: [...existing, log] }
    }, assistantId)
  }

  private applyWorkflow(assistantId: string, steps: WorkflowStep[]): void {
    this.updateMessages((m) => ({ ...m, workflow: steps }), assistantId)
  }

  private finishAssistantMessage(
    assistantId: string,
    status: RunStatus,
    cb?: StreamAdapterCallbacks,
  ): void {
    this.runStatus = status
    this.updateMessages((m) => (m.id === assistantId ? { ...m, status: 'done' as const } : m))
    cb?.onStatus?.(status)
    cb?.onDone()
  }

  private failAssistantMessage(assistantId: string, message: string): void {
    this.updateMessages((m) =>
      m.id === assistantId
        ? { ...m, status: 'error' as const, content: `${m.content}\n\n执行出错：${message}` }
        : m,
    )
  }

  /** core 不可达时按缓存有无降级 phase。 */
  private degradePhase(reason: string): void {
    this.lastError = reason
    this.phase = readConversation(this.id) || this.messages.length > 0 ? 'frozen' : 'error'
  }

  private adoptCoreConversation(core: Conversation): void {
    this.title = core.title
    this.messages = core.messages
    this.runStatus = 'idle'
    this.coreId = core.coreConversationId
    this.demo = false
    this.lastError = undefined
    this.createdAt = core.createdAt
    if (core.workMode) this.meta.workMode = core.workMode
  }

  private adoptLocal(conv: Conversation): void {
    this.title = conv.title
    this.messages = conv.messages
    this.runStatus = conv.runStatus
    this.createdAt = conv.createdAt
    this.meta = {
      model: conv.model,
      mode: conv.mode,
      workMode: conv.workMode,
      workDirName: conv.workDirName,
      workspaceId: conv.workspaceId,
      workspaceName: conv.workspaceName,
    }
    if (conv.coreConversationId) this.coreId = conv.coreConversationId
  }

  /**
   * 终态落盘：与 localStorage 已有记录合并（保留 workspaceName/pinned 等元数据），
   * 流式过程中零写入——修掉旧实现每 token 全量写的性能问题。
   */
  private persist(): void {
    const prev = readConversation(this.id)
    writeConversation({
      id: this.id,
      title: this.title,
      messages: this.messages,
      model: this.meta.model ?? 'Auto',
      mode: this.meta.mode ?? '通用 GIS',
      workMode: this.meta.workMode,
      workDirName: this.meta.workDirName,
      runStatus: this.runStatus,
      createdAt: prev?.createdAt ?? this.createdAt,
      updatedAt: Date.now(),
      workspaceId: this.meta.workspaceId ?? prev?.workspaceId,
      workspaceName: this.meta.workspaceName ?? prev?.workspaceName,
      coreConversationId: this.coreId,
    })
  }

  private buildSnapshot(): ConversationSnapshot {
    return {
      phase: this.phase,
      runStatus: this.runStatus,
      messages: this.messages,
      title: this.title,
      coreConversationId: this.coreId,
      currentRunId: this.currentRunId,
      isDemo: this.demo || undefined,
      lastError: this.lastError,
    }
  }

  /** 标记脏并微任务合批重建快照。 */
  private commit(): void {
    this.notifier.markDirty(() => {
      this.snapshot = this.buildSnapshot()
    })
  }
}

function runIdOf(evt: CoreEventPayload, fallback: string | undefined): string {
  const fromData = (evt.data as { runId?: string } | undefined)?.runId
  return fromData ?? fallback ?? 'unknown'
}

/**
 * 会话层视图模型 + 快照契约
 *
 * 消息/工作流/工具调用等类型自 pages/NewTask/components/conversationStorage.ts
 * 原样迁移（零改名），conversationStorage 反向 re-export 以兼容存量调用方，
 * P4 接线完成后调用方统一切到本文件。
 */

import type { CoreApprovalRequest } from '../api/types'

/* ── 消息角色 ── */
export type MessageRole = 'user' | 'assistant' | 'system'

/* ── 消息状态 ── */
export type MessageStatus = 'streaming' | 'done' | 'error'

/* ── 任务执行状态 ── */
export type RunStatus =
  | 'idle'
  | 'thinking'
  | 'planning'
  | 'waiting-confirmation'
  | 'running'
  | 'completed'
  | 'failed'
  | 'stopped'

/* ── 工作流步骤 ── */
export type WorkflowStepStatus = 'wait' | 'process' | 'finish'

export interface WorkflowStep {
  key: string
  title: string
  description: string
  status: WorkflowStepStatus
}

/* ── 工具调用日志 ── */
export type ToolCallStatus = 'pending' | 'running' | 'success' | 'error'

export interface ToolCallLog {
  id: string
  name: string
  status: ToolCallStatus
  inputSummary: string
  outputSummary?: string
  startedAt: number
  endedAt?: number
}

/* ── 思考步骤（A3，doc/23：消费 state_change / message 事件） ── */
export type ThinkingStepKind = 'state' | 'reasoning'

export interface ThinkingStep {
  id: string
  kind: ThinkingStepKind
  /** state：状态中文标签；reasoning：「模型推理」 */
  title: string
  /** state：迁移原因；reasoning：累积的推理文本 */
  content: string
  startedAt: number
  endedAt?: number
}

/* ── 文件变更（A4，doc/23：消费 diff.created 事件） ── */
export interface FileDiff {
  id: string
  path: string
  /** 自包含的 unified diff（含 --- / +++ / @@ 头） */
  unified: string
  toolCallId?: string
  createdAt: number
}

/* ── 附件元信息 ── */
export type AttachedFileKind = 'file' | 'image'

export interface AttachedFileMeta {
  id: string
  name: string
  size: number
  type: string
  previewUrl?: string
  kind: AttachedFileKind
}

/* ── 上下文选择项 ── */
export type SelectedContextKind = 'skill' | 'expert' | 'mcp'

export interface SelectedContextItem {
  id: string
  kind: SelectedContextKind
  name: string
  slug?: string
  description?: string
  source?: string
  meta?: Record<string, string | number | boolean | string[]>
}

/* ── 对话消息 ── */
export interface ConversationMessage {
  id: string
  role: MessageRole
  content: string
  status?: MessageStatus
  createdAt: number
  workflow?: WorkflowStep[]
  toolCalls?: ToolCallLog[]
  /** A3：思考步骤（state_change 状态迁移 + message 推理流） */
  thinkingSteps?: ThinkingStep[]
  /** A4：文件变更（diff.created 事件，unified diff 内联渲染） */
  fileDiffs?: FileDiff[]
  attachments?: AttachedFileMeta[]
  contexts?: SelectedContextItem[]
}

/* ── 工作模式枚举 ── */
export type WorkMode = 'work' | 'code' | 'map'

/* ── 单个会话（持久化形态） ── */
export interface Conversation {
  id: string
  title: string
  messages: ConversationMessage[]
  model: string
  mode: string
  workMode?: WorkMode
  workDirName?: string
  runStatus: RunStatus
  createdAt: number
  updatedAt: number

  workspaceId?: string
  workspaceName?: string
  /** 关联的 Go Core 会话 id（用于复用同一 Core 会话、跨刷新恢复）。 */
  coreConversationId?: string
}

/* ── 会话存储根对象 ── */
export interface ConversationStore {
  conversations: Conversation[]
  currentId: string | null
}

/* ══════════ 会话对象层新增契约 ══════════ */

/**
 * 会话数据通道状态：
 * - live    core 在线，正常收发
 * - frozen  core 不可达但本地缓存命中（只读视口）
 * - error   core 不可达且无缓存
 */
export type SessionPhase = 'idle' | 'loading' | 'live' | 'frozen' | 'error'

/** UI 订阅的不可变会话快照（getSnapshot 永远返回缓存引用）。 */
export interface ConversationSnapshot {
  readonly phase: SessionPhase
  readonly runStatus: RunStatus
  readonly messages: readonly ConversationMessage[]
  readonly title: string
  readonly coreConversationId?: string
  /** D2：确认执行轮询 GET /api/agent/runs/{id} 用 */
  readonly currentRunId?: string
  /** A1：governor 待审批请求（存在时 UI 渲染审批卡片） */
  readonly pendingApproval?: CoreApprovalRequest
  /** D1：演示模式标注（core 不可达时由显式开关触发的 mock 流） */
  readonly isDemo?: boolean
  readonly lastError?: string
}

/** useSyncExternalStore 兼容的可订阅快照源。 */
export interface ObservableSnapshot<T> {
  getSnapshot(): T
  subscribe(fn: () => void): () => void
}

/** Session.send 的可选参数（UI 瞬时态不进对象层，发送时携带）。 */
export interface SendOptions {
  model?: string
  mode?: string
  workMode?: WorkMode
  workDirName?: string
  workspaceId?: string
  workspaceName?: string
  contexts?: SelectedContextItem[]
}

/* ── 流式适配器接口（自 streamAdapters.ts 迁入，对象层与页面层共用） ── */

export interface StreamAdapterPayload {
  conversationId: string
  input: string
  model: string
  mode: string
  workMode?: WorkMode
  workDirName?: string
  attachments?: AttachedFileMeta[]
  contexts?: SelectedContextItem[]
}

export interface StreamAdapterCallbacks {
  onDelta: (delta: string) => void
  onDone: () => void
  onError: (error: Error) => void
  onStatus?: (status: RunStatus) => void
  onToolCall?: (log: ToolCallLog) => void
  onWorkflow?: (steps: WorkflowStep[]) => void
}

export interface StreamAdapter {
  start: (
    payload: StreamAdapterPayload,
    callbacks: StreamAdapterCallbacks,
    signal: AbortSignal,
  ) => Promise<void>
}

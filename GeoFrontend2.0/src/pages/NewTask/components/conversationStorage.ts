/**
 * conversationStorage.ts
 *
 * 会话类型定义 + localStorage 持久化。
 */

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
  attachments?: AttachedFileMeta[]
  contexts?: SelectedContextItem[]
}

/* ── 工作模式枚举 ── */
export type WorkMode = 'work' | 'code' | 'map'

/* ── 单个会话 ── */
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
}

/* ── 会话存储根对象 ── */
export interface ConversationStore {
  conversations: Conversation[]
  currentId: string | null
}

/* ── 工具函数（10.3 阶段扩展） ── */
export function createEmptyConversation(model = 'Auto', mode = '通用 GIS', workMode: WorkMode = 'work'): Conversation {
  const now = Date.now()
  return {
    id: `conv_${now}_${Math.random().toString(36).slice(2, 8)}`,
    title: '新任务',
    messages: [],
    model,
    mode,
    workMode,
    runStatus: 'idle',
    createdAt: now,
    updatedAt: now,
  }
}

/* ─ localStorage 持久化 ── */

const CONVERSATIONS_KEY = 'geowork.conversations.v1'
const MAX_CONVERSATIONS = 20

export function loadConversations(): Conversation[] {
  try {
    const raw = localStorage.getItem(CONVERSATIONS_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (item): item is Conversation =>
        typeof item === 'object' &&
        item !== null &&
        typeof (item as Conversation).id === 'string' &&
        Array.isArray((item as Conversation).messages),
    )
  } catch {
    return []
  }
}

export function saveConversations(conversations: Conversation[]): void {
  try {
    localStorage.setItem(CONVERSATIONS_KEY, JSON.stringify(conversations))
  } catch {
    /* 静默失败：隐私模式或配额满 */
  }
}

export function upsertConversation(conv: Conversation): void {
  const conversations = loadConversations()
  const idx = conversations.findIndex((c) => c.id === conv.id)
  if (idx >= 0) {
    conversations[idx] = conv
  } else {
    conversations.unshift(conv)
  }
  conversations.sort((a, b) => b.updatedAt - a.updatedAt)
  saveConversations(conversations.slice(0, MAX_CONVERSATIONS))
}

export function getConversation(id: string): Conversation | undefined {
  return loadConversations().find((c) => c.id === id)
}

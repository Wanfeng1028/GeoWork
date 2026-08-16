/**
 * Go Core 协议类型镜像（唯一真相源）
 *
 * 本文件是 core/ Go 结构体在前端的逐字投影，字段与可选性以 Go 侧 JSON tag 为准：
 * - 会话/消息：core/internal/conversation/store.go
 * - SSE 事件负载：core/internal/api/task_event.go（TaskEventPayload）
 * - Agent 运行：core/internal/aiagent/orchestrator.go（Run / Step / Status）
 * - DB 任务：core/internal/tasks/models.go（Task / Status / TaskListResponse）
 *
 * 约定（见 doc/21 §P1）：组件层不许再手写 wire 类型，一律 import 本文件。
 * 需要容错的读取端（core 可能返回旧版本/缺字段）可将非 omitempty 字段视为可选，
 * 但新增字段必须先改这里、再改 Go，两侧同步。
 */

/* ══════════ 会话 / 消息（conversation_handler.go） ══════════ */

/** 镜像 conversation.Conversation。读取端容错：响应字段可能缺失。 */
export interface CoreConversation {
  id: string
  workspaceId?: string
  title?: string
  mode?: string
  status?: string
  /** 悬浮辅助对话继承的父对话 id（omitempty） */
  parentId?: string
  createdAt?: string
  updatedAt?: string
}

/** 镜像 conversation.Message。role: user | assistant | system | tool。 */
export interface CoreMessage {
  id: string
  conversationId?: string
  role: string
  content: string
  /** JSON string（Go 侧为文本化 JSON，非结构化对象） */
  toolCalls?: string
  /** JSON string */
  metadata?: string
  tokenCount?: number
  createdAt?: string
}

/** GET /api/conversations/{id}/messages 响应。 */
export interface CoreMessageListResponse {
  total: number
  messages: CoreMessage[]
}

/** GET /api/conversations 响应。 */
export interface CoreConversationListResponse {
  total: number
  conversations: CoreConversation[]
}

/** POST /api/conversations/{id}/messages 响应（触发 orchestrator）。 */
export interface CorePostMessageResponse {
  runId?: string
  message?: CoreMessage
  mode?: string
  /** orchestrator 不可用 / 启动失败时由 core 填充 */
  error?: string
}

/* ══════════ SSE 事件（task_event.go + orchestrator.go） ══════════ */

/**
 * orchestrator 经 EventBridge 转发的 SSE 事件名
 * （orchestrator.go L97：plan, step_start, step_done, message, error, checkpoint, done）。
 */
export type CoreSSEEventName =
  | 'plan'
  | 'step_start'
  | 'step_done'
  | 'message'
  | 'state_change'
  | 'tool_call'
  | 'tool_result'
  | 'approval_request'
  | 'done'
  | 'error'
  | 'tool_call_failed'

/** 镜像 api.TaskEventPayload（SSE data 帧的 JSON 形状）。 */
export interface CoreEventPayload {
  type: string
  taskId?: string
  stepId?: string
  message?: string
  tool?: string
  data?: Record<string, unknown>
  error?: string
}

/* ══════════ Agent 运行（aiagent/orchestrator.go，/api/agent/runs） ══════════ */

/** 镜像 aiagent.Status。 */
export type CoreRunStatus =
  'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'stopped' | 'recovery'

/** 镜像 aiagent.Step（Run.Plan 元素）。 */
export interface CoreRunStep {
  id: string
  title: string
  tool?: string
  args?: string
  status?: string
  result?: string
  /** 毫秒 */
  duration?: number
  startTime?: string
}

/** 镜像 aiagent.Run（messages/checkpoint 字段前端不消费，暂不投影）。 */
export interface CoreRun {
  id: string
  mode?: string
  prompt?: string
  status: CoreRunStatus
  plan?: CoreRunStep[]
  stepIndex?: number
  createdAt?: string
  updatedAt?: string
}

/* ══════════ 审批（toolregistry.ApprovalRequest，/api/agent/approvals） ══════════ */

/**
 * 镜像 governor 审批请求（aiagent/routes.go handleListApprovals 的稳定投影）。
 * SSE `approval_request` 事件 data 形状：{ approvalId, runId, toolName, args, riskLevel }。
 */
export interface CoreApprovalRequest {
  id: string
  runId?: string
  toolName: string
  args?: Record<string, unknown>
  riskLevel?: string
  createdAt?: string
  decision?: string
}

/* ══════════ DB 任务（tasks/models.go，/api/db/tasks） ══════════ */

/** 镜像 tasks.Status。 */
export type CoreTaskStatus =
  'pending' | 'running' | 'completed' | 'failed' | 'cancelled' | 'paused' | 'recovered'

/** 镜像 tasks.Task（JSON 投影，字段并集版）。 */
export interface CoreTask {
  id: string
  workspaceId: string
  name: string
  description?: string
  status: CoreTaskStatus
  /** Research/Data/GeoCode/Analysis/Write */
  mode: string
  prompt?: string
  plan?: string
  /** 0-100 */
  progress: number
  startedAt?: string
  completedAt?: string
  createdAt: string
  updatedAt: string
}

/** 镜像 tasks.TaskListResponse。 */
export interface CoreTaskListResponse {
  total: number
  tasks: CoreTask[]
}

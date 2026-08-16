import { readJSON, writeJSON } from '../../../shared/storage'
/**
 * conversationStorage.ts — 旧会话持久化入口（过渡兼容层）
 *
 * 类型定义已迁往 shared/session/types.ts（doc/21 §P2），此处反向 re-export
 * 保持存量调用方（ConversationMessage/ChatComposer/AppShell 等）零改动。
 *
 * 持久化函数仍写 geowork.conversations.v1（与 session/conversationCache.ts
 * 同 key）：NewTaskPage 每 token 全量写的路径在 P4 接线后删除，届时本文件
 * 仅剩 re-export，P6 收编。
 */

import type { Conversation, WorkMode } from '../../../shared/session/types'

export type {
  MessageRole,
  MessageStatus,
  RunStatus,
  WorkflowStepStatus,
  WorkflowStep,
  ToolCallStatus,
  ToolCallLog,
  ThinkingStepKind,
  ThinkingStep,
  FileDiff,
  AttachedFileKind,
  AttachedFileMeta,
  SelectedContextKind,
  SelectedContextItem,
  ConversationMessage,
  WorkMode,
  Conversation,
  ConversationStore,
} from '../../../shared/session/types'

/* ── 工具函数（10.3 阶段扩展） ── */
export function createEmptyConversation(
  model = 'Auto',
  mode = '通用 GIS',
  workMode: WorkMode = 'work',
): Conversation {
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
  return readJSON<unknown[]>(CONVERSATIONS_KEY, [], Array.isArray).filter(
    (item): item is Conversation =>
      typeof item === 'object' &&
      item !== null &&
      typeof (item as Conversation).id === 'string' &&
      Array.isArray((item as Conversation).messages),
  )
}

export function saveConversations(conversations: Conversation[]): void {
  writeJSON(CONVERSATIONS_KEY, conversations)
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

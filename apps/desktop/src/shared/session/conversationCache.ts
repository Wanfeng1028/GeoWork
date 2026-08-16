/**
 * 会话降级缓存（localStorage）
 *
 * 对象层唯一的会话持久化入口（doc/21 §P2）：
 * - 读：Session.open() 在 core 不可达时降级读取（phase='frozen'）
 * - 写：Session 终态落盘（onDone / cancel / fail），流式过程中零写入
 *
 * 与旧 conversationStorage.ts 共享同一 key（geowork.conversations.v1）与
 * 20 条上限，保证存量数据平滑迁移；P6 统一收编到 shared/storage。
 */

import type { Conversation } from './types'

const CONVERSATIONS_KEY = 'geowork.conversations.v1'
const MAX_CONVERSATIONS = 20

export function readConversation(id: string): Conversation | undefined {
  try {
    const raw = localStorage.getItem(CONVERSATIONS_KEY)
    if (!raw) return undefined
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return undefined
    return parsed.find(
      (item): item is Conversation =>
        typeof item === 'object' &&
        item !== null &&
        typeof (item as Conversation).id === 'string' &&
        (item as Conversation).id === id &&
        Array.isArray((item as Conversation).messages),
    )
  } catch {
    return undefined
  }
}

export function writeConversation(conv: Conversation): void {
  try {
    const raw = localStorage.getItem(CONVERSATIONS_KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : []
    const list: Conversation[] = Array.isArray(parsed)
      ? (parsed.filter(
          (item): item is Conversation =>
            typeof item === 'object' &&
            item !== null &&
            typeof (item as Conversation).id === 'string',
        ) as Conversation[])
      : []
    const idx = list.findIndex((c) => c.id === conv.id)
    if (idx >= 0) {
      list[idx] = conv
    } else {
      list.unshift(conv)
    }
    list.sort((a, b) => b.updatedAt - a.updatedAt)
    localStorage.setItem(CONVERSATIONS_KEY, JSON.stringify(list.slice(0, MAX_CONVERSATIONS)))
  } catch {
    /* 隐私模式或配额满：静默失败 */
  }
}

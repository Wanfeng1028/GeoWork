/**
 * streamAdapters.ts — 过渡薄壳（doc/21 §P2）
 *
 * 执行链路已整体迁入 shared/session/Session（对象层）：
 * - mock 流式 → session/demoAdapter.ts（仅演示模式可达，D1）
 * - SSE 驱动/ensureCoreConversation → session/Session.ts
 * - autoStreamAdapter 静默降级 → 已删除（D1：宁可诚实地空着）
 * - sseStreamAdapter/websocketStreamAdapter 空壳 → 已删除
 *
 * 本文件只保留 NewTaskPage 过渡期消费的转发 API，P4 接线完成后整个删除。
 */

import { sessionManager } from '../../../shared/session/SessionManager'
import type {
  StreamAdapter,
  StreamAdapterCallbacks,
  StreamAdapterPayload,
} from '../../../shared/session/types'

export type { StreamAdapter, StreamAdapterCallbacks, StreamAdapterPayload }

/** 读取本地会话对应的 Core 会话 id（转发 Session 的内存映射）。 */
export function getCoreConversationId(localConvId: string): string | undefined {
  return sessionManager.get(localConvId)?.coreConversationId
}

/** 设置本地会话与 Core 会话的映射（URL 直连 Core 会话后恢复）。 */
export function setCoreConversationId(localConvId: string, coreConvId: string): void {
  sessionManager.ensure(localConvId, coreConvId)
}

/**
 * 当前默认适配器：转发到 Session 对象层。
 * D1 生效——core 不可达时不再静默降级 mock；演示模式经显式开关在 Session 内分流。
 */
export const activeAdapter: StreamAdapter = {
  async start(
    payload: StreamAdapterPayload,
    callbacks: StreamAdapterCallbacks,
    signal: AbortSignal,
  ) {
    const session = sessionManager.ensure(payload.conversationId)
    signal.addEventListener('abort', () => session.cancel())
    await session.send(
      payload.input,
      {
        model: payload.model,
        mode: payload.mode,
        workMode: payload.workMode,
        workDirName: payload.workDirName,
        contexts: payload.contexts,
      },
      callbacks,
    )
  },
}

/**
 * SessionManager — 会话实例池
 *
 * 惰性建、常驻：切换会话再切回时秒开（快照与 core 会话映射都在内存）。
 * reset 时销毁实例（侧栏"新任务"重置语义）。
 */

import { Session } from './Session'
import type { SessionOptions } from './Session'

export class SessionManager {
  private sessions = new Map<string, Session>()

  /** 取或建会话实例；coreIdOverride 用于 URL 直连/缓存恢复时注入已知映射。 */
  ensure(localId: string, coreIdOverride?: string, opts?: SessionOptions): Session {
    let session = this.sessions.get(localId)
    if (!session) {
      session = new Session(localId, opts)
      this.sessions.set(localId, session)
    }
    if (coreIdOverride) session.adoptCoreId(coreIdOverride)
    return session
  }

  get(localId: string): Session | undefined {
    return this.sessions.get(localId)
  }

  /** 销毁并移除实例（重置会话，不删除已落盘的缓存记录）。 */
  reset(localId: string): void {
    const session = this.sessions.get(localId)
    if (session) {
      session.dispose()
      this.sessions.delete(localId)
    }
  }

  /** 供测试隔离：清空全部实例。 */
  clear(): void {
    for (const id of [...this.sessions.keys()]) this.reset(id)
  }
}

/** 模块级单例（生产用；测试直接 new SessionManager 或 new Session）。 */
export const sessionManager = new SessionManager()

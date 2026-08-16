/**
 * session/react.ts — 对象层的 React 绑定（doc/21 §P3）
 *
 * 本文件是 shared/session 目录下唯一允许 import react 的模块（P6 CI 守护）。
 * useSession 直连 Session 快照（getSnapshot 返回缓存引用，天然满足
 * useSyncExternalStore 契约）；useInvoke 以稳定引用 + 计数 pending 替代
 * 散落在组件里的 setIsLoading/setError 对。
 */

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { sessionManager } from './SessionManager'
import type { ConversationSnapshot } from './types'

const EMPTY_SNAPSHOT: ConversationSnapshot = {
  phase: 'idle',
  runStatus: 'idle',
  messages: [],
  title: '新任务',
}

/** 订阅会话快照；localId 为 null 时返回空快照（未选中会话）。 */
export function useSession(localId: string | null): ConversationSnapshot {
  const session = localId ? sessionManager.ensure(localId) : null

  const getSnapshot = useCallback(
    (): ConversationSnapshot => session?.getSnapshot() ?? EMPTY_SNAPSHOT,
    [session],
  )
  const subscribe = useCallback(
    (fn: () => void): (() => void) => session?.subscribe(fn) ?? (() => {}),
    [session],
  )

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}

export interface InvokeState<A extends unknown[]> {
  trigger: (...args: A) => void
  pending: boolean
  error: Error | null
}

/**
 * 异步动作包装：trigger 引用稳定（可直接传给子组件），并发调用计数 pending，
 * 最后一次失败保留为 error。组件卸载后不再 setState。
 */
export function useInvoke<A extends unknown[], R>(fn: (...args: A) => Promise<R>): InvokeState<A> {
  const fnRef = useRef(fn)
  fnRef.current = fn

  const [pendingCount, setPendingCount] = useState(0)
  const [error, setError] = useState<Error | null>(null)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  const trigger = useCallback((...args: A) => {
    setPendingCount((n) => n + 1)
    fnRef
      .current(...args)
      .catch((err: unknown) => {
        if (mountedRef.current) setError(err instanceof Error ? err : new Error(String(err)))
      })
      .finally(() => {
        if (mountedRef.current) setPendingCount((n) => n - 1)
      })
  }, [])

  return { trigger, pending: pendingCount > 0, error }
}

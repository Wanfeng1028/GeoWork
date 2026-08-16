/**
 * Notifier — 快照变更通知（微任务合批）
 *
 * 差分更新纪律（doc/21 §1.4）：N 次状态变更在一个微任务窗口内合并为
 * 1 次 flush + 1 次 notify，保证 React 的 useSyncExternalStore 每帧最多重渲染一次。
 */

export class Notifier {
  private listeners = new Set<() => void>()
  private scheduled = false
  private pendingFlush: (() => void) | null = null

  /** 订阅快照变更；返回取消订阅函数。 */
  subscribe(fn: () => void): () => void {
    this.listeners.add(fn)
    return () => {
      this.listeners.delete(fn)
    }
  }

  /**
   * 标记脏并在微任务中合批：同一窗口内多次 markDirty 只执行最后一次
   * 登记的 flush（后写覆盖先写，语义上都是"用当前全量状态重建快照"）。
   */
  markDirty(flush: () => void): void {
    this.pendingFlush = flush
    if (this.scheduled) return
    this.scheduled = true
    queueMicrotask(() => {
      this.scheduled = false
      const fn = this.pendingFlush
      this.pendingFlush = null
      fn?.()
      this.notify()
    })
  }

  /** 立即 flush + notify，仅用于用户手势回显等不可合并的场景。 */
  notifyNow(flush: () => void): void {
    flush()
    this.notify()
  }

  /** 若有挂起的合批任务，立即执行（测试与同步断言用）。 */
  flushSync(): void {
    if (!this.scheduled) return
    this.scheduled = false
    const fn = this.pendingFlush
    this.pendingFlush = null
    fn?.()
    this.notify()
  }

  private notify(): void {
    for (const fn of [...this.listeners]) fn()
  }
}

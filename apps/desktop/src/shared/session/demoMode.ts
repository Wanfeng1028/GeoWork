/**
 * 演示模式开关（D1，doc/21 §0）
 *
 * mock 流式不再作为"后端不可达时的静默降级"存在——只有本开关显式开启时，
 * Session.send 在 core 不可达的情况下才走 demoAdapter，且快照标注 isDemo=true，
 * UI 顶部常驻"演示模式（未连接后端）"提示条。
 *
 * 读取顺序：URL ?demo=1 > localStorage 'geowork.demo.enabled' === 'true'，默认 false。
 */

import { readString, writeString } from '../storage'

const DEMO_STORAGE_KEY = 'geowork.demo.enabled'

export function isDemoModeEnabled(): boolean {
  try {
    if (typeof window !== 'undefined' && window.location) {
      const url = new URL(window.location.href)
      if (url.searchParams.get('demo') === '1') return true
    }
    if (typeof localStorage === 'undefined') return false
    return readString(DEMO_STORAGE_KEY, 'false') === 'true'
  } catch {
    return false
  }
}

export function setDemoMode(enabled: boolean): void {
  try {
    if (typeof localStorage === 'undefined') return
    writeString(DEMO_STORAGE_KEY, String(enabled))
  } catch {
    /* 隐私模式/配额满：静默 */
  }
}

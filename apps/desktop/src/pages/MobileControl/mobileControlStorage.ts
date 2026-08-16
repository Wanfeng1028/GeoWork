import { readJSON, writeJSON } from '../../shared/storage'
import type { ChannelStatus } from './components/MobileChannelCard'

export const STORAGE_KEY = 'geowork.mobileControl.channels.v1'

export interface StoredMobileChannelState {
  key: string
  status: ChannelStatus
  enabled?: boolean
  errorMessage?: string
}

interface ChannelLike {
  key: string
  status: ChannelStatus
  enabled?: boolean
  errorMessage?: string
}

/** 从 localStorage 读取已保存的通道状态，异常时返回空数组 */
export function loadStoredChannelStates(): StoredMobileChannelState[] {
  try {
    const parsed: unknown = readJSON<unknown>(STORAGE_KEY, null)
    if (!Array.isArray(parsed)) return []
    /* 只做最外层字段校验，容错优先 */
    return parsed.filter(
      (item): item is StoredMobileChannelState =>
        typeof item === 'object' &&
        item !== null &&
        typeof (item as StoredMobileChannelState).key === 'string' &&
        typeof (item as StoredMobileChannelState).status === 'string',
    )
  } catch {
    return []
  }
}

/** 将 localStorage 中保存的状态合并回初始通道数据 */
export function mergeStoredChannels<T extends ChannelLike>(
  initialChannels: T[],
  storedStates: StoredMobileChannelState[],
): T[] {
  const storedMap = new Map(storedStates.map((s) => [s.key, s]))
  return initialChannels.map((ch) => {
    const stored = storedMap.get(ch.key)
    if (!stored) return ch
    return {
      ...ch,
      status: stored.status,
      enabled: stored.enabled,
      errorMessage: stored.errorMessage,
    }
  })
}

/** 将通道轻量状态写入 localStorage */
export function saveChannelStates(channels: ChannelLike[]): void {
  try {
    const payload: StoredMobileChannelState[] = channels.map((c) => ({
      key: c.key,
      status: c.status,
      enabled: c.enabled,
      errorMessage: c.errorMessage,
    }))
    writeJSON(STORAGE_KEY, payload)
  } catch {
    /* 写入失败静默忽略，不影响页面功能 */
  }
}

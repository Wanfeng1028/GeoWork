/**
 * localStorage 统一入口（doc/21 §P6）
 *
 * 全仓唯一的 localStorage 直触层：解析 try/catch、配额异常静默、geowork.*
 * key 前缀约束都在这里收口。CI 边界检查（scripts/check_frontend_boundaries.mjs）
 * 守护：src/ 下除 shared/storage/ 与 shared/session/conversationCache.ts 外
 * 零 localStorage 字面量。
 *
 * 约定：新 key 必须以 'geowork.' 开头——违反直接抛错（开发期立刻暴露）。
 */

const KEY_PREFIX = 'geowork.'

function assertKey(key: string): void {
  if (!key.startsWith(KEY_PREFIX)) {
    throw new Error(`[storage] key 必须以 "${KEY_PREFIX}" 开头: ${key}`)
  }
}

/** 读取并解析 JSON；缺失/解析失败/类型守卫不过 → fallback。 */
export function readJSON<T>(key: string, fallback: T, guard?: (v: unknown) => v is T): T {
  assertKey(key)
  try {
    const raw = localStorage.getItem(key)
    if (raw === null) return fallback
    const parsed: unknown = JSON.parse(raw)
    if (guard ? guard(parsed) : true) return parsed as T
    return fallback
  } catch {
    return fallback
  }
}

/** 序列化 JSON 写入；配额满/隐私模式静默失败。 */
export function writeJSON(key: string, value: unknown): void {
  assertKey(key)
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* 静默：隐私模式或配额满 */
  }
}

/** 读取裸字符串（非 JSON 值，如主题名/路径）。 */
export function readString(key: string, fallback: string): string {
  assertKey(key)
  try {
    return localStorage.getItem(key) ?? fallback
  } catch {
    return fallback
  }
}

/** 写入裸字符串；配额异常静默。 */
export function writeString(key: string, value: string): void {
  assertKey(key)
  try {
    localStorage.setItem(key, value)
  } catch {
    /* 静默 */
  }
}

/** 移除 key（不存在时无操作）。 */
export function removeKey(key: string): void {
  assertKey(key)
  try {
    localStorage.removeItem(key)
  } catch {
    /* 静默 */
  }
}

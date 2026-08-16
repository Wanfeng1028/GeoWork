/**
 * GeoWork Core API 客户端 — 带 runtime token 鉴权
 *
 * P0-4: Go runtime 要求每个请求携带 X-GeoWork-Token。
 * token 由 Electron 主进程铸造，渲染进程通过 IPC 获取一次后缓存。
 * EventSource 无法设置自定义 header，因此用 ?token= query 参数。
 */

const TOKEN_HEADER = 'X-GeoWork-Token'

export const CORE_BASE_URL =
  (import.meta as unknown as { env?: { VITE_CORE_API_URL?: string } }).env?.VITE_CORE_API_URL ??
  'http://127.0.0.1:8765'

let cachedToken: string | null = null
let tokenPromise: Promise<string | null> | null = null

/**
 * 获取 runtime token（首次通过 IPC，之后走缓存）。
 * 非 Electron 环境（纯浏览器 dev / 测试）返回 null。
 */
export function getRuntimeToken(): Promise<string | null> {
  if (cachedToken !== null) return Promise.resolve(cachedToken)
  if (tokenPromise) return tokenPromise
  tokenPromise = (async () => {
    try {
      const token = await window.geowork?.runtime?.getToken?.()
      cachedToken = typeof token === 'string' && token ? token : null
      return cachedToken
    } catch {
      return null
    }
  })()
  return tokenPromise
}

/** 同步读取已缓存的 token（未加载时为 null） */
export function getCachedToken(): string | null {
  return cachedToken
}

/** 预加载 token（应用启动时调用） */
export async function preloadRuntimeToken(): Promise<void> {
  await getRuntimeToken()
}

/**
 * 带 token 的 fetch 封装，替代直接 fetch(CORE_BASE_URL + path)。
 */
export async function coreFetch(path: string, init?: RequestInit): Promise<Response> {
  const token = await getRuntimeToken()
  const headers = new Headers(init?.headers)
  if (token && !headers.has(TOKEN_HEADER)) {
    headers.set(TOKEN_HEADER, token)
  }
  return fetch(`${CORE_BASE_URL}${path}`, { ...init, headers })
}

/**
 * 带 token 的 EventSource 封装。
 * EventSource 不支持自定义 header，token 通过 query 参数传递。
 */
export function coreEventSource(path: string): EventSource {
  const token = getCachedToken()
  const separator = path.includes('?') ? '&' : '?'
  const url = token
    ? `${CORE_BASE_URL}${path}${separator}token=${encodeURIComponent(token)}`
    : `${CORE_BASE_URL}${path}`
  return new EventSource(url)
}

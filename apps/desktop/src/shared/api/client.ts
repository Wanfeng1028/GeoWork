/**
 * GeoWork Core API 基础客户端
 *
 * P0-4: 所有请求通过 coreFetch/coreEventSource 携带 runtime token。
 */
import { coreFetch, coreEventSource, preloadRuntimeToken } from './coreApi'

export { CORE_BASE_URL as BASE_URL } from './coreApi'

/** 应用启动时预加载 runtime token */
export { preloadRuntimeToken }

export async function apiGet<T>(path: string): Promise<T> {
  const res = await coreFetch(path)
  if (!res.ok) throw new Error(`API Error: ${res.status}`)
  return res.json()
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const res = await coreFetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`API Error: ${res.status}`)
  return res.json()
}

export async function apiPut<T>(path: string, body: unknown): Promise<T> {
  const res = await coreFetch(path, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`API Error: ${res.status}`)
  return res.json()
}

export async function apiDelete<T>(path: string): Promise<T> {
  const res = await coreFetch(path, {
    method: 'DELETE',
  })
  if (!res.ok) throw new Error(`API Error: ${res.status}`)
  return res.json()
}

export async function apiPatch<T>(path: string, body: unknown): Promise<T> {
  const res = await coreFetch(path, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`API Error: ${res.status}`)
  return res.json()
}

// SSE 流式接口（对接 Go 的 SSE 事件流）
export function createSSEStream(path: string, onMessage: (data: string) => void): EventSource {
  const es = coreEventSource(path)
  es.onmessage = (e) => onMessage(e.data)
  return es
}

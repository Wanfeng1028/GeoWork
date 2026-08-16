/**
 * GeoWork Core API 基础客户端
 *
 * P0-4: 所有请求通过 coreFetch/coreEventSource 携带 runtime token。
 * 在 coreFetch 之上提供统一超时与 ApiError 错误分类：
 * - timeout：请求超时（默认 30s，AbortController 实现）
 * - network：后端不可达（Go runtime 未启动 / 连接被拒）
 * - http：后端返回非 2xx，携带状态码与 core 业务错误码（见 core/internal/api/errors.go）
 */
import { coreFetch, coreEventSource } from './coreApi'

export { CORE_BASE_URL as BASE_URL, preloadRuntimeToken } from './coreApi'

/** 默认请求超时（毫秒）；SSE 长连接不适用，走 createSSEStream */
const DEFAULT_TIMEOUT_MS = 30_000

/** ApiError 分类：超时 / 网络不可达 / HTTP 状态错误 */
export type ApiErrorKind = 'timeout' | 'network' | 'http'

/**
 * 统一 API 错误。上层通过 kind 分类处理：
 * network → 提示「后端未启动」或降级本地缓存；timeout → 可重试；http → 按 code 细分。
 */
export class ApiError extends Error {
  readonly status: number
  readonly kind: ApiErrorKind
  /** core 业务错误码（core/internal/api/errors.go），仅 http 错误携带，其余为 0 */
  readonly code: number

  constructor(message: string, status: number, kind: ApiErrorKind, code = 0) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.kind = kind
    this.code = code
  }

  get isTimeout(): boolean {
    return this.kind === 'timeout'
  }

  get isNetworkError(): boolean {
    return this.kind === 'network'
  }
}

/** 请求级选项 */
export interface RequestOptions {
  /** 超时毫秒数，默认 30_000；传 0 表示不限时 */
  timeoutMs?: number
  /** 外部取消信号（如组件卸载时中止请求） */
  signal?: AbortSignal
}

/** core 错误响应结构（core/internal/api/errors.go ApiError） */
interface CoreErrorBody {
  code?: number
  message?: string
}

/** 读取 core 错误响应体；非 JSON 或读取失败时返回 null */
async function readCoreErrorBody(res: Response): Promise<CoreErrorBody | null> {
  try {
    return await res.json()
  } catch {
    return null
  }
}

async function request<T>(path: string, init: RequestInit, opts: RequestOptions = {}): Promise<T> {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const controller = new AbortController()
  let timedOut = false
  const timer =
    timeoutMs > 0
      ? setTimeout(() => {
          timedOut = true
          controller.abort()
        }, timeoutMs)
      : null
  const onExternalAbort = () => controller.abort()
  opts.signal?.addEventListener('abort', onExternalAbort)

  try {
    let res: Response
    try {
      res = await coreFetch(path, { ...init, signal: controller.signal })
    } catch (err) {
      if (timedOut) {
        throw new ApiError(`API timeout: ${path} (${timeoutMs}ms)`, 0, 'timeout')
      }
      if (opts.signal?.aborted) {
        // 调用方主动取消：保持 AbortError 语义原样上抛（jsdom 的 DOMException 不继承 Error，需归一化）
        if (err instanceof DOMException && err.name === 'AbortError') throw err
        throw new DOMException('This operation was aborted', 'AbortError')
      }
      // Go runtime 未启动 / 连接被拒 / DNS 失败都落到这里
      throw new ApiError(
        `API network error: ${path} (${err instanceof Error ? err.message : String(err)})`,
        0,
        'network',
      )
    }

    if (!res.ok) {
      const body = await readCoreErrorBody(res)
      const detail = body?.message ? `: ${body.message}` : ''
      throw new ApiError(`API Error: ${res.status}${detail}`, res.status, 'http', body?.code ?? 0)
    }
    return (await res.json()) as T
  } finally {
    if (timer) clearTimeout(timer)
    opts.signal?.removeEventListener('abort', onExternalAbort)
  }
}

export function apiGet<T>(path: string, opts?: RequestOptions): Promise<T> {
  return request<T>(path, { method: 'GET' }, opts)
}

export function apiPost<T>(path: string, body: unknown, opts?: RequestOptions): Promise<T> {
  return request<T>(
    path,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
    opts,
  )
}

export function apiPut<T>(path: string, body: unknown, opts?: RequestOptions): Promise<T> {
  return request<T>(
    path,
    { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
    opts,
  )
}

export function apiDelete<T>(path: string, opts?: RequestOptions): Promise<T> {
  return request<T>(path, { method: 'DELETE' }, opts)
}

export function apiPatch<T>(path: string, body: unknown, opts?: RequestOptions): Promise<T> {
  return request<T>(
    path,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
    opts,
  )
}

// SSE 流式接口（对接 Go 的 SSE 事件流）
export function createSSEStream(path: string, onMessage: (data: string) => void): EventSource {
  const es = coreEventSource(path)
  es.onmessage = (e) => onMessage(e.data)
  return es
}

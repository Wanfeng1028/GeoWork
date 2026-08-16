import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  apiGet,
  apiPost,
  apiPut,
  apiDelete,
  apiPatch,
  createSSEStream,
  ApiError,
} from '../shared/api/client'

describe('API Client', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('apiGet', () => {
    it('should call fetch with correct URL and return JSON', async () => {
      const mockData = { id: 1, name: 'test' }
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockData),
      } as Response)

      const result = await apiGet<{ id: number; name: string }>('/api/test')
      const [url] = vi.mocked(fetch).mock.calls[0]
      expect(url).toContain('/api/test')
      expect(result).toEqual(mockData)
    })

    it('should throw error when response is not ok', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 404,
      } as Response)

      await expect(apiGet('/api/not-found')).rejects.toThrow('API Error: 404')
    })

    it('should throw error on 500 status', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 500,
      } as Response)

      await expect(apiGet('/api/error')).rejects.toThrow('API Error: 500')
    })
  })

  describe('apiPost', () => {
    it('should call fetch with POST method and JSON body', async () => {
      const mockResponse = { success: true }
      const body = { title: 'new task', content: 'hello' }

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      } as Response)

      const result = await apiPost('/api/tasks', body)

      const [url, init] = vi.mocked(fetch).mock.calls[0]
      expect(url).toContain('/api/tasks')
      expect(init?.method).toBe('POST')
      expect((init?.headers as Headers).get('Content-Type')).toBe('application/json')
      expect(init?.body).toBe(JSON.stringify(body))
      expect(result).toEqual(mockResponse)
    })

    it('should throw error when POST response is not ok', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 400,
      } as Response)

      await expect(apiPost('/api/tasks', {})).rejects.toThrow('API Error: 400')
    })

    it('should handle 201 Created response', async () => {
      const created = { id: 'abc', status: 'created' }
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(created),
      } as Response)

      const result = await apiPost('/api/items', { name: 'item1' })
      expect(result).toEqual(created)
    })
  })

  describe('apiPut', () => {
    it('should call fetch with PUT method and JSON body', async () => {
      const updated = { id: 'abc', name: 'updated' }
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(updated),
      } as Response)

      const result = await apiPut('/api/items/abc', { name: 'updated' })

      const [url, init] = vi.mocked(fetch).mock.calls[0]
      expect(url).toContain('/api/items/abc')
      expect(init?.method).toBe('PUT')
      expect((init?.headers as Headers).get('Content-Type')).toBe('application/json')
      expect(init?.body).toBe(JSON.stringify({ name: 'updated' }))
      expect(result).toEqual(updated)
    })

    it('should throw error when PUT response is not ok', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({ ok: false, status: 409 } as Response)
      await expect(apiPut('/api/items/abc', {})).rejects.toThrow('API Error: 409')
    })
  })

  describe('apiDelete', () => {
    it('should call fetch with DELETE method and no body', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ deleted: true }),
      } as Response)

      const result = await apiDelete('/api/items/abc')

      const [url, init] = vi.mocked(fetch).mock.calls[0]
      expect(url).toContain('/api/items/abc')
      expect(init?.method).toBe('DELETE')
      expect(result).toEqual({ deleted: true })
    })

    it('should throw error when DELETE response is not ok', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({ ok: false, status: 404 } as Response)
      await expect(apiDelete('/api/items/missing')).rejects.toThrow('API Error: 404')
    })
  })

  describe('apiPatch', () => {
    it('should call fetch with PATCH method and JSON body', async () => {
      const patched = { id: 'abc', status: 'done' }
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(patched),
      } as Response)

      const result = await apiPatch('/api/items/abc', { status: 'done' })

      const [url, init] = vi.mocked(fetch).mock.calls[0]
      expect(url).toContain('/api/items/abc')
      expect(init?.method).toBe('PATCH')
      expect((init?.headers as Headers).get('Content-Type')).toBe('application/json')
      expect(init?.body).toBe(JSON.stringify({ status: 'done' }))
      expect(result).toEqual(patched)
    })

    it('should throw error when PATCH response is not ok', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({ ok: false, status: 422 } as Response)
      await expect(apiPatch('/api/items/abc', {})).rejects.toThrow('API Error: 422')
    })
  })

  describe('超时与错误分类', () => {
    /** 模拟一个只在 abort 时才结束的 fetch（真实 fetch 收到 abort signal 的行为，含已 abort 的 signal） */
    function mockNeverResolvingFetch() {
      vi.mocked(fetch).mockImplementationOnce(
        ((_url: RequestInfo | URL, init?: RequestInit) =>
          new Promise<Response>((_resolve, reject) => {
            const signal = init?.signal
            const abort = () => reject(new DOMException('This operation was aborted', 'AbortError'))
            if (signal?.aborted) {
              abort()
              return
            }
            signal?.addEventListener('abort', abort)
          })) as typeof fetch,
      )
    }

    it('超时应抛出 kind=timeout 的 ApiError', async () => {
      mockNeverResolvingFetch()

      const err = await apiGet('/api/slow', { timeoutMs: 30 }).then(
        () => null,
        (e: unknown) => e,
      )

      expect(err).toBeInstanceOf(ApiError)
      const apiErr = err as ApiError
      expect(apiErr.kind).toBe('timeout')
      expect(apiErr.isTimeout).toBe(true)
      expect(apiErr.status).toBe(0)
      expect(apiErr.message).toContain('/api/slow')
    })

    it('网络错误（后端未启动）应抛出 kind=network 的 ApiError', async () => {
      vi.mocked(fetch).mockRejectedValueOnce(new TypeError('fetch failed'))

      const err = await apiGet('/api/health').then(
        () => null,
        (e: unknown) => e,
      )

      expect(err).toBeInstanceOf(ApiError)
      const apiErr = err as ApiError
      expect(apiErr.kind).toBe('network')
      expect(apiErr.isNetworkError).toBe(true)
      expect(apiErr.message).toContain('fetch failed')
    })

    it('HTTP 错误应携带 core 业务错误码和 message', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: () => Promise.resolve({ code: 40001, message: 'permission denied' }),
      } as Response)

      const err = await apiPost('/api/tasks', {}).then(
        () => null,
        (e: unknown) => e,
      )

      expect(err).toBeInstanceOf(ApiError)
      const apiErr = err as ApiError
      expect(apiErr.kind).toBe('http')
      expect(apiErr.status).toBe(403)
      expect(apiErr.code).toBe(40001)
      expect(apiErr.message).toContain('permission denied')
    })

    it('外部 signal 取消时应原样抛出 AbortError 而非 ApiError', async () => {
      mockNeverResolvingFetch()

      const controller = new AbortController()
      const promise = apiGet('/api/cancellable', { signal: controller.signal, timeoutMs: 5_000 })
      controller.abort()

      const err = await promise.then(
        () => null,
        (e: unknown) => e,
      )

      expect(err).toBeInstanceOf(DOMException)
      expect((err as DOMException).name).toBe('AbortError')
      expect(err).not.toBeInstanceOf(ApiError)
    })

    it('timeoutMs=0 表示不限时,慢响应正常返回', async () => {
      let resolveFetch!: (v: Response) => void
      vi.mocked(fetch).mockImplementationOnce(
        () =>
          new Promise<Response>((resolve) => {
            resolveFetch = resolve
          }),
      )

      const promise = apiGet<{ ok: boolean }>('/api/deferred', { timeoutMs: 0 })
      // coreFetch 会先 await runtime token（微任务），等 fetch 真正被调用后再 resolve
      await vi.waitFor(() => expect(resolveFetch).toBeTypeOf('function'))
      resolveFetch({ ok: true, json: () => Promise.resolve({ ok: true }) } as Response)

      await expect(promise).resolves.toEqual({ ok: true })
    })
  })

  describe('createSSEStream', () => {
    it('should create EventSource with correct URL', () => {
      const onMessage = vi.fn()
      const mockEventSource = {
        onmessage: null as any,
        close: vi.fn(),
      }
      vi.stubGlobal(
        'EventSource',
        vi.fn(() => mockEventSource),
      )

      const es = createSSEStream('/api/stream', onMessage)

      expect(EventSource).toHaveBeenCalledWith(expect.stringContaining('/api/stream'))
      expect(es).toBe(mockEventSource)
    })

    it('should call onMessage when EventSource receives data', () => {
      const onMessage = vi.fn()
      const mockEventSource = {
        onmessage: null as any,
        close: vi.fn(),
      }
      vi.stubGlobal(
        'EventSource',
        vi.fn(() => mockEventSource),
      )

      createSSEStream('/api/events', onMessage)

      // Simulate receiving a message
      mockEventSource.onmessage({ data: '{"type":"update","value":42}' })
      expect(onMessage).toHaveBeenCalledWith('{"type":"update","value":42}')
    })
  })
})

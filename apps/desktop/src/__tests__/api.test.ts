import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { apiGet, apiPost, apiPut, apiDelete, apiPatch, createSSEStream } from '../shared/api/client'

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

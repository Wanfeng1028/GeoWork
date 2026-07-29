const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080'

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`)
  if (!res.ok) throw new Error(`API Error: ${res.status}`)
  return res.json()
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`API Error: ${res.status}`)
  return res.json()
}

// SSE 流式接口（对接 Go 的 SSE 事件流）
export function createSSEStream(path: string, onMessage: (data: string) => void): EventSource {
  const es = new EventSource(`${BASE_URL}${path}`)
  es.onmessage = (e) => onMessage(e.data)
  return es
}

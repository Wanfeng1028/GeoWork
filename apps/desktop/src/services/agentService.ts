const API_BASE = window.geowork?.coreUrl ?? 'http://127.0.0.1:8765'

// --- Type definitions ---

export interface AgentNode {
  id: string
  type: 'start' | 'process' | 'agent' | 'output' | 'condition'
  name: string
  config: Record<string, any>
  x: number
  y: number
}

export interface AgentEdge {
  id: string
  source: string
  target: string
}

export interface Workflow {
  id: string
  name: string
  description: string
  nodes: AgentNode[]
  edges: AgentEdge[]
  createdAt: string
  updatedAt: string
}

export interface AgentRun {
  id: string
  workflowId: string
  workflowName: string
  status: 'running' | 'waiting' | 'completed' | 'failed' | 'cancelled'
  progress: number
  logs: string[]
  startedAt: string
  completedAt?: string
}

// --- API helpers ---

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) }
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

// --- Workflow CRUD ---

export async function getWorkflows(): Promise<Workflow[]> {
  return request<Workflow[]>('/api/v1/workflows')
}

export async function createWorkflow(name: string, description: string): Promise<Workflow> {
  return request<Workflow>('/api/v1/workflows', {
    method: 'POST',
    body: JSON.stringify({ name, description })
  })
}

export async function saveWorkflow(workflow: Workflow): Promise<void> {
  await request<{ status: string }>(`/api/v1/workflows/${workflow.id}`, {
    method: 'PUT',
    body: JSON.stringify(workflow)
  })
}

export async function deleteWorkflow(id: string): Promise<void> {
  await request<{ status: string }>(`/api/v1/workflows/${id}`, {
    method: 'DELETE'
  })
}

// --- Run management ---

export async function startWorkflowRun(workflowId: string): Promise<AgentRun> {
  return request<AgentRun>(`/api/v1/workflows/${workflowId}/run`, {
    method: 'POST'
  })
}

export async function stopWorkflowRun(runId: string): Promise<void> {
  await request<{ status: string }>(`/api/v1/workflows/${runId}/stop`, {
    method: 'POST'
  })
}

export async function getWorkflowLogs(runId: string): Promise<string[]> {
  return request<string[]>(`/api/v1/runs/${runId}/logs`)
}

export async function getRuns(workflowId?: string): Promise<AgentRun[]> {
  const url = workflowId
    ? `/api/v1/runs?workflowId=${workflowId}`
    : '/api/v1/runs'
  return request<AgentRun[]>(url)
}

export async function getRun(runId: string): Promise<AgentRun> {
  return request<AgentRun>(`/api/v1/runs/${runId}`)
}

// --- SSE log streaming ---

export function streamRunLogs(runId: string, onLog: (logs: string[], time: string) => void, onDone?: () => void): () => void {
  const url = `${API_BASE}/api/v1/runs/${runId}/logs/stream`
  const controller = new AbortController()

  fetch(url, {
    signal: controller.signal,
    headers: { Accept: 'text/event-stream' }
  }).then(async (res) => {
    const reader = res.body?.getReader()
    if (!reader) return

    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6))
            onLog(data.logs || [], data.time || '')
          } catch {
            // ignore parse errors
          }
        }
      }
    }
    onDone?.()
  }).catch((err) => {
    if (err.name !== 'AbortError') {
      console.error('SSE stream error:', err)
    }
  })

  return () => controller.abort()
}

const API_BASE = window.geowork?.coreUrl ?? 'http://127.0.0.1:8765'

export type Project = { id: string; name: string; mode: string; path: string }
export type Step = { id: string; title: string; description: string; toolName: string; status: string; riskLevel: string }
export type Artifact = { id: string; name: string; type: string; path: string; mimeType: string }
export type Task = { id: string; projectId: string; prompt: string; mode: string; status: string; plan: Step[]; artifacts: Artifact[] }
export type RuntimeEvent = { id: string; taskId: string; type: string; message: string; data?: Record<string, unknown>; time: string }

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) }
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export const api = {
  health: () => request<Record<string, unknown>>('/api/health'),
  projects: () => request<Project[]>('/api/projects'),
  createProject: (body: { name: string; mode: string }) => request<Project>('/api/projects', { method: 'POST', body: JSON.stringify(body) }),
  projectFiles: (id: string) => request<any[]>(`/api/projects/${id}/files`),
  createDelivery: (id: string) => request<Record<string, unknown>>(`/api/projects/${id}/delivery`, { method: 'POST' }),
  deliveries: () => request<any[]>('/api/deliveries'),
  artifacts: () => request<Artifact[]>('/api/artifacts'),
  datasets: () => request<any[]>('/api/datasets'),
  registerDataset: (body: Record<string, unknown>) => request<Record<string, unknown>>('/api/datasets', { method: 'POST', body: JSON.stringify(body) }),
  layers: () => request<any[]>('/api/map/layers'),
  updateLayer: (id: string, body: Record<string, unknown>) => request<Record<string, unknown>>(`/api/map/layers/${id}`, { method: 'POST', body: JSON.stringify(body) }),
  tasks: () => request<Task[]>('/api/tasks'),
  createTask: (body: { projectId?: string; prompt: string; mode: string }) => request<Task>('/api/tasks', { method: 'POST', body: JSON.stringify(body) }),
  runTask: (id: string) => request<Task>(`/api/tasks/${id}/run`, { method: 'POST' }),
  events: (id: string) => request<RuntimeEvent[]>(`/api/tasks/${id}/events`),
  skills: () => request<any[]>('/api/skills'),
  runSkill: (id: string) => request<Task>(`/api/skills/${id}/run`, { method: 'POST' }),
  plugins: () => request<any[]>('/api/plugins'),
  enablePlugin: (id: string, enabled: boolean) => request<any[]>(`/api/plugins/${id}/enable`, { method: 'POST', body: JSON.stringify({ enabled }) }),
  models: () => request<any[]>('/api/models'),
  saveModel: (body: Record<string, unknown>) => request<Record<string, unknown>>('/api/models', { method: 'POST', body: JSON.stringify(body) }),
  testModel: (body: Record<string, unknown>) => request<Record<string, unknown>>('/api/models/test', { method: 'POST', body: JSON.stringify(body) }),
  usage: () => request<Record<string, unknown>>('/api/usage/summary'),
  usageRecords: () => request<any[]>('/api/usage/records'),
  settings: () => request<Record<string, unknown>>('/api/settings'),
  saveSettings: (body: Record<string, unknown>) => request<Record<string, unknown>>('/api/settings', { method: 'POST', body: JSON.stringify(body) }),
  environmentChecks: () => request<any[]>('/api/environment/checks'),
  automations: () => request<any[]>('/api/automations'),
  createAutomation: (body: Record<string, unknown>) => request<Record<string, unknown>>('/api/automations', { method: 'POST', body: JSON.stringify(body) }),
  triggerAutomation: (id: string) => request<Record<string, unknown>>(`/api/automations/${id}/trigger`, { method: 'POST' }),
  automationRuns: () => request<any[]>('/api/automation-runs'),
  experts: () => request<any[]>('/api/experts'),
  papers: (query = '') => request<any[]>(`/api/papers${query ? `?q=${encodeURIComponent(query)}` : ''}`),
  knowledge: () => request<any[]>('/api/knowledge'),
  indexKnowledge: (body: Record<string, unknown>) => request<Record<string, unknown>>('/api/knowledge', { method: 'POST', body: JSON.stringify(body) }),
  securityDecisions: () => request<any[]>('/api/security/decisions'),
  resolveSecurityDecision: (id: string, body: Record<string, unknown>) => request<Record<string, unknown>>(`/api/security/decisions/${id}`, { method: 'POST', body: JSON.stringify(body) }),
  tools: () => request<any[]>('/api/tools'),
  einoSchema: () => request<Record<string, unknown>>('/api/eino/schema'),
  mcp: () => request<any[]>('/api/mcp'),
  worker: () => request<Record<string, unknown>>('/api/worker/geo/check'),

  // File management APIs
  getProjectFiles: (projectId: string) => request<any[]>(`/api/v1/files/${projectId}`),
  createFolder: (projectId: string, body: { parentId: string; name: string }) =>
    request<any[]>(`/api/v1/files/${projectId}/folder`, { method: 'POST', body: JSON.stringify(body) }),
  deleteFileNode: (projectId: string, nodeId: string) =>
    request<any[]>(`/api/v1/files/${projectId}/${nodeId}`, { method: 'DELETE' }),
  renameFileNode: (projectId: string, nodeId: string, name: string) =>
    request<any[]>(`/api/v1/files/${projectId}/${nodeId}/rename`, { method: 'PUT', body: JSON.stringify({ name }) })
}

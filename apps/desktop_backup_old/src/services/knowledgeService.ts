const API_BASE = window.geowork?.coreUrl ?? 'http://127.0.0.1:8765'

export interface KnowledgeCategory {
  id: string
  name: string
  parentId: string | null
  children?: KnowledgeCategory[]
  createdAt: string
  updatedAt: string
}

export interface KnowledgeEntry {
  id: string
  title: string
  content: string
  source: 'paper_id' | 'pdf' | 'manual'
  category: string
  tags: string[]
  createdAt: string
  updatedAt: string
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || `HTTP ${res.status}`)
  }
  return res.json()
}

export async function getKnowledgeCategories(): Promise<KnowledgeCategory[]> {
  return request<KnowledgeCategory[]>('/api/v1/knowledge/categories')
}

export async function getKnowledgeEntries(
  categoryId?: string,
  query?: string,
): Promise<KnowledgeEntry[]> {
  const params = new URLSearchParams()
  if (categoryId) params.set('categoryId', categoryId)
  if (query) params.set('q', query)
  const qs = params.toString()
  return request<KnowledgeEntry[]>(`/api/v1/knowledge/entries${qs ? `?${qs}` : ''}`)
}

export async function createCategory(
  name: string,
  parentId?: string,
): Promise<KnowledgeCategory> {
  return request<KnowledgeCategory>('/api/v1/knowledge/categories', {
    method: 'POST',
    body: JSON.stringify({ name, parentId }),
  })
}

export async function indexPaperToKnowledge(
  paperId: string,
  title: string,
  content: string,
  tags: string[] = [],
): Promise<void> {
  await request<void>('/api/v1/knowledge/index', {
    method: 'POST',
    body: JSON.stringify({ paperId, title, content, tags }),
  })
}

export async function importKnowledgeFile(
  file: File,
  title: string,
): Promise<void> {
  // For file import, we read the file content and send as text
  const content = await file.text()
  const source = file.type === 'application/pdf' ? 'pdf' : 'manual'
  await request<void>('/api/v1/knowledge/import', {
    method: 'POST',
    body: JSON.stringify({ filePath: file.name, title, content, source }),
  })
}

export async function deleteKnowledgeEntry(id: string): Promise<void> {
  await request<void>(`/api/v1/knowledge/entries/${id}`, {
    method: 'DELETE',
  })
}

export async function searchKnowledge(query: string): Promise<KnowledgeEntry[]> {
  return request<KnowledgeEntry[]>(`/api/v1/knowledge/entries?q=${encodeURIComponent(query)}`)
}

export async function getKnowledgeEntry(id: string): Promise<KnowledgeEntry> {
  return request<KnowledgeEntry>(`/api/v1/knowledge/entries/${id}`)
}

export async function updateKnowledgeEntry(
  id: string,
  body: Partial<Pick<KnowledgeEntry, 'title' | 'content' | 'category' | 'tags'>>,
): Promise<KnowledgeEntry> {
  return request<KnowledgeEntry>(`/api/v1/knowledge/entries/${id}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  })
}

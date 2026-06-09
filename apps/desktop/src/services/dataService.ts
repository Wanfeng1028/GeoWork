const API_BASE = window.geowork?.coreUrl ?? 'http://127.0.0.1:8765'

export interface Dataset {
  id: string
  name: string
  type: 'GeoTIFF' | 'Shapefile' | 'GeoPackage' | 'CSV' | 'GeoJSON' | 'NetCDF' | 'other'
  path: string
  crs: string
  extent: { minX: number; minY: number; maxX: number; maxY: number }
  size: number
  status: 'registered' | 'processing' | 'error'
  metadata: Record<string, any>
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) }
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function getDatasets(): Promise<Dataset[]> {
  return request<Dataset[]>('/api/datasets')
}

export async function registerDataset(params: Partial<Dataset>): Promise<Dataset> {
  return request<Dataset>('/api/datasets', {
    method: 'POST',
    body: JSON.stringify(params)
  })
}

export async function removeDataset(id: string): Promise<void> {
  // Remove via DELETE on dataset resource
  await request(`/api/datasets/${id}`, { method: 'DELETE' })
}

export async function exportDatasetMetadata(id: string): Promise<string> {
  const res = await fetch(`${API_BASE}/api/datasets/${id}/metadata`, {
    headers: { 'Content-Type': 'application/json' }
  })
  if (!res.ok) throw new Error(await res.text())
  return res.text()
}

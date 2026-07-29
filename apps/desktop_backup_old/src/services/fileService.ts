import { api } from './api'

export interface FileNode {
  id: string
  name: string
  type: 'file' | 'folder'
  parentId?: string
  projectId: string
  size?: number
  mimeType?: string
  modifiedAt?: string
  path?: string
  children?: FileNode[]
}

const API_BASE = window.geowork?.coreUrl ?? 'http://127.0.0.1:8765'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) }
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export const fileService = {
  /**
   * Get the full file tree for a project.
   */
  getProjectFiles: (projectId: string): Promise<FileNode[]> =>
    request<FileNode[]>(`/api/v1/files/${projectId}`),

  /**
   * Create a new folder inside a project.
   */
  createFolder: (projectId: string, parentId: string, name: string): Promise<FileNode> =>
    request<FileNode>(`/api/v1/files/${projectId}/folder`, {
      method: 'POST',
      body: JSON.stringify({ parentId, name })
    }),

  /**
   * Upload a file to a project folder.
   */
  uploadFile: (projectId: string, parentId: string, file: File): Promise<FileNode> => {
    const formData = new FormData()
    formData.append('file', file)
    if (parentId) formData.append('parentId', parentId)
    return fetch(`${API_BASE}/api/v1/files/${projectId}/upload`, {
      method: 'POST',
      body: formData
    }).then((res) => {
      if (!res.ok) throw new Error(`Upload failed: ${res.statusText}`)
      return res.json()
    })
  },

  /**
   * Delete a file or folder node.
   */
  deleteNode: (projectId: string, nodeId: string): Promise<{ status: string }> =>
    request<{ status: string }>(`/api/v1/files/${projectId}/${nodeId}`, {
      method: 'DELETE'
    }),

  /**
   * Rename a file or folder node.
   */
  renameNode: (projectId: string, nodeId: string, name: string): Promise<{ status: string }> =>
    request<{ status: string }>(`/api/v1/files/${projectId}/${nodeId}/rename`, {
      method: 'PUT',
      body: JSON.stringify({ name })
    }),

  /**
   * Get raw file content for preview.
   */
  getFileContent: (projectId: string, nodeId: string): Promise<string> =>
    request<string>(`/api/v1/files/${projectId}/${nodeId}/content`)
}

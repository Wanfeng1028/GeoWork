// GeoWork Store - Workspace Store (integrated with Go Core API)

import { create } from 'zustand'
import type { Workspace, WorkspaceFile, WorkspaceState } from '../types/workspace'
import runtimeClient from '../services/runtimeClient'

const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  workspaces: [],
  currentWorkspace: null,
  fileTree: null,
  branch: 'main',
  recentFiles: [],
  isLoading: false,
  error: null,

  // Load workspace list from Go Core
  loadWorkspaces: async () => {
    set({ isLoading: true, error: null })
    try {
      const workspaces = await runtimeClient.listWorkspaces()
      // Convert Go Core workspace to frontend type
      const converted: Workspace[] = workspaces.map(ws => ({
        id: ws.id,
        name: ws.name,
        rootPath: ws.path,
        storageMode: 'local' as const,
        branch: 'main',
        createdAt: ws.created_at,
        updatedAt: ws.updated_at,
      }))
      set({ workspaces: converted, isLoading: false })
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to load workspaces', isLoading: false })
    }
  },

  // Open a workspace
  openWorkspace: async (workspaceId: string) => {
    set({ isLoading: true, error: null })
    try {
      const tree = await runtimeClient.getWorkspaceTree(workspaceId)
      // Convert FileTreeNode to WorkspaceFile
      const convertNode = (node: any): WorkspaceFile => ({
        path: node.path,
        name: node.name,
        kind: node.is_dir ? 'directory' : 'file',
        size: 0,
        modifiedAt: new Date().toISOString(),
        children: node.children?.map(convertNode),
      })
      set({
        fileTree: tree.length > 0 ? convertNode(tree[0]) : null,
        currentWorkspace: {
          id: workspaceId,
          name: workspaceId,
          rootPath: workspaceId,
          storageMode: 'local' as const,
          branch: 'main',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        isLoading: false,
      })
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to open workspace', isLoading: false })
    }
  },

  // Read file content
  readFile: async (workspaceId: string, filePath: string) => {
    try {
      const content = await runtimeClient.readFile(workspaceId, filePath)
      return content
    } catch (err) {
      throw err
    }
  },

  // Write file content
  writeFile: async (workspaceId: string, filePath: string, content: string) => {
    try {
      await runtimeClient.writeFile(workspaceId, filePath, content)
    } catch (err) {
      throw err
    }
  },
}))

export default useWorkspaceStore

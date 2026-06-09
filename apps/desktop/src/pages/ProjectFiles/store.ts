import { create } from 'zustand'
import type { FileNode } from '../../services/fileService'
import { fileService } from '../../services/fileService'
import { useProjectStore } from '../../stores/useProjectStore'

interface ProjectFilesState {
  treeData: FileNode[]
  selectedFile: FileNode | null
  breadcrumbs: string[]
  isLoading: boolean
  error: string | null
  setTreeData: (data: FileNode[]) => void
  setSelectedFile: (file: FileNode | null) => void
  setBreadcrumbs: (paths: string[]) => void
  setIsLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  createFolder: (parentId: string, name: string) => Promise<void>
  uploadFile: (parentId: string, file: File) => Promise<void>
  deleteNode: (id: string) => Promise<void>
  renameNode: (id: string, newName: string) => Promise<void>
  refreshTree: () => Promise<void>
}

export const useProjectFilesStore = create<ProjectFilesState>()((set, get) => ({
  treeData: [],
  selectedFile: null,
  breadcrumbs: [],
  isLoading: false,
  error: null,

  setTreeData: (data) => set({ treeData: data }),
  setSelectedFile: (file) => set({ selectedFile: file }),
  setBreadcrumbs: (paths) => set({ breadcrumbs: paths }),
  setIsLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),

  createFolder: async (parentId, name) => {
    const state = get()
    const project = useProjectStore.getState().currentProject
    if (!project) {
      set({ error: 'No project selected' })
      return
    }
    try {
      set({ isLoading: true, error: null })
      const newNode = await fileService.createFolder(project.id, parentId, name)
      // Rebuild tree
      await state.refreshTree()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create folder'
      set({ error: message })
      throw err
    } finally {
      set({ isLoading: false })
    }
  },

  uploadFile: async (parentId, file) => {
    const state = get()
    const project = useProjectStore.getState().currentProject
    if (!project) {
      set({ error: 'No project selected' })
      return
    }
    try {
      set({ isLoading: true, error: null })
      await fileService.uploadFile(project.id, parentId, file)
      // Rebuild tree
      await state.refreshTree()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to upload file'
      set({ error: message })
      throw err
    } finally {
      set({ isLoading: false })
    }
  },

  deleteNode: async (id) => {
    const state = get()
    const project = useProjectStore.getState().currentProject
    if (!project) {
      set({ error: 'No project selected' })
      return
    }
    try {
      set({ isLoading: true, error: null })
      await fileService.deleteNode(project.id, id)
      // Rebuild tree
      await state.refreshTree()
      // Clear selection if the deleted node was selected
      if (state.selectedFile?.id === id) {
        set({ selectedFile: null })
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete node'
      set({ error: message })
      throw err
    } finally {
      set({ isLoading: false })
    }
  },

  renameNode: async (id, newName) => {
    const state = get()
    const project = useProjectStore.getState().currentProject
    if (!project) {
      set({ error: 'No project selected' })
      return
    }
    try {
      set({ isLoading: true, error: null })
      await fileService.renameNode(project.id, id, newName)
      // Rebuild tree
      await state.refreshTree()
      // Update selected file if it was renamed
      if (state.selectedFile?.id === id) {
        set({ selectedFile: { ...state.selectedFile, name: newName } })
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to rename node'
      set({ error: message })
      throw err
    } finally {
      set({ isLoading: false })
    }
  },

  refreshTree: async () => {
    const state = get()
    const project = useProjectStore.getState().currentProject
    if (!project) {
      set({ treeData: [], error: 'No project selected' })
      return
    }
    try {
      set({ isLoading: true, error: null })
      const data = await fileService.getProjectFiles(project.id)
      set({ treeData: data })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to refresh tree'
      set({ error: message, treeData: [] })
    } finally {
      set({ isLoading: false })
    }
  }
}))

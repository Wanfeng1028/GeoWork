// GeoWork Store - Workspace Store

import { create } from 'zustand'
import type { Workspace, WorkspaceFile, WorkspaceState } from '../types/workspace'

const useWorkspaceStore = create<WorkspaceState>((set) => ({
  currentWorkspace: null,
  fileTree: null,
  branch: 'main',
  recentFiles: [],
  isLoading: false,
  error: null
}))

export default useWorkspaceStore

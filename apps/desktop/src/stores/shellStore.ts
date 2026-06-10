// GeoWork Store - Shell Store

import { create } from 'zustand'
import type { ShellStore } from '../types/shell'

const useShellStore = create<ShellStore>((set) => ({
  activeMode: 'work',
  activeNavKey: 'workbench',
  sidebarCollapsed: false,
  rightDockVisible: true,
  activeRightPanel: 'task',
  bottomDockVisible: true,
  activeBottomPanel: 'terminal',
  conversationMinimapEnabled: true,

  setActiveMode: (mode) => set({ activeMode: mode }),
  
  setActiveNavKey: (key) => set({ activeNavKey: key }),
  
  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  
  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
  
  toggleRightDock: () => set((state) => ({ rightDockVisible: !state.rightDockVisible })),
  
  setActiveRightPanel: (panel) => set({ activeRightPanel: panel }),
  
  toggleBottomDock: () => set((state) => ({ bottomDockVisible: !state.bottomDockVisible })),
  
  setActiveBottomPanel: (panel) => set({ activeBottomPanel: panel }),
  
  setConversationMinimapEnabled: (enabled) => set({ conversationMinimapEnabled: enabled })
}))

export default useShellStore

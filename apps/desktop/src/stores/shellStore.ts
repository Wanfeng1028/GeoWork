// GeoWork Store - Shell Store

import { create } from 'zustand'
import type { ShellStore } from '../types/shell'

const useShellStore = create<ShellStore>((set) => ({
  activeMode: 'general',
  activeNavKey: 'workbench',
  sidebarCollapsed: false,
  rightDockVisible: false,
  activeRightPanel: 'task',
  bottomDockVisible: false,
  activeBottomPanel: 'terminal',
  conversationMinimapEnabled: false,
  commandPaletteOpen: false,
  composerFocusToken: 0,

  setActiveMode: (mode) => set({ activeMode: mode }),
  
  setActiveNavKey: (key) => set({ activeNavKey: key }),
  
  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  
  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
  
  toggleRightDock: () => set((state) => ({ rightDockVisible: !state.rightDockVisible })),
  
  setActiveRightPanel: (panel) => set({ activeRightPanel: panel }),

  openRightDock: (panel) => set((state) => ({
    rightDockVisible: true,
    activeRightPanel: panel ?? state.activeRightPanel
  })),

  closeRightDock: () => set({ rightDockVisible: false }),
  
  toggleBottomDock: () => set((state) => ({ bottomDockVisible: !state.bottomDockVisible })),
  
  setActiveBottomPanel: (panel) => set({ activeBottomPanel: panel }),

  openBottomDock: (panel) => set((state) => ({
    bottomDockVisible: true,
    activeBottomPanel: panel ?? state.activeBottomPanel
  })),

  closeBottomDock: () => set({ bottomDockVisible: false }),
  
  setConversationMinimapEnabled: (enabled) => set({ conversationMinimapEnabled: enabled }),

  setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),

  focusComposer: () => set((state) => ({ composerFocusToken: state.composerFocusToken + 1 }))
}))

export default useShellStore

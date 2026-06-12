import { create } from 'zustand'

export type Theme = 'light' | 'dark'

interface AppState {
  theme: Theme
  setTheme: (theme: Theme) => void

  activeModule: string
  setActiveModule: (module: string) => void

  sidebarCollapsed: boolean
  toggleSidebar: () => void
}

export const useAppStore = create<AppState>()((set) => ({
  theme: 'light',
  setTheme: (theme) => set({ theme }),

  activeModule: 'workbench',
  setActiveModule: (module) => set({ activeModule: module }),

  sidebarCollapsed: false,
  toggleSidebar: () =>
    set((state) => ({
      sidebarCollapsed: !state.sidebarCollapsed,
    })),
}))

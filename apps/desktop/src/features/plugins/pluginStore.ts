// GeoWork Desktop - Plugin Store
// Zustand store for plugin marketplace state

import { create } from 'zustand'
import pluginClient, { type Plugin } from './pluginClient'

interface PluginState {
  plugins: Plugin[]
  isLoading: boolean
  error: string | null
  loadPlugins: () => Promise<void>
  install: (id: string) => Promise<void>
  uninstall: (id: string) => Promise<void>
  toggle: (id: string, enabled: boolean) => Promise<void>
}

const usePluginStore = create<PluginState>((set) => ({
  plugins: [],
  isLoading: false,
  error: null,

  loadPlugins: async () => {
    set({ isLoading: true, error: null })
    try {
      const plugins = await pluginClient.listMarketplace()
      set({ plugins, isLoading: false })
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Failed to load plugins',
        isLoading: false,
      })
    }
  },

  install: async (id: string) => {
    set({ isLoading: true, error: null })
    try {
      await pluginClient.installPlugin(id)
      set((state) => ({
        plugins: state.plugins.map((p) =>
          p.id === id ? { ...p, installed: true, enabled: true } : p
        ),
        isLoading: false,
      }))
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Failed to install plugin',
        isLoading: false,
      })
    }
  },

  uninstall: async (id: string) => {
    set({ isLoading: true, error: null })
    try {
      await pluginClient.uninstallPlugin(id)
      set((state) => ({
        plugins: state.plugins.map((p) =>
          p.id === id ? { ...p, installed: false, enabled: false } : p
        ),
        isLoading: false,
      }))
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Failed to uninstall plugin',
        isLoading: false,
      })
    }
  },

  toggle: async (id: string, enabled: boolean) => {
    set({ isLoading: true, error: null })
    try {
      await pluginClient.togglePlugin(id, enabled)
      set((state) => ({
        plugins: state.plugins.map((p) =>
          p.id === id ? { ...p, enabled } : p
        ),
        isLoading: false,
      }))
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Failed to toggle plugin',
        isLoading: false,
      })
    }
  },
}))

export default usePluginStore

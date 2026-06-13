// GeoWork Store - Settings Store

import { create } from 'zustand'
import type { SettingsState } from '../types/settings'
import { mockSettings } from '../mocks/settings.mock'

const savedTheme = (() => {
  try {
    const theme = window.localStorage.getItem('geowork.theme')
    return theme === 'dark' || theme === 'light' || theme === 'system' ? theme : mockSettings.appearance.theme
  } catch {
    return mockSettings.appearance.theme
  }
})()

const useSettingsStore = create<SettingsState>((set) => ({
  settings: {
    ...mockSettings,
    appearance: {
      ...mockSettings.appearance,
      theme: savedTheme
    }
  },
  isLoading: false,
  resolvedTheme: savedTheme === 'system'
    ? (window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark')
    : savedTheme,

  setTheme: (theme) => {
    try {
      window.localStorage.setItem('geowork.theme', theme)
    } catch {
      // localStorage can be unavailable in test environments.
    }
    const resolvedTheme = theme === 'system'
      ? (window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark')
      : theme
    set((state) => ({
      settings: {
        ...state.settings,
        appearance: {
          ...state.settings.appearance,
          theme
        }
      },
      resolvedTheme
    }))
  },

  setResolvedTheme: (resolvedTheme) => set({ resolvedTheme }),

  updateSetting: (path: string, value: unknown) => {
    set((state) => {
      const settings = JSON.parse(JSON.stringify(state.settings))
      const keys = path.split('.')
      let obj: unknown = settings
      for (let i = 0; i < keys.length - 1; i++) {
        obj = (obj as Record<string, unknown>)[keys[i]]
      }
      if (obj && typeof obj === 'object') {
        (obj as Record<string, unknown>)[keys[keys.length - 1]] = value
      }
      return { settings }
    })
  }
}))

export default useSettingsStore

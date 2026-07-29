// GeoWork Store - Settings Store

import { create } from 'zustand'
import type { Settings } from '../types/settings'
import { mockSettings } from '../mocks/settings.mock'

const useSettingsStore = create<{
  settings: Settings
  isLoading: boolean
  setTheme: (theme: Settings['appearance']['theme']) => void
  updateSetting: (path: string, value: unknown) => void
}>((set) => ({
  settings: {
    ...mockSettings,
    appearance: {
      ...mockSettings.appearance,
      theme: 'dark'
    }
  },
  isLoading: false,

  setTheme: (theme) => {
    try {
      window.localStorage.setItem('geowork.theme', theme)
    } catch {
      // localStorage can be unavailable in test environments.
    }
    set((state) => ({
      settings: {
        ...state.settings,
        appearance: {
          ...state.settings.appearance,
          theme
        }
      }
    }))
  },

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

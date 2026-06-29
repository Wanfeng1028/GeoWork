// GeoWork Store - Settings Store

import { create } from 'zustand'
import type { SettingsState } from '../types/settings'
import { mockSettings } from '../mocks/settings.mock'

const THEME_KEY = 'geowork.theme'

const VALID_THEMES: GeoWorkTheme[] = [
  'light', 'dark', 'auto',
  'light-glass', 'dark-glass',
  'classic-light', 'classic-dark',
  'light-parchment', 'dark-parchment',
]

function isGeoWorkTheme(value: string | null): value is GeoWorkTheme {
  return value !== null && (VALID_THEMES as string[]).includes(value)
}

const savedTheme = (() => {
  try {
    const theme = window.localStorage.getItem(THEME_KEY)
    // Backward-compat: legacy 'system' value maps to 'auto'.
    if (theme === 'system') return 'auto' as GeoWorkTheme
    return isGeoWorkTheme(theme) ? theme : mockSettings.appearance.theme
  } catch {
    return mockSettings.appearance.theme
  }
})()

function resolve(theme: GeoWorkTheme): ResolvedTheme {
  return resolveTheme(theme)
}

const useSettingsStore = create<SettingsState>((set) => ({
  settings: {
    ...mockSettings,
    appearance: {
      ...mockSettings.appearance,
      theme: savedTheme
    }
  },
  isLoading: false,
  resolvedTheme: resolve(savedTheme),

  setTheme: (theme) => {
    try {
      window.localStorage.setItem(THEME_KEY, theme)
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
      },
      resolvedTheme: resolve(theme)
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

// Re-export so existing imports from settingsStore keep working.
export { DEFAULT_THEME }

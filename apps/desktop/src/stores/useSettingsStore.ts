import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface SettingsState {
  settings: Record<string, unknown>
  setSettings: (settings: Record<string, unknown>) => void
  updateSetting: (key: string, value: unknown) => void
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      settings: {},

      setSettings: (settings) => set({ settings }),

      updateSetting: (key, value) =>
        set((state) => ({
          settings: { ...state.settings, [key]: value },
        })),
    }),
    {
      name: 'geowork-settings-storage',
    }
  )
)

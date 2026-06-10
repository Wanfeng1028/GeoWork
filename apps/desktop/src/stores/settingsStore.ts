// GeoWork Store - Settings Store

import { create } from 'zustand'
import type { SettingsState } from '../types/settings'
import { mockSettings } from '../mocks/settings.mock'

const useSettingsStore = create<SettingsState>((set) => ({
  settings: mockSettings,
  isLoading: false
}))

export default useSettingsStore

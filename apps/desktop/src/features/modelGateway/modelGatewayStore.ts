// GeoWork Model Gateway Store
// Zustand store for model provider, speed profile, and usage state management

import { create } from 'zustand'
import modelGatewayClient, { type ModelProvider, type SpeedProfile, type UsageSummary } from './modelGatewayClient'

export interface ModelGatewayState {
  providers: ModelProvider[]
  speedProfiles: SpeedProfile[]
  usageSummary: UsageSummary | null
  isLoading: boolean
  selectedProviderId: string
  selectedSpeedProfile: string
  loadProviders: () => Promise<void>
  setSelectedProvider: (id: string) => void
  setSelectedSpeedProfile: (id: string) => void
  loadSpeedProfiles: () => Promise<void>
  loadUsage: () => Promise<void>
}

const useModelGatewayStore = create<ModelGatewayState>((set) => ({
  providers: [],
  speedProfiles: [],
  usageSummary: null,
  isLoading: false,
  selectedProviderId: '',
  selectedSpeedProfile: '1x',

  loadProviders: async () => {
    set({ isLoading: true })
    try {
      const providers = await modelGatewayClient.listProviders()
      set({ providers, isLoading: false })
    } catch (error) {
      set({ isLoading: false })
    }
  },

  setSelectedProvider: (id: string) => {
    set({ selectedProviderId: id })
  },

  setSelectedSpeedProfile: (id: string) => {
    set({ selectedSpeedProfile: id })
  },

  loadSpeedProfiles: async () => {
    set({ isLoading: true })
    try {
      const speedProfiles = await modelGatewayClient.getSpeedProfiles()
      set({ speedProfiles, isLoading: false })
    } catch {
      set({ isLoading: false })
    }
  },

  loadUsage: async () => {
    set({ isLoading: true })
    try {
      const usageSummary = await modelGatewayClient.getUsageSummary()
      set({ usageSummary, isLoading: false })
    } catch {
      set({ isLoading: false })
    }
  },
}))

export default useModelGatewayStore

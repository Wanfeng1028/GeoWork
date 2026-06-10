// GeoWork Account Store
// Manages user account, team, plan, credits, sync status, and login state

import { create } from 'zustand'
import { cloudClient } from '../services/cloudClient'
import type {
  User,
  Team,
  TeamMember,
  UsageSummary,
  ModelUsage,
  PlanInfo,
  MarketplaceItem,
} from '../services/cloudClient'

export type LoginState = 'logged_out' | 'logging_in' | 'authenticated'

export interface AccountState {
  // User state
  user: User | null
  teams: Team[]
  teamMembers: TeamMember[]
  plan: PlanInfo | null
  credits: number
  usage: UsageSummary | null
  modelUsage: ModelUsage[]
  marketplacePlugins: MarketplaceItem[]
  marketplaceSkills: MarketplaceItem[]

  // Login state
  loginState: LoginState
  syncStatus: 'synced' | 'syncing' | 'error' | 'unknown'
  error: string | null

  // Actions
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  refreshUser: () => Promise<void>
  updateProfile: (name?: string, avatar_url?: string) => Promise<void>
  loadTeams: () => Promise<void>
  loadUsage: () => Promise<void>
  loadPlan: () => Promise<void>
  loadMarketplace: () => Promise<void>
  setSyncStatus: (status: 'synced' | 'syncing' | 'error' | 'unknown') => void
  clearError: () => void
}

const defaultState = {
  user: null,
  teams: [],
  teamMembers: [],
  plan: null,
  credits: 0,
  usage: null,
  modelUsage: [],
  marketplacePlugins: [],
  marketplaceSkills: [],
  loginState: 'logged_out' as LoginState,
  syncStatus: 'unknown' as const,
  error: null,
}

export const useAccountStore = create<AccountState>((set, get) => ({
  ...defaultState,

  login: async (email: string, password: string) => {
    set({ loginState: 'logging_in', error: null })
    try {
      const response = await cloudClient.login({ email, password })
      cloudClient.setToken(response.access_token)
      set({
        user: response.user,
        loginState: 'authenticated',
        credits: 0,
      })
    } catch (e: any) {
      set({ loginState: 'logged_out', error: e.message })
    }
  },

  logout: async () => {
    try {
      await cloudClient.logout()
    } catch {
      // Ignore logout errors
    }
    cloudClient.clearToken()
    set({ ...defaultState, loginState: 'logged_out' })
  },

  refreshUser: async () => {
    try {
      const user = await cloudClient.me()
      set({ user })
    } catch {
      // Token may be expired, don't change state
    }
  },

  updateProfile: async (name?: string, avatar_url?: string) => {
    try {
      const user = await cloudClient.updateProfile({ name, avatar_url })
      set({ user })
    } catch (e: any) {
      set({ error: e.message })
    }
  },

  loadTeams: async () => {
    try {
      const teams = await cloudClient.listTeams()
      set({ teams })
    } catch {
      // Ignore errors
    }
  },

  loadUsage: async () => {
    try {
      const [usage, credits, modelUsage] = await Promise.all([
        cloudClient.getUsageSummary(),
        cloudClient.getCredits(),
        cloudClient.getModelUsage(),
      ])
      set({ usage, credits: credits.credits, modelUsage })
    } catch {
      // Ignore errors
    }
  },

  loadPlan: async () => {
    try {
      const plan = await cloudClient.getPlan()
      set({ plan })
    } catch {
      // Ignore errors
    }
  },

  loadMarketplace: async () => {
    try {
      const [plugins, skills] = await Promise.all([
        cloudClient.listPlugins(),
        cloudClient.listSkills(),
      ])
      set({ marketplacePlugins: plugins, marketplaceSkills: skills })
    } catch {
      // Ignore errors
    }
  },

  setSyncStatus: (syncStatus) => set({ syncStatus }),

  clearError: () => set({ error: null }),
}))

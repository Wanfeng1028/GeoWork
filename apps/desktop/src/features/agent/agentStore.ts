// GeoWork Desktop - Agent Feature Store
// Zustand store for agent task lifecycle and recovery state

import { create } from 'zustand'
import agentClient, { type AgentPlan, type AgentStep, type RecoveryState } from './agentClient'

interface AgentState {
  currentPlan: AgentPlan | null
  currentSteps: AgentStep[]
  isRunning: boolean
  isRecovering: boolean
  recoveryState: RecoveryState | null
  error: string | null

  loadPlan: (taskId: string) => Promise<void>
  loadSteps: (taskId: string) => Promise<void>
  cancelTask: (taskId: string) => Promise<void>
  recoverTask: (taskId: string) => Promise<void>
  checkRecoveryState: (taskId: string) => Promise<void>
  clear: () => void
}

const useAgentStore = create<AgentState>((set) => ({
  currentPlan: null,
  currentSteps: [],
  isRunning: false,
  isRecovering: false,
  recoveryState: null,
  error: null,

  loadPlan: async (taskId) => {
    set({ error: null })
    try {
      const plan = await agentClient.getPlan(taskId)
      set({ currentPlan: plan, isRunning: true })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load agent plan'
      set({ error: message, isRunning: false })
    }
  },

  loadSteps: async (taskId) => {
    set({ error: null })
    try {
      const steps = await agentClient.getSteps(taskId)
      set({ currentSteps: steps })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load agent steps'
      set({ error: message })
    }
  },

  cancelTask: async (taskId) => {
    set({ error: null })
    try {
      await agentClient.cancelTask(taskId)
      set({ isRunning: false })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to cancel task'
      set({ error: message })
    }
  },

  recoverTask: async (taskId) => {
    set({ error: null, isRecovering: true })
    try {
      const result = await agentClient.recoverTask(taskId)
      if (result.success) {
        const state = await agentClient.getRecoveryState(taskId)
        set({ isRecovering: false, recoveryState: state })
      } else {
        set({ isRecovering: false })
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to recover task'
      set({ error: message, isRecovering: false })
    }
  },

  checkRecoveryState: async (taskId) => {
    set({ error: null })
    try {
      const state = await agentClient.getRecoveryState(taskId)
      set({ recoveryState: state })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to check recovery state'
      set({ error: message })
    }
  },

  clear: () =>
    set({
      currentPlan: null,
      currentSteps: [],
      isRunning: false,
      isRecovering: false,
      recoveryState: null,
      error: null,
    }),
}))

export default useAgentStore

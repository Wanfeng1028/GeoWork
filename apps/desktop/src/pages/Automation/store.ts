import { create } from 'zustand'
import { automationService } from '../../services/automationService'

// ─── Types ───────────────────────────────────────────────────────────────────

export type TriggerType = 'file-change' | 'data-ready' | 'task-complete' | 'manual' | 'cron'

export type RunStatus = 'running' | 'completed' | 'failed'

export interface AutomationRule {
  id: string
  name: string
  description: string
  trigger: TriggerType
  target: string // expert id or skill id
  params: Record<string, unknown>
  enabled: boolean
  lastRunAt?: string
  lastRunStatus?: 'success' | 'failed'
}

export interface CronJob {
  id: string
  name: string
  cronExpression: string
  target: string
  params: Record<string, unknown>
  enabled: boolean
  nextRunAt?: string
  lastRunAt?: string
}

export interface AutomationRun {
  id: string
  ruleId?: string
  jobId?: string
  status: RunStatus
  startedAt: string
  completedAt?: string
  message?: string
}

// ─── Store ───────────────────────────────────────────────────────────────────

interface AutomationState {
  rules: AutomationRule[]
  jobs: CronJob[]
  runs: AutomationRun[]
  loading: boolean
  error: string | null

  // Rules
  fetchRules: () => Promise<void>
  createRule: (rule: Omit<AutomationRule, 'id'>) => Promise<void>
  updateRule: (rule: AutomationRule) => Promise<void>
  deleteRule: (id: string) => Promise<void>
  toggleRule: (id: string) => void

  // Cron Jobs
  fetchJobs: () => Promise<void>
  createJob: (job: Omit<CronJob, 'id'>) => Promise<void>
  updateJob: (job: CronJob) => Promise<void>
  deleteJob: (id: string) => Promise<void>
  toggleJob: (id: string) => void

  // Execution
  triggerRule: (id: string) => Promise<void>
  triggerJob: (id: string) => Promise<void>
  fetchRuns: () => Promise<void>
}

export const useAutomationStore = create<AutomationState>((set, get) => ({
  rules: [],
  jobs: [],
  runs: [],
  loading: false,
  error: null,

  // ── Rules ────────────────────────────────────────────────────────────────

  fetchRules: async () => {
    set({ loading: true, error: null })
    try {
      const rules = await automationService.getAutomationRules()
      set({ rules, loading: false })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch rules'
      set({ error: msg, loading: false })
    }
  },

  createRule: async (rule) => {
    set({ loading: true, error: null })
    try {
      const created = await automationService.createAutomationRule(rule)
      set((state) => ({ rules: [created, ...state.rules], loading: false }))
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create rule'
      set({ error: msg, loading: false })
    }
  },

  updateRule: async (rule) => {
    set({ loading: true, error: null })
    try {
      await automationService.updateAutomationRule(rule)
      set((state) => ({
        rules: state.rules.map((r) => (r.id === rule.id ? rule : r)),
        loading: false,
      }))
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update rule'
      set({ error: msg, loading: false })
    }
  },

  deleteRule: async (id) => {
    set({ loading: true, error: null })
    try {
      await automationService.deleteAutomationRule(id)
      set((state) => ({
        rules: state.rules.filter((r) => r.id !== id),
        loading: false,
      }))
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to delete rule'
      set({ error: msg, loading: false })
    }
  },

  toggleRule: (id) => {
    set((state) => ({
      rules: state.rules.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r)),
    }))
  },

  // ── Cron Jobs ────────────────────────────────────────────────────────────

  fetchJobs: async () => {
    set({ loading: true, error: null })
    try {
      const jobs = await automationService.getCronJobs()
      set({ jobs, loading: false })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch cron jobs'
      set({ error: msg, loading: false })
    }
  },

  createJob: async (job) => {
    set({ loading: true, error: null })
    try {
      const created = await automationService.createCronJob(job)
      set((state) => ({ jobs: [created, ...state.jobs], loading: false }))
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create cron job'
      set({ error: msg, loading: false })
    }
  },

  updateJob: async (job) => {
    set({ loading: true, error: null })
    try {
      await automationService.updateCronJob(job)
      set((state) => ({
        jobs: state.jobs.map((j) => (j.id === job.id ? job : j)),
        loading: false,
      }))
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update cron job'
      set({ error: msg, loading: false })
    }
  },

  deleteJob: async (id) => {
    set({ loading: true, error: null })
    try {
      await automationService.deleteCronJob(id)
      set((state) => ({
        jobs: state.jobs.filter((j) => j.id !== id),
        loading: false,
      }))
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to delete cron job'
      set({ error: msg, loading: false })
    }
  },

  toggleJob: (id) => {
    set((state) => ({
      jobs: state.jobs.map((j) => (j.id === id ? { ...j, enabled: !j.enabled } : j)),
    }))
  },

  // ── Execution ────────────────────────────────────────────────────────────

  triggerRule: async (id) => {
    set({ loading: true, error: null })
    try {
      await automationService.triggerAutomationRule(id)
      await get().fetchRuns()
      set({ loading: false })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to trigger rule'
      set({ error: msg, loading: false })
    }
  },

  triggerJob: async (id) => {
    set({ loading: true, error: null })
    try {
      await automationService.triggerCronJob(id)
      await get().fetchRuns()
      set({ loading: false })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to trigger cron job'
      set({ error: msg, loading: false })
    }
  },

  fetchRuns: async () => {
    try {
      const runs = await automationService.getAutomationRuns()
      set({ runs })
    } catch {
      // non-fatal – runs are secondary
    }
  },
}))

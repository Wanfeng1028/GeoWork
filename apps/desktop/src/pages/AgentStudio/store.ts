import { create } from 'zustand'
import {
  getWorkflows as apiGetWorkflows,
  createWorkflow as apiCreateWorkflow,
  saveWorkflow as apiSaveWorkflow,
  deleteWorkflow as apiDeleteWorkflow,
  startWorkflowRun as apiStartWorkflowRun,
  stopWorkflowRun as apiStopWorkflowRun,
  getWorkflowLogs as apiGetWorkflowLogs,
  getRuns as apiGetRuns,
  type Workflow,
  type AgentRun
} from '../../services/agentService'

interface AgentStudioState {
  workflows: Workflow[]
  runs: AgentRun[]
  selectedWorkflow: Workflow | null
  selectedRun: AgentRun | null
  loading: boolean
  error: string | null

  // Workflow actions
  loadWorkflows: () => Promise<void>
  createWorkflow: (name: string, description: string) => Promise<void>
  saveWorkflow: (workflow: Workflow) => Promise<void>
  deleteWorkflow: (id: string) => Promise<void>
  selectWorkflow: (workflow: Workflow | null) => void

  // Run actions
  loadRuns: (workflowId?: string) => Promise<void>
  startRun: (workflowId: string) => Promise<void>
  stopRun: (runId: string) => Promise<void>
  getLogs: (runId: string) => Promise<string[]>
  selectRun: (run: AgentRun | null) => void

  // Utility
  refresh: () => Promise<void>
}

export const useAgentStudioStore = create<AgentStudioState>()((set, get) => ({
  workflows: [],
  runs: [],
  selectedWorkflow: null,
  selectedRun: null,
  loading: false,
  error: null,

  loadWorkflows: async () => {
    set({ loading: true, error: null })
    try {
      const workflows = await apiGetWorkflows()
      set({ workflows, loading: false })
    } catch (err: any) {
      set({ error: err.message, loading: false })
    }
  },

  createWorkflow: async (name: string, description: string) => {
    set({ loading: true, error: null })
    try {
      const workflow = await apiCreateWorkflow(name, description)
      set((state) => ({ workflows: [workflow, ...state.workflows], loading: false }))
    } catch (err: any) {
      set({ error: err.message, loading: false })
    }
  },

  saveWorkflow: async (workflow: Workflow) => {
    set({ loading: true, error: null })
    try {
      await apiSaveWorkflow(workflow)
      set((state) => ({
        workflows: state.workflows.map((w) => (w.id === workflow.id ? workflow : w)),
        selectedWorkflow: state.selectedWorkflow?.id === workflow.id ? workflow : state.selectedWorkflow,
        loading: false
      }))
    } catch (err: any) {
      set({ error: err.message, loading: false })
    }
  },

  deleteWorkflow: async (id: string) => {
    set({ loading: true, error: null })
    try {
      await apiDeleteWorkflow(id)
      set((state) => ({
        workflows: state.workflows.filter((w) => w.id !== id),
        selectedWorkflow: state.selectedWorkflow?.id === id ? null : state.selectedWorkflow,
        loading: false
      }))
    } catch (err: any) {
      set({ error: err.message, loading: false })
    }
  },

  selectWorkflow: (workflow) => set({ selectedWorkflow: workflow }),

  loadRuns: async (workflowId?: string) => {
    set({ loading: true, error: null })
    try {
      const runs = await apiGetRuns(workflowId)
      set({ runs, loading: false })
    } catch (err: any) {
      set({ error: err.message, loading: false })
    }
  },

  startRun: async (workflowId: string) => {
    set({ loading: true, error: null })
    try {
      const run = await apiStartWorkflowRun(workflowId)
      set((state) => ({ runs: [run, ...state.runs], selectedRun: run, loading: false }))
    } catch (err: any) {
      set({ error: err.message, loading: false })
    }
  },

  stopRun: async (runId: string) => {
    set({ loading: true, error: null })
    try {
      await apiStopWorkflowRun(runId)
      set((state) => ({
        runs: state.runs.map((r) => (r.id === runId ? { ...r, status: 'cancelled' as const } : r)),
        loading: false
      }))
    } catch (err: any) {
      set({ error: err.message, loading: false })
    }
  },

  getLogs: async (runId: string) => {
    try {
      return await apiGetWorkflowLogs(runId)
    } catch (err: any) {
      set({ error: err.message })
      return []
    }
  },

  selectRun: (run) => set({ selectedRun: run }),

  refresh: async () => {
    const { loadWorkflows, loadRuns } = get()
    await Promise.all([loadWorkflows(), loadRuns()])
  }
}))

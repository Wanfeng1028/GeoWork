// GeoWork Store - Task Store (integrated with Go Core API + SSE)

import { create } from 'zustand'
import type { Task as TaskType, RuntimeEvent, TaskState, TaskStep, TaskStatus } from '../types/task'
import type { Task as RuntimeTask } from '../services/runtimeClient'
import runtimeClient from '../services/runtimeClient'
import sseClient from '../services/sseClient'

export interface ToolCallInfo {
  id: string
  toolName: string
  input: Record<string, unknown>
  output?: string
  status: 'running' | 'completed' | 'failed'
  startedAt?: string
  completedAt?: string
}

const useTaskStore = create<TaskState>((set, get) => ({
  tasks: [],
  currentTask: null,
  events: [],
  toolCalls: [],
  pendingSteps: [],
  runningStep: undefined,
  completedSteps: [],
  failedSteps: [],
  isLoading: false,
  error: null,

  // Load task list from Go Core
  loadTasks: async () => {
    set({ isLoading: true, error: null })
    try {
      const tasks = await runtimeClient.listTasks()
      const converted: TaskType[] = tasks.map(t => ({
        id: t.id,
        workspaceId: '',
        mode: '',
        permissionLevel: '',
        model: '',
        status: t.status as TaskType['status'],
        plan: [],
        artifacts: [],
        createdAt: t.created_at,
        updatedAt: t.updated_at,
      }))
      set({ tasks: converted, isLoading: false })
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to load tasks', isLoading: false })
    }
  },

  // Create a new task
  createTask: async (data: Record<string, any>) => {
    set({ isLoading: true, error: null })
    try {
      const task = await runtimeClient.createTask(data)
      const converted: TaskType = {
        id: task.id,
        workspaceId: data.workspaceId || '',
        mode: data.mode || '',
        permissionLevel: data.permissionLevel || '',
        model: data.model || '',
        status: task.status as TaskType['status'],
        plan: [],
        artifacts: [],
        createdAt: task.created_at,
        updatedAt: task.updated_at,
      }
      set((state) => ({ tasks: [converted, ...state.tasks], currentTask: converted, isLoading: false }))
      ;(get() as any).subscribeToTask(converted.id)
      return converted
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to create task', isLoading: false })
      throw err
    }
  },

  // Subscribe to task SSE events
  subscribeToTask: (taskId: string) => {
    sseClient.subscribeTask(taskId, (data) => {
      set((state) => {
        const updatedEvents = [...state.events, data as RuntimeEvent]
        const updatedTask = state.currentTask ? { ...state.currentTask } : null
        if (!updatedTask) return { events: updatedEvents }

        if (data.status) {
          updatedTask.status = data.status as TaskStatus
        }
        if (data.error) {
          updatedTask.error = data.error
        }
        if (data.plan) {
          updatedTask.plan = data.plan as TaskStep[]
        }

        // Compute derived steps from updated plan
        const plan = updatedTask.plan || []
        return {
          events: updatedEvents,
          currentTask: updatedTask,
          toolCalls: updatedEvents
            .filter(e => e.type.startsWith('tool.call.'))
            .map(e => ({
              id: e.id,
              toolName: (e.data?.toolName as string) || 'unknown',
              input: (e.data?.input as Record<string, unknown>) || {},
              output: e.data?.output as string,
              status: (e.type === 'tool.call.completed' ? 'completed' : e.type === 'tool.call.failed' ? 'failed' : 'running') as 'running' | 'completed' | 'failed',
              startedAt: e.timestamp,
              completedAt: e.timestamp,
            })),
          pendingSteps: plan.filter(s => s.status === 'pending'),
          runningStep: plan.find(s => s.status === 'running'),
          completedSteps: plan.filter(s => s.status === 'completed'),
          failedSteps: plan.filter(s => s.status === 'failed'),
        }
      })
    })
  },

  // Cancel a task
  cancelTask: async (taskId: string) => {
    try {
      await runtimeClient.cancelTask(taskId)
      set((state) => {
        const updatedTask = state.currentTask?.id === taskId
          ? { ...state.currentTask, status: 'cancelled' as const }
          : state.currentTask
        const plan = updatedTask?.plan || []
        return {
          tasks: state.tasks.map(t => t.id === taskId ? { ...t, status: 'cancelled' as const } : t),
          currentTask: updatedTask,
          pendingSteps: plan.filter(s => s.status === 'pending'),
          runningStep: undefined,
          completedSteps: plan.filter(s => s.status === 'completed'),
          failedSteps: plan.filter(s => s.status === 'failed'),
        }
      })
    } catch (err) {
      console.error('Failed to cancel task:', err)
    }
  },

  // Set active/current task
  setActiveTask: (task: TaskType | null) => {
    const plan = task?.plan || []
    set({
      currentTask: task,
      pendingSteps: plan.filter(s => s.status === 'pending'),
      runningStep: plan.find(s => s.status === 'running'),
      completedSteps: plan.filter(s => s.status === 'completed'),
      failedSteps: plan.filter(s => s.status === 'failed'),
    })
  },
}))

export default useTaskStore

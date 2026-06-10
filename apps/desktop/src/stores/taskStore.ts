// GeoWork Store - Task Store (integrated with Go Core API + SSE)

import { create } from 'zustand'
import type { Task as TaskType, RuntimeEvent, TaskState, TaskStep } from '../types/task'
import type { Task as RuntimeTask } from '../services/runtimeClient'
import runtimeClient from '../services/runtimeClient'
import sseClient from '../services/sseClient'

const useTaskStore = create<TaskState>((set, get) => ({
  tasks: [],
  currentTask: null,
  events: [],
  isLoading: false,
  error: null,

  // Load task list from Go Core
  loadTasks: async () => {
    set({ isLoading: true, error: null })
    try {
      const tasks = await runtimeClient.listTasks()
      // Convert runtime tasks to store tasks
      const converted: TaskType[] = tasks.map(t => ({
        id: t.id,
        workspaceId: '',
        mode: '',
        permissionLevel: '',
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
        workspaceId: '',
        mode: '',
        permissionLevel: '',
        status: task.status as TaskType['status'],
        plan: [],
        artifacts: [],
        createdAt: task.created_at,
        updatedAt: task.updated_at,
      }
      set((state) => ({ tasks: [converted, ...state.tasks], currentTask: converted, isLoading: false }))
      // Auto-subscribe to SSE events
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
      set((state) => ({
        events: [...state.events, data as RuntimeEvent],
        currentTask: state.currentTask ? { ...state.currentTask, ...data } : null,
      }))
    })
  },

  // Cancel a task
  cancelTask: async (taskId: string) => {
    try {
      await runtimeClient.cancelTask(taskId)
      set((state) => ({
        tasks: state.tasks.map(t => t.id === taskId ? { ...t, status: 'completed' as const } : t),
      }))
    } catch (err) {
      console.error('Failed to cancel task:', err)
    }
  },
}))

export default useTaskStore

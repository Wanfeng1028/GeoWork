import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface Step {
  id: string
  title: string
  description: string
  toolName: string
  status: string
  riskLevel: string
}

export interface Artifact {
  id: string
  name: string
  type: string
  path: string
  mimeType: string
}

export interface Task {
  id: string
  projectId: string
  prompt: string
  mode: string
  status: 'created' | 'running' | 'completed' | 'failed' | 'paused' | 'cancelled'
  plan: Step[]
  artifacts: Artifact[]
  createdAt: string
  updatedAt: string
}

interface TaskState {
  tasks: Task[]
  currentTask: Task | null
  setTasks: (tasks: Task[]) => void
  setCurrentTask: (task: Task) => void
  addTask: (task: Task) => void
  updateTask: (id: string, updates: Partial<Task>) => void
  clearTasks: () => void
}

export const useTaskStore = create<TaskState>()(
  persist(
    (set) => ({
      tasks: [],
      currentTask: null,

      setTasks: (tasks) => set({ tasks }),

      setCurrentTask: (task) => set({ currentTask: task }),

      addTask: (task) =>
        set((state) => ({
          tasks: [task, ...state.tasks],
        })),

      updateTask: (id, updates) =>
        set((state) => ({
          tasks: state.tasks.map((t) =>
            t.id === id ? { ...t, ...updates, updatedAt: new Date().toISOString() } : t
          ),
          currentTask:
            state.currentTask?.id === id
              ? { ...state.currentTask, ...updates, updatedAt: new Date().toISOString() }
              : state.currentTask,
        })),

      clearTasks: () => set({ tasks: [], currentTask: null }),
    }),
    {
      name: 'geowork-tasks-storage',
      partialize: (state) => ({
        tasks: state.tasks,
        currentTask: state.currentTask,
      }),
    }
  )
)

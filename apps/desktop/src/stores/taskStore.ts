// GeoWork Store - Task Store

import { create } from 'zustand'
import type { Task, RuntimeEvent, TaskState } from '../types/task'

const useTaskStore = create<TaskState>((set) => ({
  tasks: [],
  currentTask: null,
  events: [],
  isLoading: false
}))

export default useTaskStore

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface Project {
  id: string
  name: string
  mode: string
  path: string
  createdAt: string
}

interface ProjectState {
  projects: Project[]
  currentProject: Project | null
  setProjects: (projects: Project[]) => void
  setCurrentProject: (project: Project) => void
  addProject: (project: Project) => void
}

export const useProjectStore = create<ProjectState>()(
  persist(
    (set) => ({
      projects: [],
      currentProject: null,

      setProjects: (projects) => set({ projects }),

      setCurrentProject: (project) => set({ currentProject: project }),

      addProject: (project) =>
        set((state) => ({
          projects: [...state.projects, project],
        })),
    }),
    {
      name: 'geowork-projects-storage',
      partialize: (state) => ({
        projects: state.projects,
        currentProject: state.currentProject,
      }),
    }
  )
)

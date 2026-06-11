// GeoWork Store - Artifact Store

import { create } from 'zustand'
import type { Artifact, ArtifactState } from '../types/artifact'

const useArtifactStore = create<ArtifactState>((set, get) => ({
  artifacts: [],
  currentPreview: null,
  isLoading: false,

  setArtifacts: (artifacts: Artifact[]) => {
    set({ artifacts })
  },

  addArtifact: (artifact: Artifact) => {
    set((state) => {
      const existing = state.artifacts.find(a => a.id === artifact.id)
      if (existing) {
        return { artifacts: state.artifacts.map(a => a.id === artifact.id ? artifact : a) }
      }
      return { artifacts: [...state.artifacts, artifact] }
    })
  },

  setPreviewArtifact: (artifact: Artifact | null) => {
    set({ currentPreview: artifact })
  },

  clearPreview: () => {
    set({ currentPreview: null })
  },
}))

export default useArtifactStore

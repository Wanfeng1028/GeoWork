// GeoWork Store - Artifact Store

import { create } from 'zustand'
import type { ArtifactState } from '../types/artifact'

const useArtifactStore = create<ArtifactState>((set) => ({
  artifacts: [],
  currentPreview: null,
  isLoading: false
}))

export default useArtifactStore

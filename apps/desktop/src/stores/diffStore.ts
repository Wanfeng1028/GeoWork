// GeoWork Store - Diff Store

import { create } from 'zustand'
import type { DiffState } from '../types/diff'

const useDiffStore = create<DiffState>((set) => ({
  diffs: [],
  currentDiff: null,
  acceptedFiles: new Set(),
  rejectedFiles: new Set()
}))

export default useDiffStore

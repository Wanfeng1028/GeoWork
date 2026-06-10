// GeoWork Store - Diff Store

import { create } from 'zustand'
import type { DiffState } from '../types/diff'

const useDiffStore = create<DiffState>((set) => ({
  diffs: [],
  currentDiff: null,
  acceptedFiles: new Set(),
  rejectedFiles: new Set(),
  setAcceptedFile: (filePath) =>
    set((state) => {
      const next = new Set(state.acceptedFiles);
      next.add(filePath);
      return { acceptedFiles: next };
    }),
  setRejectedFile: (filePath) =>
    set((state) => {
      const next = new Set(state.rejectedFiles);
      next.add(filePath);
      return { rejectedFiles: next };
    }),
  setAllAccepted: (filePath) =>
    set((state) => {
      const next = new Set(state.acceptedFiles);
      next.add(filePath);
      return { acceptedFiles: next };
    }),
  setAllRejected: (filePath) =>
    set((state) => {
      const next = new Set(state.rejectedFiles);
      next.add(filePath);
      return { rejectedFiles: next };
    }),
}))

export default useDiffStore

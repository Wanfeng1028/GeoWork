// GeoWork Store - Diff Store

import { create } from 'zustand'
import type { Diff, DiffState } from '../types/diff'

const useDiffStore = create<DiffState>((set, get) => ({
  diffs: [],
  currentDiff: null,
  activeDiffId: null,
  acceptedFiles: new Set<string>(),
  rejectedFiles: new Set<string>(),

  setActiveDiffId: (diffId: string | null) => {
    set({ activeDiffId: diffId })
    if (diffId) {
      const diff = get().diffs.find(d => d.id === diffId)
      set({ currentDiff: diff || null })
    } else {
      set({ currentDiff: null })
    }
  },

  setDiffs: (diffs: Diff[]) => {
    set({ diffs })
    if (diffs.length > 0 && !get().activeDiffId) {
      const first = diffs[0]
      set({ currentDiff: first, activeDiffId: first.id })
    }
  },

  addDiff: (diff: Diff) => {
    set((state) => {
      const existing = state.diffs.find(d => d.id === diff.id)
      if (existing) {
        return { diffs: state.diffs.map(d => d.id === diff.id ? diff : d) }
      }
      return {
        diffs: [...state.diffs, diff],
        currentDiff: diff,
        activeDiffId: diff.id,
      }
    })
  },

  acceptFile: (filePath: string) => {
    set((state) => {
      const nextAccepted = new Set(state.acceptedFiles)
      nextAccepted.add(filePath)
      const nextRejected = new Set(state.rejectedFiles)
      nextRejected.delete(filePath)
      return { acceptedFiles: nextAccepted, rejectedFiles: nextRejected }
    })
  },

  rejectFile: (filePath: string) => {
    set((state) => {
      const nextRejected = new Set(state.rejectedFiles)
      nextRejected.add(filePath)
      const nextAccepted = new Set(state.acceptedFiles)
      nextAccepted.delete(filePath)
      return { acceptedFiles: nextAccepted, rejectedFiles: nextRejected }
    })
  },

  acceptAll: (diffId?: string) => {
    const state = get()
    const targetDiff = diffId ? state.diffs.find(d => d.id === diffId) : state.currentDiff
    const filesToAccept = new Set<string>()
    if (targetDiff) {
      targetDiff.files.forEach(f => filesToAccept.add(f.path))
    } else {
      state.diffs.forEach(d => d.files.forEach(f => filesToAccept.add(f.path)))
    }
    const next = new Set<string>()
    filesToAccept.forEach(p => next.add(p))
    set({ acceptedFiles: next, rejectedFiles: new Set() })
  },

  rejectAll: (diffId?: string) => {
    const state = get()
    const targetDiff = diffId ? state.diffs.find(d => d.id === diffId) : state.currentDiff
    const filesToReject = new Set<string>()
    if (targetDiff) {
      targetDiff.files.forEach(f => filesToReject.add(f.path))
    } else {
      state.diffs.forEach(d => d.files.forEach(f => filesToReject.add(f.path)))
    }
    const next = new Set<string>()
    filesToReject.forEach(p => next.add(p))
    set({ acceptedFiles: new Set(), rejectedFiles: next })
  },

  setAcceptedFile: (filePath) => {
    set((state) => {
      const next = new Set(state.acceptedFiles);
      next.add(filePath);
      return { acceptedFiles: next };
    });
  },
  setRejectedFile: (filePath) => {
    set((state) => {
      const next = new Set(state.rejectedFiles);
      next.add(filePath);
      return { rejectedFiles: next };
    });
  },
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

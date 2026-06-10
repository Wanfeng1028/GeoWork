// GeoWork Store - Permission Store (integrated with Go Core API)

import { create } from 'zustand'
import type { PermissionState, PermissionLevel } from '../types/permission'
import runtimeClient from '../services/runtimeClient'

const usePermissionStore = create<PermissionState>((set, get) => ({
  defaultLevel: 'limited',
  pendingRequests: [],
  policies: {},

  // Load pending permission requests
  loadPendingRequests: async () => {
    try {
      const requests = await runtimeClient.getPermissionRequests()
      set({ pendingRequests: requests })
    } catch (err) {
      console.error('Failed to load permission requests:', err)
    }
  },

  // Approve a permission request
  approveRequest: async (id: string, reason: string = 'User approved') => {
    try {
      await runtimeClient.approvePermission(id, reason)
      set((state) => ({
        pendingRequests: state.pendingRequests.filter(r => r.id !== id),
      }))
    } catch (err) {
      console.error('Failed to approve permission:', err)
    }
  },

  // Deny a permission request
  denyRequest: async (id: string, reason: string = 'User denied') => {
    try {
      await runtimeClient.denyPermission(id, reason)
      set((state) => ({
        pendingRequests: state.pendingRequests.filter(r => r.id !== id),
      }))
    } catch (err) {
      console.error('Failed to deny permission:', err)
    }
  },

  // Set default permission level
  setDefaultLevel: (level: PermissionLevel) => {
    set({ defaultLevel: level })
  },
}))

export default usePermissionStore

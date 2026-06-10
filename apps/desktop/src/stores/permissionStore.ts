// GeoWork Store - Permission Store

import { create } from 'zustand'
import type { PermissionState } from '../types/permission'

const usePermissionStore = create<PermissionState>((set) => ({
  defaultLevel: 'limited',
  pendingRequests: [],
  policies: {}
}))

export default usePermissionStore

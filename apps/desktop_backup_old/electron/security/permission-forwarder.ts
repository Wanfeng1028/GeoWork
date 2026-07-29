// GeoWork Electron - Security Permission Forwarder
// Gate dangerous system operations behind permission approval

import { ipcMain, BrowserWindow, IpcMainInvokeEvent } from 'electron';

export const ALLOWED_CHANNELS = new Set<string>([
  'security:requestPermission',
  'security:getPermissionStatus',
  'security:listPermissions',
  'security:approvePermission',
  'security:denyPermission',
]);

interface PendingPermission {
  id: string;
  category: string;
  detail: Record<string, unknown>;
  requestedAt: number;
}

const pendingPermissions = new Map<string, PendingPermission>();
const permissionCache = new Map<string, boolean>();

/**
 * Dangerous operation categories that require user approval
 */
export const DANGEROUS_CATEGORIES = {
  SCREENSHOT: 'screenshot',
  CLIPBOARD_READ: 'clipboard:read',
  CLIPBOARD_WRITE: 'clipboard:write',
  OPEN_LOCAL_APP: 'openLocalApp',
  REGISTER_SHORTCUT: 'registerGlobalShortcut',
  CREATE_TRAY: 'createTray',
  OPEN_OUTSIDE_WORKSPACE: 'openOutsideWorkspace',
} as const;

/**
 * Check if a permission request is allowed based on safety policy.
 * Returns the permission ID if approval needed, or { allowed: true } for safe/saved ops.
 */
export function isPermissionAllowed(
  category: string,
  detail?: Record<string, unknown>
): { allowed: boolean; permissionId?: string } {
  // Check cache first (for repeated approved operations)
  const cacheKey = `${category}:${JSON.stringify(detail || {})}`
  if (permissionCache.has(cacheKey)) {
    return { allowed: permissionCache.get(cacheKey)! }
  }

  // Always-safe operations
  const safeCategories = new Set(['notifications', 'app-data-path', 'platform-info'])
  if (safeCategories.has(category)) {
    permissionCache.set(cacheKey, true)
    return { allowed: true }
  }

  // Dangerous operations require user approval
  const id = generatePermissionId()
  pendingPermissions.set(id, {
    id,
    category,
    detail: detail || {},
    requestedAt: Date.now(),
  })

  return { allowed: false, permissionId: id }
}

function generatePermissionId(): string {
  return `perm_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

export function registerPermissionForwarder(mainWindow: BrowserWindow) {
  // Request a permission — returns { permissionId } for dangerous ops, or { allowed: true } for safe ones
  ipcMain.handle(
    'security:requestPermission',
    async (
      _event: IpcMainInvokeEvent,
      category: string,
      detail?: Record<string, unknown>
    ) => {
      const result = isPermissionAllowed(category, detail)
      return result
    }
  )

  // Get current permission status
  ipcMain.handle('security:getPermissionStatus', async (_event: IpcMainInvokeEvent, category: string) => {
    const safeCategories = new Set(['notifications', 'app-data-path', 'platform-info'])
    return {
      status: safeCategories.has(category) ? 'granted' : 'pending',
      category,
    }
  })

  // List all pending permission requests
  ipcMain.handle('security:listPermissions', async () => {
    return Array.from(pendingPermissions.values())
  })

  // Approve a pending permission request
  ipcMain.handle(
    'security:approvePermission',
    async (_event: IpcMainInvokeEvent, permissionId: string) => {
      const pending = pendingPermissions.get(permissionId)
      if (pending) {
        // Cache the approval
        const cacheKey = `${pending.category}:${JSON.stringify(pending.detail || {})}`
        permissionCache.set(cacheKey, true)
        
        pendingPermissions.delete(permissionId)
        return { approved: true, category: pending.category }
      }
      return { approved: false, error: 'Permission request not found' }
    }
  )

  // Deny a pending permission request
  ipcMain.handle(
    'security:denyPermission',
    async (_event: IpcMainInvokeEvent, permissionId: string, reason?: string) => {
      const pending = pendingPermissions.get(permissionId)
      if (pending) {
        pendingPermissions.delete(permissionId)
        return { denied: true, category: pending.category }
      }
      return { denied: false, error: 'Permission request not found' }
    }
  )
}

export { pendingPermissions, permissionCache }

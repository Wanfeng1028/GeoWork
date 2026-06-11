// GeoWork Electron - Clipboard IPC
// Gates dangerous clipboard operations behind permission approval

import { ipcMain, clipboard, nativeImage, IpcMainInvokeEvent } from 'electron'
import { isPermissionAllowed, DANGEROUS_CATEGORIES } from '../security/permission-forwarder'

export const ALLOWED_CHANNELS = new Set<string>([
  'clipboard:readText',
  'clipboard:writeText',
  'clipboard:readImage',
  'clipboard:writeImage',
  'clipboard:has',
])

function checkClipboardPermission(operation: 'read' | 'write', detail?: Record<string, unknown>): { allowed: boolean; permissionId?: string } {
  const category = operation === 'read' ? DANGEROUS_CATEGORIES.CLIPBOARD_READ : DANGEROUS_CATEGORIES.CLIPBOARD_WRITE
  return isPermissionAllowed(category, detail)
}

export function registerClipboardIPC() {
  ipcMain.handle('clipboard:readText', async () => {
    const result = checkClipboardPermission('read')
    if (!result.allowed) {
      return { error: 'Permission required. Use security:approvePermission to allow.' }
    }
    return clipboard.readText()
  })

  ipcMain.handle('clipboard:writeText', async (_event: IpcMainInvokeEvent, text: string) => {
    const result = checkClipboardPermission('write', { textLength: text.length })
    if (!result.allowed) {
      return { error: 'Permission required. Use security:approvePermission to allow.' }
    }
    clipboard.writeText(text)
    return { success: true }
  })

  ipcMain.handle('clipboard:readImage', async () => {
    const result = checkClipboardPermission('read')
    if (!result.allowed) {
      return { error: 'Permission required. Use security:approvePermission to allow.' }
    }
    const img = clipboard.readImage()
    if (img.isEmpty()) return null
    return img.toDataURL()
  })

  ipcMain.handle('clipboard:writeImage', async (_event: IpcMainInvokeEvent, dataUrl: string) => {
    const result = checkClipboardPermission('write')
    if (!result.allowed) {
      return { error: 'Permission required. Use security:approvePermission to allow.' }
    }
    const img = nativeImage.createFromDataURL(dataUrl)
    clipboard.writeImage(img)
    return { success: true }
  })

  ipcMain.handle('clipboard:has', async (_event: IpcMainInvokeEvent, format: string) => {
    return clipboard.has(format || 'text')
  })
}

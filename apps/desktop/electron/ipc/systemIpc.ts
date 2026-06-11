// GeoWork Electron - System IPC
// Consolidated system operations, tray, menu, global shortcuts
// Gates dangerous operations behind permission approval

import {
  ipcMain,
  nativeTheme,
  app,
  Tray,
  Menu,
  globalShortcut,
  IpcMainInvokeEvent,
  Notification,
  BrowserWindow,
} from 'electron'
import { isPermissionAllowed, DANGEROUS_CATEGORIES } from '../security/permission-forwarder'

export interface TrayOptions {
  iconPath: string
  menu?: Array<{ label: string; click?: () => void }>
  tooltip?: string
}

let trayInstance: Tray | null = null
const registeredShortcuts = new Map<string, () => void>()

export const ALLOWED_CHANNELS = new Set<string>([
  'system:showNotification',
  'system:getPlatformInfo',
  'system:getAppDataPath',
  'system:captureScreenshot',
  'system:createTray',
  'system:registerGlobalShortcut',
  'system:setApplicationMenu',
  'tray:destroy',
  'tray:getState',
  'shortcuts:unregister',
  'shortcuts:unregisterAll',
])

export function registerSystemIPC(mainWindow: BrowserWindow) {
  // --- System Operations ---

  ipcMain.handle(
    'system:showNotification',
    async (
      _event: IpcMainInvokeEvent,
      options: { title: string; body: string; icon?: string }
    ) => {
      const notification = new Notification({
        title: options.title || 'GeoWork',
        body: options.body || '',
        icon: options.icon,
      })
      notification.show()
      return { success: true }
    }
  )

  ipcMain.handle('system:getPlatformInfo', async () => {
    return {
      platform: process.platform,
      arch: process.arch,
      appVersion: app.getVersion(),
      appDataPath: app.getPath('appData'),
      userDataPath: app.getPath('userData'),
      logsPath: app.getPath('logs'),
    }
  })

  ipcMain.handle('system:getAppDataPath', async () => {
    return app.getPath('appData')
  })

  // Screenshot requires permission approval
  ipcMain.handle('system:captureScreenshot', async () => {
    const result = isPermissionAllowed(DANGEROUS_CATEGORIES.SCREENSHOT)
    if (!result.allowed) {
      return {
        success: false,
        error: 'Permission required. Use security:approvePermission to allow.',
        permissionId: result.permissionId,
      }
    }

    try {
      const { desktopCapturer } = require('electron')
      const sources = await desktopCapturer.getSources({
        types: ['screen', 'window'],
        thumbnailSize: { width: 1920, height: 1080 },
      })
      if (sources.length === 0) {
        return { success: false, error: 'No screen sources available' }
      }
      return {
        success: true,
        dataUrl: sources[0].thumbnail.toDataURL(),
      }
    } catch (err: unknown) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      }
    }
  })

  // --- Tray ---

  ipcMain.handle(
    'system:createTray',
    async (_event: IpcMainInvokeEvent, trayOptions: TrayOptions) => {
      const result = isPermissionAllowed(DANGEROUS_CATEGORIES.CREATE_TRAY, {
        iconPath: trayOptions.iconPath,
      })
      if (!result.allowed) {
        return {
          success: false,
          error: 'Permission required. Use security:approvePermission to allow.',
          permissionId: result.permissionId,
        }
      }

      try {
        if (trayInstance) {
          trayInstance.destroy()
        }
        trayInstance = new Tray(trayOptions.iconPath)
        const contextMenu = Menu.buildFromTemplate(trayOptions.menu || [])
        trayInstance.setToolTip(trayOptions.tooltip || 'GeoWork')
        trayInstance.setContextMenu(contextMenu)
        trayInstance.on('click', () => {
          if (mainWindow.isMinimized()) mainWindow.restore()
          mainWindow.show()
        })
        return { success: true }
      } catch (err: unknown) {
        return {
          success: false,
          error: err instanceof Error ? err.message : String(err),
        }
      }
    }
  )

  ipcMain.handle('tray:destroy', async () => {
    if (trayInstance) {
      trayInstance.destroy()
      trayInstance = null
    }
    return { success: true }
  })

  ipcMain.handle('tray:getState', async () => {
    return { exists: trayInstance !== null }
  })

  // --- Global Shortcuts ---

  ipcMain.handle(
    'system:registerGlobalShortcut',
    async (_event: IpcMainInvokeEvent, shortcut: string, callback: () => void) => {
      const result = isPermissionAllowed(DANGEROUS_CATEGORIES.REGISTER_SHORTCUT, {
        shortcut,
      })
      if (!result.allowed) {
        return {
          success: false,
          error: 'Permission required. Use security:approvePermission to allow.',
          permissionId: result.permissionId,
        }
      }

      const registered = globalShortcut.register(shortcut, callback)
      if (registered) {
        registeredShortcuts.set(shortcut, callback)
      }
      return { success: registered }
    }
  )

  ipcMain.handle('shortcuts:unregister', async (_event: IpcMainInvokeEvent, shortcut: string) => {
    const result = globalShortcut.unregister(shortcut)
    if (result) registeredShortcuts.delete(shortcut)
    return { success: result }
  })

  ipcMain.handle('shortcuts:unregisterAll', async () => {
    globalShortcut.unregisterAll()
    registeredShortcuts.clear()
    return { success: true }
  })

  // --- Application Menu ---

  ipcMain.handle(
    'system:setApplicationMenu',
    async (_event: IpcMainInvokeEvent, menuTemplate: Array<Record<string, unknown>>) => {
      const menu = Menu.buildFromTemplate(menuTemplate as Array<any>)
      Menu.setApplicationMenu(menu)
      return { success: true }
    }
  )
}

// Called on app shutdown
export function cleanupSystemIPC() {
  registeredShortcuts.clear()
  globalShortcut.unregisterAll()
  if (trayInstance) {
    trayInstance.destroy()
    trayInstance = null
  }
}

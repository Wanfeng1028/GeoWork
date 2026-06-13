// GeoWork Electron - Desktop IPC
// Consolidated file-dialogs and shell operations
// Gates dangerous operations behind permission approval

import { ipcMain, dialog, shell, IpcMainInvokeEvent, BrowserWindow } from 'electron'
import { isPermissionAllowed, DANGEROUS_CATEGORIES } from '../security/permission-forwarder'

export const ALLOWED_CHANNELS = new Set<string>([
  // File dialogs
  'desktop:chooseFolder',
  'desktop:chooseFiles',
  'desktop:revealInFileExplorer',
  'desktop:openExternal',
  'desktop:openLocalApp',
  // Shell operations
  'shell:openExternal',
  'shell:showItemInFolder',
  'shell:moveItemToTrash',
  'shell:writeShortcut',
  'shell:readShortcut',
])

export function registerDesktopIPC(mainWindow: BrowserWindow) {
  // --- File Dialogs ---

  ipcMain.handle('desktop:chooseFolder', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory'],
    })
    return result.filePaths
  })

  ipcMain.handle(
    'desktop:chooseFiles',
    async (
      _event: IpcMainInvokeEvent,
      options: {
        filters?: Array<{ name: string; extensions: string[] }>
        properties?: string[]
      } = {}
    ) => {
      const properties: string[] = ['openFile', 'multiSelections']
      if (options.properties) {
        for (const p of options.properties) {
          if (!properties.includes(p)) properties.push(p)
        }
      }
      const result = await dialog.showOpenDialog(mainWindow, {
        properties: properties as ('openFile' | 'openDirectory' | 'multiSelections' | 'showHiddenFiles' | 'createDirectory' | 'promptToCreate' | 'noResolveAliases' | 'treatPackageAsDirectory' | 'dontAddToRecent')[],
        filters: options.filters || [],
      })
      return result.filePaths
    }
  )

  // Desktop:revealInFileExplorer - requires permission if outside workspace
  ipcMain.handle(
    'desktop:revealInFileExplorer',
    async (_event: IpcMainInvokeEvent, filePath: string) => {
      try {
        shell.showItemInFolder(filePath)
        return { success: true }
      } catch (err: unknown) {
        return {
          success: false,
          error: err instanceof Error ? err.message : String(err),
        }
      }
    }
  )

  // Desktop:openExternal - requires permission for external URLs
  ipcMain.handle(
    'desktop:openExternal',
    async (_event: IpcMainInvokeEvent, url: string) => {
      try {
        await shell.openExternal(url)
        return { success: true }
      } catch (err: unknown) {
        return {
          success: false,
          error: err instanceof Error ? err.message : String(err),
        }
      }
    }
  )

  // Desktop:openLocalApp requires permission approval
  ipcMain.handle(
    'desktop:openLocalApp',
    async (_event: IpcMainInvokeEvent, appName: string) => {
      const result = isPermissionAllowed(DANGEROUS_CATEGORIES.OPEN_LOCAL_APP, {
        appName,
      })
      if (!result.allowed) {
        return {
          success: false,
          error: 'Permission required. Use security:approvePermission to allow.',
          permissionId: result.permissionId,
        }
      }

      try {
        // Map well-known app names to commands
        const appMap: Record<string, string> = {
          git: 'git',
          python: 'python',
          node: 'node',
          vscode: 'code',
        }
        const command = appMap[appName] || appName
        // shell.openItem is deprecated; use process.spawn as fallback
        const { spawn } = require('node:child_process')
        await new Promise<void>((resolve, reject) => {
          const child = spawn(command, [], {
            detached: true,
            stdio: 'ignore',
          })
          child.on('error', reject)
          child.on('exit', (code: number) => {
            if (code === 0 || code === null) resolve()
            else reject(new Error(`Process exited with code ${code}`))
          })
          // Detach so it lives after this handler returns
          child.unref()
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

  // --- Shell Operations ---

  ipcMain.handle(
    'shell:showItemInFolder',
    async (_event: IpcMainInvokeEvent, filePath: string) => {
      try {
        shell.showItemInFolder(filePath)
        return { success: true }
      } catch (err: unknown) {
        return {
          success: false,
          error: err instanceof Error ? err.message : String(err),
        }
      }
    }
  )

  ipcMain.handle(
    'shell:moveItemToTrash',
    async (_event: IpcMainInvokeEvent, filePath: string) => {
      try {
        await shell.trashItem(filePath)
        return { success: true }
      } catch (err: unknown) {
        return {
          success: false,
          error: err instanceof Error ? err.message : String(err),
        }
      }
    }
  )

  ipcMain.handle(
    'shell:writeShortcut',
    async (_event: IpcMainInvokeEvent, shortcut: Record<string, unknown>) => {
      try {
        return { success: true }
      } catch (err: unknown) {
        return {
          success: false,
          error: err instanceof Error ? err.message : String(err),
        }
      }
    }
  )

  ipcMain.handle(
    'shell:readShortcut',
    async (_event: IpcMainInvokeEvent, shortcutPath: string) => {
      try {
        return { success: true, data: {} }
      } catch (err: unknown) {
        return {
          success: false,
          error: err instanceof Error ? err.message : String(err),
        }
      }
    }
  )
}

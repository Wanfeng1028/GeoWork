import { app, BrowserWindow, ipcMain } from 'electron'
import { join } from 'node:path'
import { startRuntime, stopRuntime, checkHealth, getRuntimeStatus } from './runtime'
import { registerDesktopIPC } from './ipc/desktopIpc'
import { registerRuntimeIPC } from './ipc/runtimeIpc'
import { registerSystemIPC } from './ipc/systemIpc'
import { registerClipboardIPC } from './ipc/clipboardIpc'
import { registerNotificationIPC } from './ipc/notificationIpc'
import { registerPermissionForwarder } from './security/permission-forwarder'
import { initTray } from './local/tray'
import { buildMenu, getDefaultMenu } from './local/menu'
import { registerLoggingIPC, writeLog } from './local/logging'
import { cleanupShortcuts } from './local/shortcuts'
import { cleanupSystemIPC } from './ipc/systemIpc'

let mainWindow: BrowserWindow | null = null
let isAppReady = false

async function createWindow() {
  await startRuntime()

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 940,
    minWidth: 1180,
    minHeight: 760,
    title: 'GeoWork',
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      contextIsolation: true,
    },
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    await mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    await mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  // Initialize local modules after window is ready
  registerDesktopIPC(mainWindow)
  registerRuntimeIPC()
  registerSystemIPC(mainWindow)
  registerClipboardIPC()
  registerNotificationIPC()
  registerPermissionForwarder(mainWindow)
  registerLoggingIPC()

  // Build default menu
  const defaultMenu = getDefaultMenu()
  buildMenu(defaultMenu)

  // Initialize tray
  initTray(mainWindow)

  // Register runtime status IPC
  ipcMain.handle('runtime:status', async () => {
    return getRuntimeStatus()
  })

  ipcMain.handle('runtime:health', async () => {
    return await checkHealth()
  })

  isAppReady = true
  writeLog('main', 'GeoWork main window created and initialized')
}

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  stopRuntime()
  cleanupSystemIPC()
  cleanupShortcuts()
  if (process.platform !== 'darwin') app.quit()
})

app.on('will-quit', () => {
  stopRuntime()
  cleanupSystemIPC()
  cleanupShortcuts()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

// Handle app crashed — graceful recovery
app.on('renderer-process-crashed', (event, webContents, kill) => {
  writeLog('error', `Renderer process crashed: ${webContents.getUrl()}`)
  if (mainWindow) {
    mainWindow.webContents.reload()
  }
})

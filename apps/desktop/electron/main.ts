import { app, BrowserWindow } from 'electron'
import { join } from 'node:path'
import { startRuntime, stopRuntime } from './runtime'

let mainWindow: BrowserWindow | null = null

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
      contextIsolation: true
    }
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    await mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    await mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  stopRuntime()
  if (process.platform !== 'darwin') app.quit()
})

// GeoWork Electron - Local Tray Manager
// Single global tray instance, accessible from main process

import { app, BrowserWindow, Tray, Menu } from 'electron'
import * as path from 'node:path'
import * as fs from 'node:fs'

let trayInstance: Tray | null = null

export function initTray(mainWindow: BrowserWindow): Tray | null {
  if (trayInstance) return trayInstance

  const isDev = process.env.NODE_ENV === 'development'
  const iconPath = path.resolve(
    __dirname,
    isDev ? '../../assets/tray-icon.png' : '../../dist/assets/tray-icon.png',
  )

  // 托盘是增强项而非必需项：图标缺失（打包路径差异）或无系统托盘
  // （headless CI / 部分 Linux 桌面）时静默降级，不能阻断主窗口装配——
  // createWindow 在 initTray 之后还要注册 runtime:status/token/health 等
  // 关键 IPC handler，这里抛错会让它们全部跳过。
  if (!fs.existsSync(iconPath)) {
    console.warn('[tray] icon not found, skipping tray:', iconPath)
    return null
  }

  try {
    trayInstance = new Tray(iconPath)
  } catch (err) {
    console.warn('[tray] failed to create tray (no system tray available?):', err)
    return null
  }
  trayInstance.setToolTip('GeoWork')

  const contextMenu = Menu.buildFromTemplate([
    {
      label: '显示主窗口',
      click: () => {
        if (mainWindow.isMinimized()) mainWindow.restore()
        mainWindow.show()
      },
    },
    { type: 'separator' },
    {
      label: '退出',
      click: () => {
        app.quit()
      },
    },
  ])

  trayInstance.setContextMenu(contextMenu)

  trayInstance.on('click', () => {
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.show()
  })

  return trayInstance
}

export function getTray(): Tray | null {
  return trayInstance
}

export function destroyTray(): void {
  if (trayInstance) {
    trayInstance.destroy()
    trayInstance = null
  }
}

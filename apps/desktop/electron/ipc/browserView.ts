// GeoWork Electron - Built-in Browser (WebContentsView)
// Manages embedded Chromium views for the IDE "浏览器" tab, enabling
// Google Earth / GEE Code Editor (which block iframes via X-Frame-Options).

import { ipcMain, BrowserWindow, WebContentsView } from 'electron'

interface BrowserBounds {
  x: number
  y: number
  width: number
  height: number
}

interface BrowserEntry {
  view: WebContentsView
  visible: boolean
}

const views = new Map<string, BrowserEntry>()
let mainWindow: BrowserWindow | null = null

// 持久化 partition,保证 Google OAuth 登录态/cookie 跨会话保留
const PERSIST_PARTITION = 'persist:geowork-browser'

function attachListeners(id: string, view: WebContentsView) {
  const wc = view.webContents
  wc.on('did-navigate', (_e, url) => {
    mainWindow?.webContents.send(`browser:did-navigate-${id}`, url)
  })
  wc.on('did-navigate-in-page', (_e, url) => {
    mainWindow?.webContents.send(`browser:did-navigate-${id}`, url)
  })
  wc.on('did-start-loading', () => {
    mainWindow?.webContents.send(`browser:loading-${id}`, true)
  })
  wc.on('did-stop-loading', () => {
    mainWindow?.webContents.send(`browser:loading-${id}`, false)
  })
  wc.on('page-title-updated', (_e, title) => {
    mainWindow?.webContents.send(`browser:title-${id}`, title)
  })
}

export function registerBrowserViewIPC(win: BrowserWindow) {
  mainWindow = win

  // 创建一个浏览器视图实例(不自动导航,等待 navigate)
  ipcMain.handle('browser:create', async (_e, id: string) => {
    if (!mainWindow || mainWindow.isDestroyed()) return { error: 'window not ready' }
    if (views.has(id)) return { ok: true }

    const view = new WebContentsView({
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        partition: PERSIST_PARTITION,
      },
    })
    const entry: BrowserEntry = { view, visible: false }
    views.set(id, entry)
    mainWindow.contentView.addChildView(view)
    // 初始隐藏,等 setBounds 后再显示
    view.setVisible(false)
    attachListeners(id, view)
    return { ok: true }
  })

  ipcMain.handle('browser:navigate', async (_e, id: string, url: string) => {
    const entry = views.get(id)
    if (!entry) return { error: 'view not found' }
    try {
      await entry.view.webContents.loadURL(url)
      return { ok: true }
    } catch (err: any) {
      return { error: err?.message || 'load failed' }
    }
  })

  ipcMain.handle('browser:setBounds', async (_e, id: string, bounds: BrowserBounds) => {
    const entry = views.get(id)
    if (!entry) return { error: 'view not found' }
    const w = Math.max(1, Math.round(bounds.width))
    const h = Math.max(1, Math.round(bounds.height))
    entry.view.setBounds({
      x: Math.round(bounds.x),
      y: Math.round(bounds.y),
      width: w,
      height: h,
    })
    return { ok: true }
  })

  ipcMain.handle('browser:setVisible', async (_e, id: string, visible: boolean) => {
    const entry = views.get(id)
    if (!entry) return { error: 'view not found' }
    entry.visible = visible
    entry.view.setVisible(visible)
    return { ok: true }
  })

  ipcMain.handle('browser:back', async (_e, id: string) => {
    const entry = views.get(id)
    if (!entry) return { error: 'view not found' }
    entry.view.webContents.navigationHistory.goBack()
    return { ok: true }
  })

  ipcMain.handle('browser:forward', async (_e, id: string) => {
    const entry = views.get(id)
    if (!entry) return { error: 'view not found' }
    entry.view.webContents.navigationHistory.goForward()
    return { ok: true }
  })

  ipcMain.handle('browser:reload', async (_e, id: string) => {
    const entry = views.get(id)
    if (!entry) return { error: 'view not found' }
    entry.view.webContents.reload()
    return { ok: true }
  })

  ipcMain.handle('browser:getUrl', async (_e, id: string) => {
    const entry = views.get(id)
    if (!entry) return { error: 'view not found' }
    return { url: entry.view.webContents.getURL() }
  })

  ipcMain.handle('browser:destroy', async (_e, id: string) => {
    const entry = views.get(id)
    if (!entry) return { ok: true }
    try {
      mainWindow?.contentView.removeChildView(entry.view)
      ;(entry.view.webContents as any).destroy?.()
    } catch {
      /* ignore */
    }
    views.delete(id)
    return { ok: true }
  })

  // 窗口关闭时清理所有视图
  win.on('closed', () => {
    views.clear()
    mainWindow = null
  })
}

/** 隐藏所有浏览器视图(切走 tab 时调用)。 */
export function hideAllBrowserViews() {
  for (const entry of views.values()) {
    entry.visible = false
    entry.view.setVisible(false)
  }
}

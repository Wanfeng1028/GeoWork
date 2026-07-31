// GeoWork Electron - Real Terminal (node-pty + xterm.js)
// node-pty is an optional native module; if it fails to load (missing build
// tools), the terminal panel degrades gracefully instead of crashing the app.

import { ipcMain, BrowserWindow } from 'electron'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

let pty: any = null
let ptyLoadError: string | null = null
try {
  pty = require('node-pty')
} catch (e: any) {
  ptyLoadError = e?.message || String(e)
}

interface TermSession {
  proc: any
}

const sessions = new Map<string, TermSession>()

function pickShell(): string {
  if (process.platform === 'win32') {
    return process.env.COMSPEC || 'powershell.exe'
  }
  if (process.platform === 'darwin') return process.env.SHELL || 'zsh'
  return process.env.SHELL || 'bash'
}

export function registerTerminalIPC(win: BrowserWindow) {
  ipcMain.handle('term:create', async (
    _e,
    opts: { id: string; cwd?: string; shell?: string; cols?: number; rows?: number }
  ) => {
    if (!pty) {
      return {
        error: `node-pty 未安装或加载失败,请运行 npm run rebuild。\n详情: ${ptyLoadError}`,
      }
    }
    const { id, cwd, shell, cols, rows } = opts
    if (sessions.has(id)) return { ok: true }

    try {
      const proc = pty.spawn(shell || pickShell(), [], {
        name: 'xterm-256color',
        cols: cols && cols > 0 ? cols : 80,
        rows: rows && rows > 0 ? rows : 24,
        cwd: cwd || process.env.USERPROFILE || process.env.HOME || process.cwd(),
        env: { ...process.env, TERM: 'xterm-256color' } as Record<string, string>,
      })

      proc.onData((data: string) => {
        if (!win.isDestroyed()) win.webContents.send(`term:data-${id}`, data)
      })
      proc.onExit(({ exitCode }: { exitCode: number }) => {
        if (!win.isDestroyed()) win.webContents.send(`term:exit-${id}`, exitCode)
        sessions.delete(id)
      })

      sessions.set(id, { proc })
      return { ok: true }
    } catch (err: any) {
      return { error: err?.message || '创建终端会话失败' }
    }
  })

  ipcMain.handle('term:write', async (_e, id: string, data: string) => {
    const s = sessions.get(id)
    if (!s) return { error: 'session not found' }
    try {
      s.proc.write(data)
      return { ok: true }
    } catch (err: any) {
      return { error: err?.message }
    }
  })

  ipcMain.handle('term:resize', async (_e, id: string, cols: number, rows: number) => {
    const s = sessions.get(id)
    if (!s) return { error: 'session not found' }
    try {
      s.proc.resize(Math.max(1, cols), Math.max(1, rows))
      return { ok: true }
    } catch {
      return { ok: true }
    }
  })

  ipcMain.handle('term:kill', async (_e, id: string) => {
    const s = sessions.get(id)
    if (!s) return { ok: true }
    try {
      s.proc.kill()
    } catch {
      /* ignore */
    }
    sessions.delete(id)
    return { ok: true }
  })

  win.on('closed', () => {
    for (const s of sessions.values()) {
      try { s.proc.kill() } catch { /* ignore */ }
    }
    sessions.clear()
  })
}

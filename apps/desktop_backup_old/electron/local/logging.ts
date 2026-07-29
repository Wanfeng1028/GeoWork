// GeoWork Electron - Logging Utility
// Writes logs to the Electron logs directory

import { app, ipcMain, IpcMainInvokeEvent } from 'electron';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

const LOG_DIR = path.join(app.getPath('logs'), 'geowork-electron');

export function ensureLogDir(): void {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }
}

export function getLogFilePath(type: 'main' | 'runtime' | 'error' = 'main'): string {
  const date = new Date().toISOString().split('T')[0];
  return path.join(LOG_DIR, `${type}-${date}.log`);
}

export function writeLog(type: 'main' | 'runtime' | 'error', message: string): void {
  ensureLogDir();
  const timestamp = new Date().toISOString();
  const line = `[${timestamp}] [${type}] ${message}\n`;
  const logFile = getLogFilePath(type);
  fs.appendFileSync(logFile, line, 'utf-8');
}

export function readLogs(lines = 100): string[] {
  ensureLogDir();
  const logFile = getLogFilePath('main');
  if (!fs.existsSync(logFile)) return [];
  const content = fs.readFileSync(logFile, 'utf-8');
  const allLines = content.trim().split('\n');
  return allLines.slice(-lines);
}

export function registerLoggingIPC() {
  ipcMain.handle('system:getAppLogs', async () => {
    return readLogs();
  });

  ipcMain.handle('system:getRuntimeLogs', async () => {
    ensureLogDir();
    const logFile = getLogFilePath('runtime');
    if (!fs.existsSync(logFile)) return [];
    const content = fs.readFileSync(logFile, 'utf-8');
    return content.trim().split('\n').slice(-100);
  });
}

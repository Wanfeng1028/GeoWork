// GeoWork Electron - Local Tray Manager
// Single global tray instance, accessible from main process

import { app, BrowserWindow, Tray, Menu } from 'electron';
import * as path from 'node:path';

let trayInstance: Tray | null = null;

export function initTray(mainWindow: BrowserWindow): Tray | null {
  if (trayInstance) return trayInstance;

  const isDev = process.env.NODE_ENV === 'development';
  const iconPath = path.resolve(
    __dirname,
    isDev
      ? '../../assets/tray-icon.png'
      : '../../dist/assets/tray-icon.png'
  );

  trayInstance = new Tray(iconPath);
  trayInstance.setToolTip('GeoWork');

  const contextMenu = Menu.buildFromTemplate([
    {
      label: '显示主窗口',
      click: () => {
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.show();
      },
    },
    { type: 'separator' },
    {
      label: '退出',
      click: () => {
        app.quit();
      },
    },
  ]);

  trayInstance.setContextMenu(contextMenu);

  trayInstance.on('click', () => {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
  });

  return trayInstance;
}

export function getTray(): Tray | null {
  return trayInstance;
}

export function destroyTray(): void {
  if (trayInstance) {
    trayInstance.destroy();
    trayInstance = null;
  }
}

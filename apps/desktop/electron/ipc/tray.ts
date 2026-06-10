// GeoWork Electron - Tray IPC

import { ipcMain, Tray, Menu, BrowserWindow, IpcMainInvokeEvent } from 'electron';

const ALLOWED_CHANNELS = new Set([
  'tray:create',
  'tray:update',
  'tray:destroy',
  'tray:getState',
]);

let trayInstance: Tray | null = null;

function registerTray(mainWindow: BrowserWindow) {
  // Create system tray icon
  ipcMain.handle('tray:create', async (_event: IpcMainInvokeEvent, options: { iconPath: string; menu: Array<{ label: string; click?: () => void }> }) => {
    try {
      if (trayInstance) {
        trayInstance.destroy();
      }
      trayInstance = new Tray(options.iconPath);
      const contextMenu = Menu.buildFromTemplate(options.menu);
      trayInstance.setToolTip('GeoWork');
      trayInstance.setContextMenu(contextMenu);
      trayInstance.on('click', () => {
        if (mainWindow.isMinimized()) {
          mainWindow.restore();
        }
        mainWindow.show();
      });
      return { success: true };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  // Update tray menu
  ipcMain.handle('tray:update', async (_event: IpcMainInvokeEvent, menu: Array<{ label: string; click?: () => void }>) => {
    if (!trayInstance) {
      return { success: false, error: 'Tray not created' };
    }
    const contextMenu = Menu.buildFromTemplate(menu);
    trayInstance.setContextMenu(contextMenu);
    return { success: true };
  });

  // Destroy tray
  ipcMain.handle('tray:destroy', async () => {
    if (trayInstance) {
      trayInstance.destroy();
      trayInstance = null;
    }
    return { success: true };
  });

  // Get tray state
  ipcMain.handle('tray:getState', async () => {
    return { exists: trayInstance !== null };
  });
}

export { ALLOWED_CHANNELS };
export default registerTray;

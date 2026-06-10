// GeoWork Electron - System IPC

import { ipcMain, nativeTheme, app, Tray, Menu, globalShortcut, IpcMainInvokeEvent, Notification, BrowserWindow } from 'electron';

export interface TrayOptions {
  iconPath: string;
  menu?: Array<{ label: string; click?: () => void }>;
  tooltip?: string;
}

const ALLOWED_CHANNELS = new Set([
  'system:showNotification',
  'system:getPlatformInfo',
  'system:getAppDataPath',
  'system:captureScreenshot',
  'system:createTray',
  'system:registerGlobalShortcut',
  'system:setApplicationMenu',
]);

function registerSystem(mainWindow: BrowserWindow) {
  // Show notification
  ipcMain.handle('system:showNotification', async (_event: IpcMainInvokeEvent, options: { title: string; body: string; icon?: string }) => {
    const notification = new Notification({
      title: options.title || 'GeoWork',
      body: options.body || '',
      icon: options.icon,
    });
    notification.show();
    return { success: true };
  });

  // Get platform info
  ipcMain.handle('system:getPlatformInfo', async () => {
    return {
      platform: process.platform,
      arch: process.arch,
      appVersion: app.getVersion(),
      appDataPath: app.getPath('appData'),
      userDataPath: app.getPath('userData'),
      logsPath: app.getPath('logs'),
    };
  });

  // Get app data path
  ipcMain.handle('system:getAppDataPath', async () => {
    return app.getPath('appData');
  });

  // Capture screenshot (placeholder)
  ipcMain.handle('system:captureScreenshot', async () => {
    return { success: false, error: 'Not implemented' };
  });

  // Create tray (placeholder)
  ipcMain.handle('system:createTray', async (_event: IpcMainInvokeEvent, trayOptions: TrayOptions) => {
    try {
      const tray = new Tray(trayOptions.iconPath);
      const contextMenu = Menu.buildFromTemplate(trayOptions.menu || []);
      tray.setToolTip(trayOptions.tooltip || 'GeoWork');
      tray.setContextMenu(contextMenu);
      return { success: true };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  // Register global shortcut
  ipcMain.handle('system:registerGlobalShortcut', async (_event: IpcMainInvokeEvent, shortcut: string, callback: () => void) => {
    return globalShortcut.register(shortcut, callback);
  });

  // Set application menu
  ipcMain.handle('system:setApplicationMenu', async (_event: IpcMainInvokeEvent, menuTemplate: Array<Record<string, unknown>>) => {
    const menu = Menu.buildFromTemplate(menuTemplate as Array<any>);
    Menu.setApplicationMenu(menu);
    return { success: true };
  });
}

export { ALLOWED_CHANNELS };
export default registerSystem;

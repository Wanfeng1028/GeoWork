// GeoWork Electron - Windows IPC

import { ipcMain, BrowserWindow, IpcMainInvokeEvent } from 'electron';

const ALLOWED_CHANNELS = new Set([
  'windows:getAll',
  'windows:focus',
  'windows:create',
  'windows:close',
  'windows:minimize',
  'windows:maximize',
  'windows:isMaximized',
]);

function registerWindows(mainWindow: BrowserWindow) {
  // Get all browser windows
  ipcMain.handle('windows:getAll', async () => {
    const windows = BrowserWindow.getAllWindows();
    return windows.map(w => ({
      id: w.id,
      title: w.getTitle(),
      isVisible: w.isVisible(),
      isFocused: w.isFocused(),
      isMaximized: w.isMaximized(),
      isMinimized: w.isMinimized(),
    }));
  });

  // Focus a specific window
  ipcMain.handle('windows:focus', async (_event: IpcMainInvokeEvent, windowId: number) => {
    const windows = BrowserWindow.getAllWindows();
    const target = windows.find(w => w.id === windowId);
    if (target) {
      target.focus();
      return { success: true };
    }
    return { success: false, error: 'Window not found' };
  });

  // Create a new window (placeholder)
  ipcMain.handle('windows:create', async (_event: IpcMainInvokeEvent, options: Record<string, unknown>) => {
    try {
      const win = new BrowserWindow({
        width: (options.width as number) || 1024,
        height: (options.height as number) || 768,
        title: (options.title as string) || 'GeoWork',
        webPreferences: {
          preload: options.preload as string | undefined,
          contextIsolation: true,
          nodeIntegration: false,
        },
      });
      if (options.url) {
        await win.loadURL(options.url as string);
      }
      return { success: true, windowId: win.id };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  // Close a specific window
  ipcMain.handle('windows:close', async (_event: IpcMainInvokeEvent, windowId: number) => {
    const windows = BrowserWindow.getAllWindows();
    const target = windows.find(w => w.id === windowId);
    if (target) {
      target.close();
      return { success: true };
    }
    return { success: false, error: 'Window not found' };
  });

  // Minimize the main window
  ipcMain.handle('windows:minimize', async () => {
    mainWindow.minimize();
    return { success: true };
  });

  // Maximize the main window
  ipcMain.handle('windows:maximize', async () => {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
    return { success: true };
  });

  // Check if main window is maximized
  ipcMain.handle('windows:isMaximized', async () => {
    return { isMaximized: mainWindow.isMaximized() };
  });
}

export { ALLOWED_CHANNELS };
export default registerWindows;

// GeoWork Electron - Shortcuts IPC

import { ipcMain, globalShortcut, BrowserWindow, IpcMainInvokeEvent } from 'electron';

const ALLOWED_CHANNELS = new Set([
  'shortcuts:register',
  'shortcuts:unregister',
  'shortcuts:unregisterAll',
  'shortcuts:isRegistered',
]);

function registerShortcuts(mainWindow: BrowserWindow) {
  // Register a global shortcut
  ipcMain.handle('shortcuts:register', async (_event: IpcMainInvokeEvent, shortcut: string, callbackId: string) => {
    try {
      const registered = globalShortcut.register(shortcut, () => {
        mainWindow.webContents.send('shortcut:fired', callbackId);
      });
      return { success: !!registered, registered };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  // Unregister a specific shortcut
  ipcMain.handle('shortcuts:unregister', async (_event: IpcMainInvokeEvent, shortcut: string) => {
    const result = globalShortcut.unregister(shortcut);
    return { success: result };
  });

  // Unregister all shortcuts
  ipcMain.handle('shortcuts:unregisterAll', async () => {
    globalShortcut.unregisterAll();
    return { success: true };
  });

  // Check if a shortcut is registered
  ipcMain.handle('shortcuts:isRegistered', async (_event: IpcMainInvokeEvent, shortcut: string) => {
    return { isRegistered: globalShortcut.isRegistered(shortcut) };
  });
}

export { ALLOWED_CHANNELS };
export default registerShortcuts;

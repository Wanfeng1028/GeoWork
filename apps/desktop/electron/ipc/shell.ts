// GeoWork Electron - Shell IPC

import { ipcMain, shell, IpcMainInvokeEvent, BrowserWindow } from 'electron';

const ALLOWED_CHANNELS = new Set([
  'shell:openExternal',
  'shell:showItemInFolder',
  'shell:moveItemToTrash',
  'shell:writeShortcut',
  'shell:readShortcut',
]);

function registerShell(mainWindow: BrowserWindow) {
  // Open external URL
  ipcMain.handle('shell:openExternal', async (_event: IpcMainInvokeEvent, url: string) => {
    try {
      await shell.openExternal(url);
      return { success: true };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  // Show item in folder
  ipcMain.handle('shell:showItemInFolder', async (_event: IpcMainInvokeEvent, filePath: string) => {
    try {
      shell.showItemInFolder(filePath);
      return { success: true };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  // Move item to trash
  ipcMain.handle('shell:moveItemToTrash', async (_event: IpcMainInvokeEvent, filePath: string) => {
    try {
      await shell.trashItem(filePath);
      return { success: true };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  // Write shortcut (placeholder)
  ipcMain.handle('shell:writeShortcut', async (_event: IpcMainInvokeEvent, shortcut: Record<string, unknown>) => {
    return { success: false, error: 'Not implemented' };
  });

  // Read shortcut (placeholder)
  ipcMain.handle('shell:readShortcut', async (_event: IpcMainInvokeEvent, shortcutPath: string) => {
    return { success: false, error: 'Not implemented' };
  });
}

export { ALLOWED_CHANNELS };
export default registerShell;

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
  ipcMain.handle(
    "shell:openExternal",
    async (_event: IpcMainInvokeEvent, url: string) => {
      try {
        await shell.openExternal(url);
        return { success: true };
      } catch (err: unknown) {
        return {
          success: false,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    }
  );

  // Show item in folder
  ipcMain.handle(
    "shell:showItemInFolder",
    async (_event: IpcMainInvokeEvent, filePath: string) => {
      try {
        shell.showItemInFolder(filePath);
        return { success: true };
      } catch (err: unknown) {
        return {
          success: false,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    }
  );

  // Move item to trash
  ipcMain.handle(
    "shell:moveItemToTrash",
    async (_event: IpcMainInvokeEvent, filePath: string) => {
      try {
        await shell.trashItem(filePath);
        return { success: true };
      } catch (err: unknown) {
        return {
          success: false,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    }
  );

  // Write shortcut
  ipcMain.handle(
    "shell:writeShortcut",
    async (_event: IpcMainInvokeEvent, shortcut: Record<string, unknown>) => {
      try {
        const { writeShortcutSync } = require("electron");
        const path = (shortcut.path as string) || "";
        if (path) {
          writeShortcutSync(path, shortcut as any);
          return { success: true };
        }
        return { success: false, error: "Shortcut path required" };
      } catch (err: unknown) {
        return {
          success: false,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    }
  );

  // Read shortcut
  ipcMain.handle(
    "shell:readShortcut",
    async (_event: IpcMainInvokeEvent, shortcutPath: string) => {
      try {
        const { readShortcutSync } = require("electron");
        const info = readShortcutSync(shortcutPath);
        return { success: true, data: info };
      } catch (err: unknown) {
        return {
          success: false,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    }
  );
}

export { ALLOWED_CHANNELS };
export default registerShell;

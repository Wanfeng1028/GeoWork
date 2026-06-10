// GeoWork Electron - File Dialogs IPC

import { ipcMain, dialog, shell, IpcMainInvokeEvent } from 'electron';

export interface FileDialogOptions {
  filters?: Array<{ name: string; extensions: string[] }>;
  properties?: string[];
}

export interface DialogResult {
  success: boolean;
  error?: string;
}

const ALLOWED_CHANNELS = new Set([
  'desktop:chooseFolder',
  'desktop:chooseFiles',
  'desktop:revealInFileExplorer',
  'desktop:openExternal',
  'desktop:openLocalApp',
]);

function registerFileDialogs(mainWindow: Electron.BrowserWindow) {
  // Choose a folder
  ipcMain.handle('desktop:chooseFolder', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory'],
    });
    return result.filePaths;
  });

  // Choose files
  ipcMain.handle('desktop:chooseFiles', async (_event: IpcMainInvokeEvent, options: FileDialogOptions = {}) => {
    const properties: ('multiSelections' | 'openFile' | 'openDirectory' | 'showHiddenFiles' | 'createDirectory' | 'promptToCreate' | 'noResolveAliases' | 'treatPackageAsDirectory' | 'dontAddToRecent')[] =
      ['multiSelections', ...(options.properties as string[]).filter(p => p !== 'multiSelections') as ('multiSelections' | 'openFile' | 'openDirectory' | 'showHiddenFiles' | 'createDirectory' | 'promptToCreate' | 'noResolveAliases' | 'treatPackageAsDirectory' | 'dontAddToRecent')[]]
    const result = await dialog.showOpenDialog(mainWindow, {
      properties,
      filters: options.filters || [],
    });
    return result.filePaths;
  });

  // Reveal file in explorer
  ipcMain.handle('desktop:revealInFileExplorer', async (_event: IpcMainInvokeEvent, filePath: string) => {
    try {
      shell.showItemInFolder(filePath);
      return { success: true };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  // Open external URL
  ipcMain.handle('desktop:openExternal', async (_event: IpcMainInvokeEvent, url: string) => {
    try {
      await shell.openExternal(url);
      return { success: true };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  // Open local app (placeholder)
  ipcMain.handle('desktop:openLocalApp', async (_event: IpcMainInvokeEvent, appName: string) => {
    return { success: false, error: 'Not implemented' };
  });
}

export { ALLOWED_CHANNELS };
export default registerFileDialogs;

// GeoWork Electron - Menu IPC

import { ipcMain, Menu, BrowserWindow, IpcMainInvokeEvent } from 'electron';

const ALLOWED_CHANNELS = new Set([
  'menu:setApplicationMenu',
  'menu:getApplicationMenu',
  'menu:popupContextMenu',
]);

function registerMenu(mainWindow: BrowserWindow) {
  // Set application menu
  ipcMain.handle('menu:setApplicationMenu', async (_event: IpcMainInvokeEvent, menuTemplate: Array<Record<string, unknown>>) => {
    try {
      const menu = Menu.buildFromTemplate(menuTemplate as Array<any>);
      Menu.setApplicationMenu(menu);
      return { success: true };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  // Get application menu
  ipcMain.handle('menu:getApplicationMenu', async () => {
    const menu = Menu.getApplicationMenu();
    return menu ? { exists: true } : { exists: false };
  });

  // Popup context menu
  ipcMain.handle('menu:popupContextMenu', async (_event: IpcMainInvokeEvent, template: Array<Record<string, unknown>>) => {
    try {
      const menu = Menu.buildFromTemplate(template as Array<any>);
      menu.popup();
      return { success: true };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  });
}

export { ALLOWED_CHANNELS };
export default registerMenu;

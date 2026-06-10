// GeoWork Electron - Clipboard IPC

import { ipcMain, clipboard, nativeImage, IpcMainInvokeEvent } from 'electron';

const ALLOWED_CHANNELS = new Set([
  'clipboard:readText',
  'clipboard:writeText',
  'clipboard:readImage',
  'clipboard:writeImage',
  'clipboard:has',
]);

function registerClipboard() {
  // Read text from clipboard
  ipcMain.handle('clipboard:readText', async () => {
    return clipboard.readText();
  });

  // Write text to clipboard
  ipcMain.handle('clipboard:writeText', async (_event: IpcMainInvokeEvent, text: string) => {
    clipboard.writeText(text);
    return { success: true };
  });

  // Read image from clipboard
  ipcMain.handle('clipboard:readImage', async () => {
    const img = clipboard.readImage();
    if (img.isEmpty()) return null;
    return img.toDataURL();
  });

  // Write image to clipboard
  ipcMain.handle('clipboard:writeImage', async (_event: IpcMainInvokeEvent, dataUrl: string) => {
    const img = nativeImage.createFromDataURL(dataUrl);
    clipboard.writeImage(img);
    return { success: true };
  });

  // Check clipboard has format
  ipcMain.handle('clipboard:has', async (_event: IpcMainInvokeEvent, format: string) => {
    return clipboard.has(format || 'text');
  });
}

export { ALLOWED_CHANNELS };
export default registerClipboard;

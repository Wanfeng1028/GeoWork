// GeoWork Electron - Screenshot IPC

import { ipcMain, desktopCapturer, IpcMainInvokeEvent, BrowserWindow } from 'electron';

const ALLOWED_CHANNELS = new Set([
  'screenshot:captureScreen',
  'screenshot:captureWindow',
  'screenshot:captureRegion',
]);

function registerScreenshot(mainWindow: BrowserWindow) {
  // Capture entire screen
  ipcMain.handle('screenshot:captureScreen', async () => {
    try {
      const sources = await desktopCapturer.getSources({
        types: ['screen'],
        thumbnailSize: { width: 1920, height: 1080 },
      });
      if (sources.length === 0) {
        return { success: false, error: 'No screen sources available' };
      }
      return {
        success: true,
        dataUrl: sources[0].thumbnail.toDataURL(),
      };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  // Capture a specific window
  ipcMain.handle('screenshot:captureWindow', async (_event: IpcMainInvokeEvent, windowId: number) => {
    try {
      const sources = await desktopCapturer.getSources({
        types: ['window', 'screen'],
        thumbnailSize: { width: 1920, height: 1080 },
      });
      const source = sources.find(s => s.id === String(windowId)) || sources[0];
      return {
        success: true,
        dataUrl: source.thumbnail.toDataURL(),
      };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  // Capture a region (placeholder - requires mouse position tracking)
  ipcMain.handle('screenshot:captureRegion', async (_event: IpcMainInvokeEvent, region: { x: number; y: number; width: number; height: number }) => {
    return {
      success: false,
      error: 'Region capture not implemented',
      region,
    };
  });
}

export { ALLOWED_CHANNELS };
export default registerScreenshot;

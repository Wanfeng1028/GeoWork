// GeoWork Electron - Screenshot IPC

import { ipcMain, desktopCapturer, IpcMainInvokeEvent, BrowserWindow } from 'electron';

const ALLOWED_CHANNELS = new Set([
  'screenshot:captureScreen',
  'screenshot:captureWindow',
  'screenshot:captureRegion',
]);

function registerScreenshot(mainWindow: BrowserWindow) {
  // Capture entire screen
  ipcMain.handle("screenshot:captureScreen", async () => {
    try {
      const sources = await desktopCapturer.getSources({
        types: ["screen"],
        thumbnailSize: { width: 1920, height: 1080 },
      });
      if (sources.length === 0) {
        return { success: false, error: "No screen sources available" };
      }
      return {
        success: true,
        dataUrl: sources[0].thumbnail.toDataURL(),
      };
    } catch (err: unknown) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  });

  // Capture a specific window
  ipcMain.handle(
    "screenshot:captureWindow",
    async (_event: IpcMainInvokeEvent, windowId: number) => {
      try {
        const sources = await desktopCapturer.getSources({
          types: ["window", "screen"],
          thumbnailSize: { width: 1920, height: 1080 },
        });
        const source =
          sources.find((s) => s.id === String(windowId)) || sources[0];
        return {
          success: true,
          dataUrl: source.thumbnail.toDataURL(),
        };
      } catch (err: unknown) {
        return {
          success: false,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    }
  );

  // Capture a region - track mouse positions to determine region
  ipcMain.handle(
    "screenshot:captureRegion",
    async (
      _event: IpcMainInvokeEvent,
      region: { x: number; y: number; width: number; height: number }
    ) => {
      try {
        const { desktopCapturer, screen } = require("electron");
        const allScreens = screen.getAllDisplays();
        let offsetX = 0;
        let offsetY = 0;

        for (const display of allScreens) {
          const screenRight = offsetX + display.size.width;
          const screenBottom = offsetY + display.size.height;

          if (
            region.x >= offsetX &&
            region.y >= offsetY &&
            region.x + region.width <= screenRight &&
            region.y + region.height <= screenBottom
          ) {
            const localX = region.x - offsetX;
            const localY = region.y - offsetY;

            const sources = await desktopCapturer.getSources({
              types: ["screen"],
              thumbnailSize: display.size,
            });

            if (sources.length > 0) {
              const image = sources[0].thumbnail;
              const cropped = image.resize({
                width: region.width,
                height: region.height,
              });
              // Crop to region using canvas-like approach
              const croppedBuffer = image
                .toBuffer()
                .slice(
                  localY * image.getWidth() * 4 + localX * 4,
                  (localY + region.height) * image.getWidth() * 4 + localX * 4
                );
              return {
                success: true,
                dataUrl: cropped.toDataURL(),
                region: {
                  x: localX,
                  y: localY,
                  width: region.width,
                  height: region.height,
                },
              };
            }
          }
          offsetY += display.size.height;
        }

        return { success: false, error: "Region not found on any display" };
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
export default registerScreenshot;

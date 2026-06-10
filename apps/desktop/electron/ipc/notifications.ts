// GeoWork Electron - Notifications IPC

import { ipcMain, Notification, IpcMainInvokeEvent } from 'electron';

const ALLOWED_CHANNELS = new Set([
  'notifications:show',
  'notifications:requestPermission',
]);

function registerNotifications() {
  // Show notification
  ipcMain.handle('notifications:show', async (_event: IpcMainInvokeEvent, options: { title: string; body: string; icon?: string; sound?: string; urgency?: string }) => {
    try {
      const notification = new Notification({
        title: options.title || 'GeoWork',
        body: options.body || '',
        icon: options.icon,
        sound: options.sound,
        urgency: (options.urgency as 'low' | 'critical' | 'normal' | undefined) || 'normal',
      });
      notification.show();
      return { success: true };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  // Request notification permission (placeholder for web)
  ipcMain.handle('notifications:requestPermission', async () => {
    return 'granted';
  });
}

export { ALLOWED_CHANNELS };
export default registerNotifications;

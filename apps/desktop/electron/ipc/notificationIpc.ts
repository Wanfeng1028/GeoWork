// GeoWork Electron - Notifications IPC

import { ipcMain, Notification, IpcMainInvokeEvent } from 'electron';

export const ALLOWED_CHANNELS = new Set<string>([
  'notifications:show',
  'notifications:requestPermission',
]);

export function registerNotificationIPC() {
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

  ipcMain.handle('notifications:requestPermission', async () => {
    return 'granted';
  });
}

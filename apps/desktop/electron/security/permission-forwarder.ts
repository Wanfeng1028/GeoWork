// GeoWork Electron - Security Permission Forwarder
// Forwards permission requests from the renderer to the main process for approval

import { ipcMain, BrowserWindow } from 'electron';

const ALLOWED_CHANNELS = new Set([
  'security:requestPermission',
  'security:getPermissionStatus',
  'security:listPermissions',
]);

// Permission categories and their default states
const PERMISSION_CATEGORIES: Readonly<Record<string, any>> = {
  'media': { audio: true, video: false },
  'geolocation': false,
  'notifications': 'default',
  'camera': false,
  'microphone': false,
  'backgroundSync': false,
  'backgroundFetch': false,
  'deviceInfo': false,
  'otherDevices': false,
  'storageAccess': false,
};

function registerPermissionForwarder(mainWindow: BrowserWindow) {
  // Request a permission (placeholder - in production, would show a dialog)
  ipcMain.handle('security:requestPermission', async (_event, category) => {
    const allowed = isPermissionAllowed(category);
    return { granted: allowed, category };
  });

  // Get current permission status
  ipcMain.handle('security:getPermissionStatus', async (_event, category) => {
    return { status: PERMISSION_CATEGORIES[category] ?? 'default', category };
  });

  // List all permission categories
  ipcMain.handle('security:listPermissions', async () => {
    return PERMISSION_CATEGORIES;
  });
}

function isPermissionAllowed(category: string): boolean {
  // Only allow permissions that are explicitly safe for desktop apps
  const safePermissions = new Set(['notifications']);
  return safePermissions.has(category);
}

export { ALLOWED_CHANNELS };
export default registerPermissionForwarder;

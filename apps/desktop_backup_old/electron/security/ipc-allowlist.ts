// GeoWork Electron - IPC Allowlist
// Security: Only explicitly listed channels can be used by renderer

import { ALLOWED_CHANNELS as FILE_DIALOGS } from '../ipc/file-dialogs';
import { ALLOWED_CHANNELS as SYSTEM } from '../ipc/system';
import { ALLOWED_CHANNELS as CLIPBOARD } from '../ipc/clipboard';
import { ALLOWED_CHANNELS as NOTIFICATIONS } from '../ipc/notifications';
import { ALLOWED_CHANNELS as SHELL } from '../ipc/shell';
import { ALLOWED_CHANNELS as TRAY } from '../ipc/tray';
import { ALLOWED_CHANNELS as MENU } from '../ipc/menu';
import { ALLOWED_CHANNELS as SHORTCUTS } from '../ipc/shortcuts';
import { ALLOWED_CHANNELS as SCREENSHOT } from '../ipc/screenshot';
import { ALLOWED_CHANNELS as WINDOWS } from '../ipc/windows';
import { ALLOWED_CHANNELS as PERMISSION } from '../security/permission-forwarder';

// Merge all allowed channels
const ALL_ALLOWED_CHANNELS = new Set<string>([
  ...FILE_DIALOGS,
  ...SYSTEM,
  ...CLIPBOARD,
  ...NOTIFICATIONS,
  ...SHELL,
  ...TRAY,
  ...MENU,
  ...SHORTCUTS,
  ...SCREENSHOT,
  ...WINDOWS,
  ...PERMISSION,
]);

/**
 * Check if a channel is allowed for renderer-to-main communication.
 */
export function isChannelAllowed(channel: string): boolean {
  return ALL_ALLOWED_CHANNELS.has(channel);
}

/**
 * Get the full list of allowed channels (for preload script).
 */
export function getAllAllowedChannels(): Set<string> {
  return new Set(ALL_ALLOWED_CHANNELS);
}

export { ALL_ALLOWED_CHANNELS };
export default { ALL_ALLOWED_CHANNELS, isChannelAllowed, getAllAllowedChannels };

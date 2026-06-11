// GeoWork Electron - Global Shortcuts Manager
// Registers and tracks global shortcuts, with cleanup on shutdown

import { globalShortcut } from 'electron';

type ShortcutCallback = () => void;

interface ShortcutEntry {
  shortcut: string;
  callback: ShortcutCallback;
}

const registeredShortcuts = new Map<string, ShortcutCallback>();

export function registerShortcut(shortcut: string, callback: ShortcutCallback): boolean {
  const registered = globalShortcut.register(shortcut, callback);
  if (registered) {
    registeredShortcuts.set(shortcut, callback);
  }
  return registered;
}

export function unregisterShortcut(shortcut: string): boolean {
  const result = globalShortcut.unregister(shortcut);
  if (result) {
    registeredShortcuts.delete(shortcut);
  }
  return result;
}

export function unregisterAllShortcuts(): void {
  globalShortcut.unregisterAll();
  registeredShortcuts.clear();
}

export function isShortcutRegistered(shortcut: string): boolean {
  return globalShortcut.isRegistered(shortcut);
}

export function getRegisteredShortcuts(): string[] {
  return Array.from(registeredShortcuts.keys());
}

// Graceful cleanup — call on app quit
export function cleanupShortcuts(): void {
  unregisterAllShortcuts();
}

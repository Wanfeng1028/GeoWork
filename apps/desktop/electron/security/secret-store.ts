// GeoWork Electron - Secret Store (safeStorage)
// P1-8: API keys must not live in localStorage (readable by any XSS or
// by inspecting the LevelDB files). Electron's safeStorage encrypts
// with the OS keychain (DPAPI on Windows, Keychain on macOS, libsecret
// on Linux). Secrets are persisted as base64 ciphertext in a JSON file
// under userData.

import { app, ipcMain, safeStorage } from 'electron'
import { join } from 'node:path'
import * as fs from 'node:fs'

const STORE_FILE = 'secrets.json'

interface SecretStore {
  [key: string]: string // base64-encoded ciphertext
}

function storePath(): string {
  return join(app.getPath('userData'), STORE_FILE)
}

function readStore(): SecretStore {
  try {
    const raw = fs.readFileSync(storePath(), 'utf-8')
    const parsed = JSON.parse(raw)
    if (typeof parsed === 'object' && parsed !== null) return parsed as SecretStore
    return {}
  } catch {
    return {}
  }
}

function writeStore(store: SecretStore): void {
  fs.writeFileSync(storePath(), JSON.stringify(store, null, 2), 'utf-8')
}

function encrypt(plaintext: string): string {
  return safeStorage.encryptString(plaintext).toString('base64')
}

function decrypt(ciphertext: string): string {
  return safeStorage.decryptString(Buffer.from(ciphertext, 'base64'))
}

export function setSecret(key: string, value: string): void {
  const store = readStore()
  store[key] = encrypt(value)
  writeStore(store)
}

export function getSecret(key: string): string | null {
  const store = readStore()
  const cipher = store[key]
  if (!cipher) return null
  try {
    return decrypt(cipher)
  } catch {
    return null
  }
}

export function deleteSecret(key: string): void {
  const store = readStore()
  if (key in store) {
    delete store[key]
    writeStore(store)
  }
}

/**
 * Register IPC handlers for renderer access to the secret store.
 * Channel names follow the existing allowlist pattern.
 */
export function registerSecretIPC(): void {
  ipcMain.handle('secrets:get', (_event, key: string) => {
    return getSecret(key)
  })

  ipcMain.handle('secrets:set', (_event, key: string, value: string) => {
    setSecret(key, value)
    return { success: true }
  })

  ipcMain.handle('secrets:delete', (_event, key: string) => {
    deleteSecret(key)
    return { success: true }
  })
}

export const SECRET_CHANNELS = new Set(['secrets:get', 'secrets:set', 'secrets:delete'])

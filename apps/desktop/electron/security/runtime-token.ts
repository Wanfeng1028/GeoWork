// GeoWork Electron - Runtime Token
// P0-4: the Electron parent process mints the runtime token and injects
// it into the Go runtime via GEOWORK_RUNTIME_TOKEN (contract v1, see
// core/internal/api/auth.go). The renderer fetches it over IPC and sends
// it as the X-GeoWork-Token header / ?token= query parameter.

import { randomBytes } from 'node:crypto'

export const TOKEN_HEADER = 'X-GeoWork-Token'
export const TOKEN_ENV_VAR = 'GEOWORK_RUNTIME_TOKEN'

let runtimeToken: string | null = null

/**
 * Mint a fresh random token. Called once at app startup, before the
 * runtime child process is spawned.
 */
export function mintRuntimeToken(): string {
  runtimeToken = randomBytes(32).toString('hex')
  return runtimeToken
}

/**
 * The current token, or null when auth is disabled
 * (GEOWORK_INSECURE_NO_AUTH=1 dev mode).
 */
export function getRuntimeToken(): string | null {
  if (process.env.GEOWORK_INSECURE_NO_AUTH === '1') return null
  return runtimeToken
}

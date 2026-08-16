// GeoWork Electron - External URL Guard
// P1-8: shell.openExternal must only hand safe protocols to the OS.
// Without a whitelist a compromised renderer (or injected content in the
// embedded browser) could open file://, javascript:, or custom-protocol
// URLs that execute local binaries.

const ALLOWED_PROTOCOLS = new Set(['https:', 'http:', 'mailto:'])

/**
 * Returns true when the URL uses a protocol that is safe to hand to
 * the OS shell. Rejects file:, javascript:, data:, and any custom
 * protocol handler.
 */
export function isExternalUrlAllowed(url: string): boolean {
  try {
    const parsed = new URL(url)
    return ALLOWED_PROTOCOLS.has(parsed.protocol)
  } catch {
    return false
  }
}

/**
 * Validates and returns the URL, or throws with a safe message.
 */
export function assertExternalUrl(url: string): string {
  if (!isExternalUrlAllowed(url)) {
    throw new Error(`Blocked openExternal for disallowed URL: ${url}`)
  }
  return url
}

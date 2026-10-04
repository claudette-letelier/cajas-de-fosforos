/**
 * Hardening helpers for a static GitHub Pages app.
 * Never trust scraped URLs blindly in href/src.
 */

const ALLOWED_PROTOCOLS = new Set(['http:', 'https:'])

/** Returns a safe http(s) URL or null. */
export function safeHttpUrl(raw) {
  if (!raw || typeof raw !== 'string') return null
  const trimmed = raw.trim()
  if (!trimmed || trimmed.startsWith('//')) return null
  try {
    const u = new URL(trimmed)
    if (!ALLOWED_PROTOCOLS.has(u.protocol)) return null
    // Block credentialed URLs and obvious script handlers
    if (u.username || u.password) return null
    if (/^(javascript|data|vbscript):/i.test(trimmed)) return null
    return u.href
  } catch {
    return null
  }
}

/** Safe image URL; prefers https when possible. */
export function safeImageUrl(raw) {
  const href = safeHttpUrl(raw)
  if (!href) return null
  // Reject SVG data tricks via http(s) only — already filtered
  return href
}

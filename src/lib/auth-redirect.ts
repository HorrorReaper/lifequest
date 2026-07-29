/**
 * Validates a `next` redirect target taken from a URL the user can craft.
 *
 * The auth callback concatenates this onto an origin, so only a same-origin
 * absolute path may pass. A protocol-relative value such as `//evil.com`, or
 * the `/\evil.com` variant that browsers normalize into one, would otherwise
 * turn the callback into an open redirect.
 *
 * Returns null when the value cannot be used.
 */
export function safeNextPath(value: string | null | undefined): string | null {
  if (!value) return null
  if (!value.startsWith('/')) return null
  if (value.startsWith('//') || value.startsWith('/\\')) return null

  return value
}

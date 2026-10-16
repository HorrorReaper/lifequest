// Cover images for challenges and their days: image links rendered with
// next/image, like the article covers on /learn.
//
// Any https host is accepted. Hosts listed in next.config.ts (and here, in
// OPTIMIZED_IMAGE_HOSTS) go through the Next.js image optimizer and are
// resized; every other host is rendered `unoptimized`, so the browser loads
// the file directly. That is deliberate: allowing every host in
// next.config.ts would turn /_next/image into an open image proxy anyone
// could use, at our cost. The challenge_*_image_url_check constraints in
// supabase/migrations/20261004120000_challenge_images.sql accept the same
// shape of URL.

/** Keep in step with images.remotePatterns in next.config.ts. */
export const OPTIMIZED_IMAGE_HOSTS = ['images.unsplash.com'] as const

export const MAX_IMAGE_URL_LENGTH = 500

function parse(value: string): URL | null {
  try {
    return new URL(value)
  } catch {
    return null
  }
}

/**
 * True for an https image link the app can show: a real host, a path, no
 * whitespace, no embedded credentials, and at most 500 characters.
 */
export function isAllowedChallengeImageUrl(value: string): boolean {
  if (value.length > MAX_IMAGE_URL_LENGTH || /\s/.test(value)) return false
  const url = parse(value)
  return Boolean(
    url &&
      url.protocol === 'https:' &&
      url.hostname.includes('.') &&
      !url.username &&
      !url.password &&
      url.pathname.length > 1
  )
}

/** Whether next/image may optimize this URL (its host is in next.config.ts). */
export function isOptimizedImageUrl(value: string): boolean {
  const url = parse(value)
  return Boolean(url && (OPTIMIZED_IMAGE_HOSTS as readonly string[]).includes(url.hostname))
}

/** The URL to render, or null when there is none or it cannot be rendered. */
export function challengeImageSrc(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed && isAllowedChallengeImageUrl(trimmed) ? trimmed : null
}

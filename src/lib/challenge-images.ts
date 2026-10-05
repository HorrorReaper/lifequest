// Cover images for challenges and their days. Like the article covers on
// /learn they are image URLs rendered with next/image, which only loads the
// hosts listed in next.config.ts. A URL from any other host would make
// next/image throw while the page renders, so only those hosts are accepted;
// the challenge_*_image_url_check constraints in
// supabase/migrations/20261004120000_challenge_images.sql enforce the same.

export const CHALLENGE_IMAGE_HOSTS = ['images.unsplash.com'] as const

export const MAX_IMAGE_URL_LENGTH = 500

/** True for an https URL on an allowed host, without whitespace. */
export function isAllowedChallengeImageUrl(value: string): boolean {
  if (value.length > MAX_IMAGE_URL_LENGTH || /\s/.test(value)) return false
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && (CHALLENGE_IMAGE_HOSTS as readonly string[]).includes(url.hostname) && url.pathname.length > 1
  } catch {
    return false
  }
}

/** The URL to render, or null when there is none or it cannot be rendered. */
export function challengeImageSrc(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed && isAllowedChallengeImageUrl(trimmed) ? trimmed : null
}

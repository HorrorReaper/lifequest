import { describe, expect, it } from 'vitest'
import { challengeImageSrc, isAllowedChallengeImageUrl } from '@/lib/challenge-images'

describe('challenge image URLs', () => {
  it('accepts https images from the hosts next/image may load', () => {
    expect(isAllowedChallengeImageUrl('https://images.unsplash.com/photo-123?w=800&q=80')).toBe(true)
  })

  it('rejects other hosts, plain http, whitespace and bare hosts', () => {
    expect(isAllowedChallengeImageUrl('https://evil.example/photo.png')).toBe(false)
    expect(isAllowedChallengeImageUrl('http://images.unsplash.com/photo-123')).toBe(false)
    expect(isAllowedChallengeImageUrl('https://images.unsplash.com/photo 123')).toBe(false)
    expect(isAllowedChallengeImageUrl('https://images.unsplash.com/')).toBe(false)
    expect(isAllowedChallengeImageUrl('https://images.unsplash.com.evil.example/photo-1')).toBe(false)
    expect(isAllowedChallengeImageUrl(`https://images.unsplash.com/${'x'.repeat(500)}`)).toBe(false)
    expect(isAllowedChallengeImageUrl('not a url')).toBe(false)
  })

  it('returns only renderable URLs', () => {
    expect(challengeImageSrc('  https://images.unsplash.com/photo-1  ')).toBe('https://images.unsplash.com/photo-1')
    expect(challengeImageSrc('https://evil.example/x.png')).toBeNull()
    expect(challengeImageSrc(null)).toBeNull()
    expect(challengeImageSrc('')).toBeNull()
  })
})

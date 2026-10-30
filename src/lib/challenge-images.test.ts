import { describe, expect, it } from 'vitest'
import { challengeImageSrc, isAllowedChallengeImageUrl, isOptimizedImageUrl } from '@/lib/challenge-images'

describe('challenge image URLs', () => {
  it('accepts direct https image links from any host', () => {
    expect(isAllowedChallengeImageUrl('https://images.unsplash.com/photo-123?w=800&q=80')).toBe(true)
    expect(isAllowedChallengeImageUrl('https://cdn.example.org/img/cover.png')).toBe(true)
    expect(isAllowedChallengeImageUrl('https://abc.supabase.co/storage/v1/object/public/c/x.jpg')).toBe(true)
  })

  it('rejects plain http, credentials, bare hosts, whitespace and over-long links', () => {
    expect(isAllowedChallengeImageUrl('http://cdn.example.org/a.png')).toBe(false)
    expect(isAllowedChallengeImageUrl('https://user:pw@cdn.example.org/a.png')).toBe(false)
    expect(isAllowedChallengeImageUrl('https://localhost/a.png')).toBe(false)
    expect(isAllowedChallengeImageUrl('https://cdn.example.org/')).toBe(false)
    expect(isAllowedChallengeImageUrl('https://cdn.example.org/a b.png')).toBe(false)
    expect(isAllowedChallengeImageUrl(`https://cdn.example.org/${'x'.repeat(500)}`)).toBe(false)
    expect(isAllowedChallengeImageUrl('javascript:alert(1)')).toBe(false)
    expect(isAllowedChallengeImageUrl('not a url')).toBe(false)
  })

  it('optimizes only the hosts next.config.ts allows', () => {
    expect(isOptimizedImageUrl('https://images.unsplash.com/photo-1')).toBe(true)
    expect(isOptimizedImageUrl('https://images.unsplash.com.evil.example/photo-1')).toBe(false)
    expect(isOptimizedImageUrl('https://cdn.example.org/a.png')).toBe(false)
  })

  it('returns only renderable URLs', () => {
    expect(challengeImageSrc('  https://images.unsplash.com/photo-1  ')).toBe('https://images.unsplash.com/photo-1')
    expect(challengeImageSrc('https://cdn.example.org/a.png')).toBe('https://cdn.example.org/a.png')
    expect(challengeImageSrc('http://cdn.example.org/a.png')).toBeNull()
    expect(challengeImageSrc(null)).toBeNull()
    expect(challengeImageSrc('')).toBeNull()
  })
})

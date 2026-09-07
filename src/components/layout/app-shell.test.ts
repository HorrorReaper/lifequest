import { describe, expect, it } from 'vitest'
import { isImmersiveRoute } from '@/components/layout/app-shell'

const ENTRY_ID = '3f1a9c2e-7b48-4d51-9a0c-2e8f6b1d4a37'
const TEMPLATE_ID = 'a91b7d40-52c6-4e8b-8f13-6c0a5d2e9b74'

describe('isImmersiveRoute', () => {
  it('hides the nav while an entry is being written', () => {
    expect(isImmersiveRoute(`/journal/${ENTRY_ID}`)).toBe(true)
    expect(isImmersiveRoute(`/journal/new/${TEMPLATE_ID}`)).toBe(true)
  })

  it('keeps the nav on every named journal page', () => {
    // The old rule was a deny-list -- everything under /journal was an entry
    // unless it was named in it -- so insights and metrics silently lost the
    // nav when they shipped. A page is now anything that is not an id.
    expect(isImmersiveRoute('/journal')).toBe(false)
    expect(isImmersiveRoute('/journal/entries')).toBe(false)
    expect(isImmersiveRoute('/journal/templates')).toBe(false)
    expect(isImmersiveRoute('/journal/insights')).toBe(false)
    expect(isImmersiveRoute('/journal/metrics')).toBe(false)
  })

  it('keeps the nav on a journal page nobody has written yet', () => {
    // The point of the change: a page added later must not need this file
    // edited to keep its navigation.
    expect(isImmersiveRoute('/journal/streaks')).toBe(false)
    expect(isImmersiveRoute('/journal/archive')).toBe(false)
  })

  it('keeps the nav on deeper template routes', () => {
    expect(isImmersiveRoute('/journal/templates/new')).toBe(false)
    expect(isImmersiveRoute(`/journal/templates/${TEMPLATE_ID}/edit`)).toBe(false)
  })

  it('still hides the nav where it did before', () => {
    expect(isImmersiveRoute('/admin')).toBe(true)
    expect(isImmersiveRoute('/admin/tools')).toBe(true)
    expect(isImmersiveRoute('/plan')).toBe(true)
    expect(isImmersiveRoute('/learn/some-path')).toBe(true)
    expect(isImmersiveRoute('/routines/abc/run')).toBe(true)
  })

  it('leaves the ordinary app routes alone', () => {
    expect(isImmersiveRoute('/dashboard')).toBe(false)
    expect(isImmersiveRoute('/habits')).toBe(false)
    expect(isImmersiveRoute('/tasks')).toBe(false)
    expect(isImmersiveRoute('/settings')).toBe(false)
    expect(isImmersiveRoute('/learn')).toBe(false)
  })
})

import { describe, expect, it } from 'vitest'
import { challengeJoinPath, readChallengeIntent } from '@/lib/challenge-intent'

describe('readChallengeIntent', () => {
  it('reads a valid slug', () => {
    expect(readChallengeIntent('unfuck-your-life')).toBe('unfuck-your-life')
    expect(readChallengeIntent(' Unfuck-Your-Life ')).toBe('unfuck-your-life')
  })

  it('ignores anything that is not a slug', () => {
    expect(readChallengeIntent(undefined)).toBeNull()
    expect(readChallengeIntent('')).toBeNull()
    expect(readChallengeIntent('../admin')).toBeNull()
    expect(readChallengeIntent('//evil.example')).toBeNull()
  })

  it('builds the join path', () => {
    expect(challengeJoinPath('unfuck-your-life')).toBe('/challenge/unfuck-your-life/join')
  })
})

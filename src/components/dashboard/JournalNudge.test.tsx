import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { JournalNudge } from '@/components/dashboard/JournalNudge'

afterEach(cleanup)

const journals = [
  { id: 'morning', name: 'Morning Reflection', icon: '🌅', completedToday: false },
  { id: 'evening', name: 'Evening Review', icon: '🌙', completedToday: false },
]

describe('JournalNudge', () => {
  it('links straight into the first unfinished template', () => {
    render(<JournalNudge journals={journals} completedJournalCount={0} />)

    const cta = screen.getByRole('link', { name: /start morning reflection/i })
    expect(cta.getAttribute('href')).toBe('/journal/new/morning')
  })

  it('skips a template already completed today', () => {
    render(
      <JournalNudge
        journals={[{ ...journals[0], completedToday: true }, journals[1]]}
        completedJournalCount={0}
      />
    )

    const cta = screen.getByRole('link', { name: /start evening review/i })
    expect(cta.getAttribute('href')).toBe('/journal/new/evening')
  })

  it('offers a further reflection once the day is already journaled', () => {
    render(<JournalNudge journals={journals} completedJournalCount={1} />)

    const cta = screen.getByRole('link', { name: /add reflection/i })
    expect(cta.getAttribute('href')).toBe('/journal')
  })

  it('still routes to the journal when the user has no templates at all', () => {
    render(<JournalNudge journals={[]} completedJournalCount={0} />)

    const cta = screen.getByRole('link', { name: /open journal/i })
    expect(cta.getAttribute('href')).toBe('/journal')
  })
})

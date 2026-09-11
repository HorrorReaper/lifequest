import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { ReflectionSection } from '@/components/dashboard/ReflectionSection'
import {
  DAILY_REFLECTION_TEMPLATE_ID,
  type ReflectionPrompt,
} from '@/lib/daily-reflection'

const prompt: ReflectionPrompt = {
  id: 'energy-giver',
  theme: 'Energy',
  text: 'What gave you energy today, and what quietly drained it?',
}

afterEach(cleanup)

describe('ReflectionSection', () => {
  it('shows the day’s question and its theme', () => {
    render(<ReflectionSection prompt={prompt} writtenToday={false} entryId={null} />)

    expect(screen.getByText(prompt.text)).toBeTruthy()
    expect(screen.getByText('Energy')).toBeTruthy()
  })

  it('opens a new entry against the reflection template, carrying the prompt', () => {
    render(<ReflectionSection prompt={prompt} writtenToday={false} entryId={null} />)

    const link = screen.getByRole('link', { name: /write about it/i })
    expect(link.getAttribute('href')).toBe(
      `/journal/new/${DAILY_REFLECTION_TEMPLATE_ID}?prompt=energy-giver`
    )
  })

  it('opens the existing entry once today has been answered', () => {
    render(<ReflectionSection prompt={prompt} writtenToday entryId="entry-1" />)

    // Starting a second entry for the same day would split one answer across
    // two records and pay the entry XP twice.
    const link = screen.getByRole('link', { name: /read what you wrote/i })
    expect(link.getAttribute('href')).toBe('/journal/entry-1')
    expect(screen.getByText(/answered today/i)).toBeTruthy()
  })
})

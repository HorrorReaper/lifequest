import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { DiaryEntryCard } from '@/components/diary/DiaryEntryCard'
import { DiaryMonthCard } from '@/components/diary/DiaryMonthCard'
import { diaryMonth } from '@/lib/diary'

afterEach(cleanup)

describe('DiaryEntryCard', () => {
  it('shows the day, the title, plain text and the first image', () => {
    const { container } = render(
      <DiaryEntryCard
        entry={{
          id: 'e1',
          entryDate: '2026-11-19',
          title: 'First frost on the lake',
          body: 'Woke up **early**.\n\n![lake](https://img.example/lake.jpg)',
          updatedAt: '',
        }}
      />
    )
    const link = screen.getByRole('link')
    expect(link.getAttribute('href')).toBe('/journal/diary/e1')
    expect(link.textContent).toContain('Thu')
    expect(link.textContent).toContain('19')
    expect(screen.getByText('First frost on the lake')).toBeTruthy()
    expect(screen.getByText('Woke up early.')).toBeTruthy()
    expect(container.querySelector('img')?.getAttribute('src')).toBe('https://img.example/lake.jpg')
  })

  it('calls an entry without a title Untitled', () => {
    render(<DiaryEntryCard entry={{ id: 'e2', entryDate: '2026-11-16', title: null, body: 'Tired.', updatedAt: '' }} />)
    expect(screen.getByText('Untitled')).toBeTruthy()
  })
})

describe('DiaryMonthCard', () => {
  it('counts written days and links each to its entry', () => {
    const month = diaryMonth(
      [
        { id: 'a', entryDate: '2026-11-02' },
        { id: 'b', entryDate: '2026-11-19' },
      ],
      '2026-11',
      '2026-11-19'
    )
    render(<DiaryMonthCard month={month} currentMonthKey="2026-11" />)
    expect(screen.getByRole('heading', { name: 'November 2026' })).toBeTruthy()
    expect(screen.getByText(/of 19 days written/).textContent).toBe('2 of 19 days written')
    expect(screen.getByRole('link', { name: 'November 19, written, today' }).getAttribute('href')).toBe(
      '/journal/diary/b'
    )
    expect(screen.getByRole('link', { name: 'Previous month' }).getAttribute('href')).toBe('/journal/diary?month=2026-10')
    expect(screen.queryByRole('link', { name: 'Next month' })).toBeNull()
  })
})

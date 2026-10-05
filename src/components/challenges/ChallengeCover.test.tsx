import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { NotebookPen } from 'lucide-react'
import { ChallengeCover, challengeDayIcon } from '@/components/challenges/ChallengeCover'

afterEach(() => cleanup())

describe('ChallengeCover', () => {
  it('shows the image when it comes from an allowed host', () => {
    render(<ChallengeCover src="https://images.unsplash.com/photo-1" alt="Sunrise" className="h-36" />)
    expect(screen.getByRole('img', { name: 'Sunrise' }).tagName).toBe('IMG')
  })

  it('draws a placeholder with a label when there is no image', () => {
    render(<ChallengeCover src={null} alt="" label="Day 3" />)
    expect(screen.getByText('Day 3')).toBeTruthy()
    expect(screen.queryByRole('img')).toBeNull()
  })

  it('never hands next/image a host it cannot load', () => {
    render(<ChallengeCover src="https://evil.example/x.png" alt="Cover" />)
    expect(screen.getByRole('img', { name: 'Cover' }).tagName).toBe('DIV')
  })

  it('picks a placeholder symbol by how the day completes', () => {
    expect(challengeDayIcon('reflection')).toBe(NotebookPen)
    expect(challengeDayIcon('unknown')).toBeTruthy()
  })
})

import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { QuestIdeaPicker } from './QuestIdeaPicker'

afterEach(cleanup)

describe('QuestIdeaPicker', () => {
  it('lists quest ideas grouped by category when open', () => {
    render(<QuestIdeaPicker open onOpenChange={() => undefined} onAdd={async () => undefined} />)

    expect(screen.getByText('Skills & Learning')).toBeTruthy()
    expect(screen.getByText('Build and publish a personal website')).toBeTruthy()
  })

  it('does not render quest ideas when closed', () => {
    render(<QuestIdeaPicker open={false} onOpenChange={() => undefined} onAdd={async () => undefined} />)

    expect(screen.queryByText('Build and publish a personal website')).toBeNull()
  })

  it('calls onAdd with the chosen idea and marks it as added', async () => {
    const user = userEvent.setup()
    const onAdd = vi.fn(async () => undefined)

    render(<QuestIdeaPicker open onOpenChange={() => undefined} onAdd={onAdd} />)

    const row = screen.getByText('Build and publish a personal website').closest('div[data-slot="quest-idea-row"]')
    expect(row).not.toBeNull()
    await user.click(screen.getByRole('button', { name: `Add "Build and publish a personal website"` }))

    expect(onAdd).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'build-personal-website', title: 'Build and publish a personal website' })
    )
    await waitFor(() => {
      const addedButton = screen.getByRole('button', { name: `Added "Build and publish a personal website"` })
      expect(addedButton.hasAttribute('disabled')).toBe(true)
    })
  })

  it('shows an inline error if adding a quest fails', async () => {
    const user = userEvent.setup()
    const onAdd = vi.fn(async () => {
      throw new Error('Could not create this quest.')
    })

    render(<QuestIdeaPicker open onOpenChange={() => undefined} onAdd={onAdd} />)

    await user.click(screen.getByRole('button', { name: `Add "Build and publish a personal website"` }))

    await waitFor(() => {
      expect(screen.getByText('Could not create this quest.')).toBeTruthy()
    })
  })
})

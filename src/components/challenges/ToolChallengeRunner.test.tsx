import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ToolProps } from '@/lib/tools/registry'

const rpc = vi.fn()

vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({ rpc }) }))
vi.mock('@/lib/tools/registry', () => ({
  getToolManifest: (id: string) =>
    id === 'vision'
      ? {
          id: 'vision',
          title: 'Vision',
          Component: ({ onUsed }: ToolProps) => (
            <button type="button" onClick={() => onUsed?.()}>
              Save vision
            </button>
          ),
        }
      : null,
}))

const { ToolChallengeRunner } = await import('@/components/challenges/ToolChallengeRunner')

const challenge = {
  templateId: 'tpl-1',
  enrollmentId: 'enr-1',
  title: 'Unfuck Your Life',
  dayNumber: 1,
  totalDays: 14,
}

function syncRow(completedNow: boolean) {
  return {
    data: [
      {
        enrollment_id: 'enr-1',
        day_number: completedNow ? 2 : 1,
        completion_type: 'tool_entries',
        progress: 1,
        target: 1,
        met: true,
        available_from: '2026-10-01',
        completed_now: completedNow,
        challenge_completed: false,
      },
    ],
    error: null,
  }
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('ToolChallengeRunner', () => {
  it('says which challenge step the tool belongs to', () => {
    render(<ToolChallengeRunner toolId="vision" userId="u" initialEntries={[]} challenge={challenge} />)

    expect(screen.getByText('Unfuck Your Life · Day 1 of 14')).toBeTruthy()
    expect(screen.getByText('Save here to complete today’s step.')).toBeTruthy()
    expect(screen.queryByRole('link', { name: /back to the challenge/i })).toBeNull()
  })

  it('completes the day on save and leads back', async () => {
    rpc.mockResolvedValue(syncRow(true))
    render(<ToolChallengeRunner toolId="vision" userId="u" initialEntries={[]} challenge={challenge} />)

    fireEvent.click(screen.getByRole('button', { name: 'Save vision' }))

    expect(await screen.findByText('Day 1 is done.')).toBeTruthy()
    expect(rpc).toHaveBeenCalledWith('sync_challenge_progress')
    expect(screen.getByRole('link', { name: /back to the challenge/i }).getAttribute('href')).toBe('/challenges/tpl-1')
  })

  it('still offers the way back when the save did not finish the day', async () => {
    rpc.mockResolvedValue(syncRow(false))
    render(<ToolChallengeRunner toolId="vision" userId="u" initialEntries={[]} challenge={challenge} />)

    fireEvent.click(screen.getByRole('button', { name: 'Save vision' }))

    expect(await screen.findByText('Saved.')).toBeTruthy()
    expect(screen.getByRole('link', { name: /back to the challenge/i })).toBeTruthy()
  })
})

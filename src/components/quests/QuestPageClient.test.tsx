import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { QuestPageClient } from './QuestPageClient'
import type { CustomQuest } from '@/lib/quests'

const createCustomQuest = vi.fn()

vi.mock('@/lib/quests', async () => {
  const actual = await vi.importActual<typeof import('@/lib/quests')>('@/lib/quests')
  return {
    ...actual,
    createCustomQuest: (...args: unknown[]) => createCustomQuest(...args),
  }
})

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    from: (table: string) => {
      throw new Error(`Unexpected table in test: ${table}`)
    },
    rpc: (name: string) => {
      throw new Error(`Unexpected rpc in test: ${name}`)
    },
  }),
}))

function fakeQuest(overrides: Partial<CustomQuest> = {}): CustomQuest {
  return {
    id: 'quest-1',
    user_id: 'user-1',
    title: 'New quest',
    description: null,
    xp_reward: 50,
    coin_reward: 20,
    quest_type: 'single',
    challenge_days: null,
    challenge_task: null,
    challenge_start_date: null,
    skill_category: null,
    is_completed: false,
    completed_at: null,
    created_at: '2026-08-01T00:00:00.000Z',
    updated_at: '2026-08-01T00:00:00.000Z',
    ...overrides,
  }
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

async function openQuestForm() {
  const user = userEvent.setup()
  render(
    <QuestPageClient
      userId="user-1"
      defaultQuests={[]}
      initialCustomQuests={[]}
      initialChallengePrograms={[]}
      today="2026-08-01"
    />
  )

  await user.click(screen.getByRole('button', { name: /my quests/i }))
  await user.click(screen.getByRole('button', { name: 'Create Quest' }))
  await user.type(screen.getByLabelText('Title'), 'Read 10 books')

  return user
}

describe('QuestPageClient skill picker', () => {
  it('includes the chosen skill category when creating a quest', async () => {
    createCustomQuest.mockResolvedValue(fakeQuest({ skill_category: 'physical_health' }))
    const user = await openQuestForm()

    await user.click(screen.getByRole('radio', { name: /physical health/i }))
    await user.click(screen.getByRole('button', { name: 'Create Quest' }))

    expect(createCustomQuest).toHaveBeenCalledWith(
      expect.anything(),
      'user-1',
      expect.objectContaining({ skill_category: 'physical_health' })
    )
  })

  it('defaults to no skill category when nothing is selected', async () => {
    createCustomQuest.mockResolvedValue(fakeQuest())
    const user = await openQuestForm()

    await user.click(screen.getByRole('button', { name: 'Create Quest' }))

    expect(createCustomQuest).toHaveBeenCalledWith(
      expect.anything(),
      'user-1',
      expect.objectContaining({ skill_category: null })
    )
  })

  it('toggles a selected skill chip back off when tapped again', async () => {
    createCustomQuest.mockResolvedValue(fakeQuest())
    const user = await openQuestForm()

    const physicalHealthChip = screen.getByRole('radio', { name: /physical health/i })
    await user.click(physicalHealthChip)
    await user.click(physicalHealthChip)
    await user.click(screen.getByRole('button', { name: 'Create Quest' }))

    expect(createCustomQuest).toHaveBeenCalledWith(
      expect.anything(),
      'user-1',
      expect.objectContaining({ skill_category: null })
    )
  })
})

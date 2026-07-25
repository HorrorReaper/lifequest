import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'
import {
  awardTaskCompletionXp,
  createTask,
  deleteTask,
  toggleTask,
  updateTask,
  type ManagedTask,
} from './tasks'

const row: ManagedTask = {
  id: 'task-1',
  user_id: 'user-1',
  title: 'Ship the task manager',
  description: 'Cover the durable fields',
  is_completed: false,
  due_date: '2026-07-25',
  priority: 'high',
  created_at: '2026-07-25T08:00:00Z',
  updated_at: '2026-07-25T08:00:00Z',
}

function taskMutationClient() {
  const insert = vi.fn()
  const update = vi.fn()
  const remove = vi.fn()

  const builder = {
    insert(payload: unknown) {
      insert(payload)
      return builder
    },
    update(payload: unknown) {
      update(payload)
      return builder
    },
    delete() {
      remove()
      return builder
    },
    eq() {
      return builder
    },
    select() {
      return builder
    },
    async single() {
      return { data: row, error: null }
    },
  }

  return {
    client: {
      from: () => builder,
    } as unknown as SupabaseClient,
    insert,
    update,
    remove,
  }
}

describe('task mutations', () => {
  it('persists descriptions and only the supported create fields', async () => {
    const { client, insert } = taskMutationClient()
    await createTask(client, 'user-1', {
      title: '  Ship the task manager ',
      description: '  Cover the durable fields ',
      priority: 'high',
      due_date: '2026-07-25',
    })

    expect(insert).toHaveBeenCalledWith({
      user_id: 'user-1',
      title: 'Ship the task manager',
      description: 'Cover the durable fields',
      priority: 'high',
      due_date: '2026-07-25',
    })
  })

  it('completes and reopens using is_completed only', async () => {
    const { client, update } = taskMutationClient()
    await toggleTask(client, 'task-1', true)
    await toggleTask(client, 'task-1', false)

    expect(update).toHaveBeenNthCalledWith(1, { is_completed: true })
    expect(update).toHaveBeenNthCalledWith(2, { is_completed: false })
  })

  it('normalizes editable text and does not spread unsupported fields', async () => {
    const { client, update } = taskMutationClient()
    await updateTask(client, 'task-1', {
      title: '  Updated ',
      description: '  More context ',
      due_date: null,
      priority: 'medium',
    })

    expect(update).toHaveBeenCalledWith({
      title: 'Updated',
      description: 'More context',
      due_date: null,
      priority: 'medium',
    })
  })

  it('deletes the selected task without touching unrelated fields', async () => {
    const { client, remove } = taskMutationClient()
    await deleteTask(client, 'task-1')
    expect(remove).toHaveBeenCalledTimes(1)
  })
})

describe('task XP idempotency', () => {
  it('does not award XP when this task already has an event', async () => {
    const insert = vi.fn()
    const xpBuilder = {
      select: () => xpBuilder,
      eq: () => xpBuilder,
      limit: async () => ({ data: [{ id: 'event-1' }], error: null }),
      insert,
    }
    const client = {
      from: () => xpBuilder,
    } as unknown as SupabaseClient

    await expect(
      awardTaskCompletionXp(client, 'user-1', row)
    ).resolves.toEqual({
      awarded: false,
      previousTotal: 0,
      newTotal: 0,
    })
    expect(insert).not.toHaveBeenCalled()
  })

  it('records one event and updates the profile for a first completion', async () => {
    const eventInsert = vi.fn(async () => ({ error: null }))
    const profileUpdate = vi.fn()
    const profileUpdateBuilder = {
      eq: vi.fn(async () => ({ error: null })),
    }
    profileUpdate.mockReturnValue(profileUpdateBuilder)

    const xpBuilder = {
      select: () => xpBuilder,
      eq: () => xpBuilder,
      limit: async () => ({ data: [], error: null }),
      insert: eventInsert,
    }
    const profileBuilder = {
      select: () => profileBuilder,
      eq: () => profileBuilder,
      single: async () => ({ data: { total_xp: 20 }, error: null }),
      update: profileUpdate,
    }
    const client = {
      from: (table: string) =>
        table === 'xp_events' ? xpBuilder : profileBuilder,
    } as unknown as SupabaseClient

    await expect(
      awardTaskCompletionXp(client, 'user-1', row)
    ).resolves.toEqual({
      awarded: true,
      previousTotal: 20,
      newTotal: 25,
    })
    expect(eventInsert).toHaveBeenCalledTimes(1)
    expect(profileUpdate).toHaveBeenCalledWith({ total_xp: 25 })
  })
})

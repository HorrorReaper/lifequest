import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it } from 'vitest'
import { loadCalendarData } from './calendar-data'

function calendarClient(failedTable?: string) {
  const calls: Array<{ table: string; method: string; args: unknown[] }> = []
  const client = {
    from(table: string) {
      const builder = {
        select(...args: unknown[]) { calls.push({ table, method: 'select', args }); return builder },
        eq(...args: unknown[]) { calls.push({ table, method: 'eq', args }); return builder },
        gte(...args: unknown[]) { calls.push({ table, method: 'gte', args }); return builder },
        lte(...args: unknown[]) { calls.push({ table, method: 'lte', args }); return builder },
        order(...args: unknown[]) { calls.push({ table, method: 'order', args }); return builder },
        range(...args: unknown[]) {
          calls.push({ table, method: 'range', args })
          return Promise.resolve({
            data: table === 'day_plans' ? [{ plan_date: '2026-09-23', blocks: [{ id: 'block-1', title: 'Planning', start_time: '09:00', end_time: '10:00', category: 'deep_work' }] }]
              : [{ id: 'task-1', title: 'Submit report', due_date: '2026-09-23', is_completed: false, project_id: null }],
            error: table === failedTable ? { message: 'offline' } : null,
          })
        },
      }
      return builder
    },
  }
  return { client: client as unknown as SupabaseClient, calls }
}

describe('calendar data', () => {
  it('reads existing plans and task deadlines within the visible dates for the signed-in user', async () => {
    const { client, calls } = calendarClient()
    const data = await loadCalendarData(client, 'user-1', '2026-08-31', '2026-10-04')
    expect(data.plans[0].blocks[0].title).toBe('Planning')
    expect(data.tasks[0].title).toBe('Submit report')
    for (const table of ['day_plans', 'tasks']) {
      expect(calls).toContainEqual({ table, method: 'eq', args: ['user_id', 'user-1'] })
      expect(calls).toContainEqual({ table, method: 'gte', args: [table === 'tasks' ? 'due_date' : 'plan_date', '2026-08-31'] })
      expect(calls).toContainEqual({ table, method: 'lte', args: [table === 'tasks' ? 'due_date' : 'plan_date', '2026-10-04'] })
      expect(calls).toContainEqual({ table, method: 'range', args: [0, 499] })
    }
  })

  it.each(['tasks', 'day_plans'])('reports a failed %s read instead of showing an empty calendar', async (table) => {
    const { client } = calendarClient(table)
    await expect(loadCalendarData(client, 'user-1', '2026-09-01', '2026-09-30'))
      .rejects.toThrow(`Calendar ${table} could not be loaded`)
  })
})

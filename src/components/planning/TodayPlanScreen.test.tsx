import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TodayPlanScreen } from './TodayPlanScreen'

const mocks = vi.hoisted(() => ({ from: vi.fn(), profile: { timezone: 'UTC', onboarding_complete: true }, failedTable: '' }))
vi.mock('next/navigation', () => ({ redirect: (path: string) => { throw new Error(`redirect:${path}`) } }))
vi.mock('@/lib/admin', () => ({ showAdminUi: async () => true }))
vi.mock('@/components/planning/TodayPlanner', () => ({ TodayPlanner: () => null }))
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({
  auth: { getUser: async () => ({ data: { user: { id: 'user-1' } } }) }, from: mocks.from,
}) }))

const savedBlock = { id: 'block-1', title: 'Existing task', start_time: '09:00', end_time: '10:00', category: 'deep_work', source_type: 'task', source_id: 'task-1' }

beforeEach(() => {
  mocks.failedTable = ''
  mocks.from.mockImplementation((table: string) => {
    const data = table === 'profiles' ? mocks.profile
      : table === 'day_plans' ? { blocks: [savedBlock], notes: 'Keep these notes' }
        : table === 'tasks' ? [{ id: 'task-1', title: 'Existing task', priority: 'high', due_date: null, estimate_minutes: 60 }]
          : []
    const builder = {
      select: () => builder, eq: () => builder, order: () => builder,
      limit: () => builder, or: () => builder, maybeSingle: () => builder,
      then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data, error: table === mocks.failedTable ? { message: 'offline' } : null }).then(resolve),
    }
    return builder
  })
})

describe('shared Daily Planner screen', () => {
  it('loads the same tasks, plan, notes and task links in public and Work views', async () => {
    const publicScreen = await TodayPlanScreen({ requestedStep: 'timeline' })
    const workScreen = await TodayPlanScreen({ requestedStep: 'timeline', embedded: true, returnHref: '/admin/work' })
    expect(workScreen.props.initialBlocks).toEqual([savedBlock])
    expect(workScreen.props.initialNotes).toBe('Keep these notes')
    expect(workScreen.props.tasks).toEqual(publicScreen.props.tasks)
    expect(workScreen.props.initialBlocks).toEqual(publicScreen.props.initialBlocks)
    expect(workScreen.props.startAt).toBe('timeline')
    expect(workScreen.props.returnHref).toBe('/admin/work')
    expect(publicScreen.props.returnHref).toBe('/dashboard')
  })

  it.each(['day_plans', 'tasks', 'profiles'])('refuses to offer an empty replacement when %s fails to load', async (table) => {
    mocks.failedTable = table
    await expect(TodayPlanScreen({ embedded: true })).rejects.toThrow('could not be loaded')
  })
})

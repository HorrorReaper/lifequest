import { describe, expect, it } from 'vitest'
import type { ToolEntry } from '@/lib/tools/storage'
import {
  addAction,
  addSubGoal,
  createGoal,
  goalProgress,
  isGoalBreakdownPayload,
  removeAction,
  removeSubGoal,
  subGoalProgress,
  toGoalBreakdowns,
  toggleAction,
  updateAction,
  updateSubGoal,
  type GoalBreakdownPayload,
} from './goal-breakdown'

function goal(overrides: Partial<GoalBreakdownPayload> = {}): GoalBreakdownPayload {
  return {
    kind: 'goal-breakdown',
    title: 'Become financially independent',
    why: 'Stop trading time for money',
    subGoals: [
      {
        id: 'sub-1',
        title: 'Build a €2k/mo side income',
        targetDate: '2026-12-31',
        actions: [
          { id: 'act-1', title: 'Ship the paid tier', done: true },
          { id: 'act-2', title: 'Find 10 beta users', done: false },
        ],
      },
    ],
    ...overrides,
  }
}

describe('isGoalBreakdownPayload', () => {
  it('accepts a well-formed breakdown', () => {
    expect(isGoalBreakdownPayload(goal())).toBe(true)
  })

  it('accepts a goal that has not been broken down yet', () => {
    expect(isGoalBreakdownPayload(goal({ subGoals: [] }))).toBe(true)
  })

  it('rejects shapes another tool could have written to the same table', () => {
    // tool_entries is shared across every tool and has no per-tool SQL
    // constraint, so a mismatched payload is a realistic case rather than a
    // theoretical one.
    expect(isGoalBreakdownPayload({ statement: 'Building calmly' })).toBe(false)
    expect(isGoalBreakdownPayload({ kind: 'time-audit-day', date: '2026-08-24' })).toBe(false)
    expect(isGoalBreakdownPayload(null)).toBe(false)
    expect(isGoalBreakdownPayload(undefined)).toBe(false)
    expect(isGoalBreakdownPayload([])).toBe(false)
  })

  it('rejects a sub-goal that is missing its actions', () => {
    const broken = { id: 'sub-1', title: 'No actions key', targetDate: null }
    expect(isGoalBreakdownPayload(goal({ subGoals: [broken as never] }))).toBe(false)
  })

  it('rejects an action whose done flag is not a boolean', () => {
    const subGoals = [
      { id: 'sub-1', title: 'x', targetDate: null, actions: [{ id: 'a', title: 'b', done: 'yes' }] },
    ]
    expect(isGoalBreakdownPayload(goal({ subGoals: subGoals as never }))).toBe(false)
  })

  it('rejects a missing title, which would render as an unopenable blank card', () => {
    expect(isGoalBreakdownPayload(goal({ title: undefined as never }))).toBe(false)
  })
})

describe('toGoalBreakdowns', () => {
  function entry(payload: unknown, id: string): ToolEntry {
    return { id, toolId: 'goal-breakdown', runId: null, payload, createdAt: '', updatedAt: '' }
  }

  it('keeps valid goals and drops rows another tool wrote', () => {
    const result = toGoalBreakdowns([
      entry(goal({ title: 'First' }), 'a'),
      entry({ statement: 'Vision' }, 'b'),
      entry(goal({ title: 'Second' }), 'c'),
    ])
    expect(result.map((item) => item.id)).toEqual(['a', 'c'])
    expect(result[0].payload.title).toBe('First')
  })

  it('returns nothing for a user who has not written a goal yet', () => {
    expect(toGoalBreakdowns([])).toEqual([])
  })
})

describe('createGoal', () => {
  it('starts from the title and reason given', () => {
    const created = createGoal('Run a sub-3h marathon', 'Prove I can finish what I start')
    expect(created.title).toBe('Run a sub-3h marathon')
    expect(created.why).toBe('Prove I can finish what I start')
  })

  it('starts with no sub-goals, so the breakdown is the user’s own work', () => {
    expect(createGoal('Learn Japanese', '').subGoals).toEqual([])
  })

  it('produces a payload its own validator accepts', () => {
    expect(isGoalBreakdownPayload(createGoal('Learn Japanese', ''))).toBe(true)
  })
})

describe('subGoalProgress', () => {
  it('counts the actions that are done', () => {
    expect(subGoalProgress(goal().subGoals[0])).toMatchObject({ done: 1, total: 2 })
  })

  it('reports a share for the progress bar', () => {
    expect(subGoalProgress(goal().subGoals[0]).share).toBeCloseTo(0.5)
  })

  it('does not divide by zero on a sub-goal with no actions yet', () => {
    const empty = { id: 'sub-2', title: 'Nothing yet', targetDate: null, actions: [] }
    expect(subGoalProgress(empty)).toMatchObject({ done: 0, total: 0, share: 0 })
  })
})

describe('goalProgress', () => {
  it('counts every action across all sub-goals', () => {
    const withTwo = goal({
      subGoals: [
        ...goal().subGoals,
        {
          id: 'sub-2',
          title: 'Cut fixed costs',
          targetDate: null,
          actions: [{ id: 'act-3', title: 'Cancel subscriptions', done: true }],
        },
      ],
    })
    expect(goalProgress(withTwo)).toMatchObject({ done: 2, total: 3 })
  })

  it('reports a goal with no actions as unstarted rather than as zero percent', () => {
    // A goal written a minute ago must not read like a goal being failed.
    expect(goalProgress(goal({ subGoals: [] })).total).toBe(0)
  })
})

describe('addSubGoal', () => {
  it('appends a sub-goal with the given title', () => {
    const result = addSubGoal(goal(), 'Cut fixed costs by 20%')
    expect(result.subGoals).toHaveLength(2)
    expect(result.subGoals[1].title).toBe('Cut fixed costs by 20%')
  })

  it('starts a new sub-goal with no actions and no date', () => {
    const added = addSubGoal(goal(), 'Cut fixed costs').subGoals[1]
    expect(added.actions).toEqual([])
    expect(added.targetDate).toBeNull()
  })

  it('gives every sub-goal a distinct id', () => {
    const result = addSubGoal(addSubGoal(goal({ subGoals: [] }), 'One'), 'Two')
    expect(result.subGoals[0].id).not.toBe(result.subGoals[1].id)
  })

  it('does not mutate the goal passed in', () => {
    const before = goal()
    addSubGoal(before, 'Cut fixed costs')
    expect(before.subGoals).toHaveLength(1)
  })
})

describe('updateSubGoal', () => {
  it('renames a sub-goal without touching its actions', () => {
    const result = updateSubGoal(goal(), 'sub-1', { title: 'Renamed' })
    expect(result.subGoals[0].title).toBe('Renamed')
    expect(result.subGoals[0].actions).toHaveLength(2)
  })

  it('sets a target date', () => {
    expect(updateSubGoal(goal(), 'sub-1', { targetDate: '2027-01-01' }).subGoals[0].targetDate).toBe(
      '2027-01-01'
    )
  })

  it('clears a target date', () => {
    expect(updateSubGoal(goal(), 'sub-1', { targetDate: null }).subGoals[0].targetDate).toBeNull()
  })

  it('leaves the goal alone when the sub-goal is unknown', () => {
    const before = goal()
    expect(updateSubGoal(before, 'nope', { title: 'x' })).toEqual(before)
  })
})

describe('removeSubGoal', () => {
  it('drops the sub-goal and the actions underneath it', () => {
    const result = removeSubGoal(goal(), 'sub-1')
    expect(result.subGoals).toEqual([])
    expect(goalProgress(result).total).toBe(0)
  })

  it('leaves other sub-goals in place', () => {
    const two = addSubGoal(goal(), 'Second')
    expect(removeSubGoal(two, 'sub-1').subGoals).toHaveLength(1)
  })
})

describe('addAction', () => {
  it('appends an action to the right sub-goal', () => {
    const result = addAction(goal(), 'sub-1', 'Write the pricing page')
    expect(result.subGoals[0].actions).toHaveLength(3)
    expect(result.subGoals[0].actions[2].title).toBe('Write the pricing page')
  })

  it('starts an action as not done', () => {
    expect(addAction(goal(), 'sub-1', 'Write the pricing page').subGoals[0].actions[2].done).toBe(
      false
    )
  })

  it('gives every action a distinct id', () => {
    const result = addAction(addAction(goal(), 'sub-1', 'One'), 'sub-1', 'Two')
    const ids = result.subGoals[0].actions.map((action) => action.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('leaves the goal alone when the sub-goal is unknown', () => {
    const before = goal()
    expect(addAction(before, 'nope', 'Orphan')).toEqual(before)
  })
})

describe('toggleAction', () => {
  it('ticks an action that was open', () => {
    expect(toggleAction(goal(), 'sub-1', 'act-2').subGoals[0].actions[1].done).toBe(true)
  })

  it('unticks an action that was done', () => {
    expect(toggleAction(goal(), 'sub-1', 'act-1').subGoals[0].actions[0].done).toBe(false)
  })

  it('moves the goal progress', () => {
    expect(goalProgress(toggleAction(goal(), 'sub-1', 'act-2'))).toMatchObject({ done: 2, total: 2 })
  })

  it('leaves the other actions untouched', () => {
    const result = toggleAction(goal(), 'sub-1', 'act-2')
    expect(result.subGoals[0].actions[0].done).toBe(true)
  })
})

describe('updateAction', () => {
  it('renames an action while keeping whether it is done', () => {
    const result = updateAction(goal(), 'sub-1', 'act-1', { title: 'Renamed' })
    expect(result.subGoals[0].actions[0]).toMatchObject({ title: 'Renamed', done: true })
  })
})

describe('removeAction', () => {
  it('drops just that action', () => {
    const result = removeAction(goal(), 'sub-1', 'act-1')
    expect(result.subGoals[0].actions.map((action) => action.id)).toEqual(['act-2'])
  })

  it('leaves the goal alone when the action is unknown', () => {
    const before = goal()
    expect(removeAction(before, 'sub-1', 'nope')).toEqual(before)
  })
})

import type { ToolEntry } from '@/lib/tools/storage'

export interface Action {
  id: string
  title: string
  done: boolean
}

export interface SubGoal {
  id: string
  title: string
  targetDate: string | null
  actions: Action[]
}

export interface GoalBreakdownPayload {
  kind: 'goal-breakdown'
  title: string
  why: string
  subGoals: SubGoal[]
}

export interface Progress {
  done: number
  total: number
  share: number
}

function isAction(value: unknown): value is Action {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const action = value as Action
  return (
    typeof action.id === 'string' &&
    typeof action.title === 'string' &&
    typeof action.done === 'boolean'
  )
}

function isSubGoal(value: unknown): value is SubGoal {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const subGoal = value as SubGoal
  return (
    typeof subGoal.id === 'string' &&
    typeof subGoal.title === 'string' &&
    (subGoal.targetDate === null || typeof subGoal.targetDate === 'string') &&
    Array.isArray(subGoal.actions) &&
    subGoal.actions.every(isAction)
  )
}

export function isGoalBreakdownPayload(value: unknown): value is GoalBreakdownPayload {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const payload = value as GoalBreakdownPayload
  return (
    payload.kind === 'goal-breakdown' &&
    typeof payload.title === 'string' &&
    typeof payload.why === 'string' &&
    Array.isArray(payload.subGoals) &&
    payload.subGoals.every(isSubGoal)
  )
}

/**
 * tool_entries is deliberately schema-less so a new tool needs no migration,
 * which means each tool filters out rows written by a different tool itself.
 */
export function toGoalBreakdowns(entries: ToolEntry[]): ToolEntry<GoalBreakdownPayload>[] {
  return entries.filter(
    (entry): entry is ToolEntry<GoalBreakdownPayload> => isGoalBreakdownPayload(entry.payload)
  )
}

export function createGoal(title: string, why: string): GoalBreakdownPayload {
  return { kind: 'goal-breakdown', title: title.trim(), why: why.trim(), subGoals: [] }
}

function progressOf(actions: Action[]): Progress {
  const done = actions.filter((action) => action.done).length
  return { done, total: actions.length, share: actions.length ? done / actions.length : 0 }
}

export function subGoalProgress(subGoal: SubGoal): Progress {
  return progressOf(subGoal.actions)
}

/**
 * Counts every action across the goal. A goal with no actions reports a total
 * of zero rather than a share of zero, so a freshly written goal does not
 * read like a goal being failed.
 */
export function goalProgress(goal: GoalBreakdownPayload): Progress {
  return progressOf(goal.subGoals.flatMap((subGoal) => subGoal.actions))
}

let idCounter = 0

/** Unique within a payload; ids are only ever compared inside one goal. */
function nodeId(prefix: string) {
  idCounter += 1
  return `${prefix}-${Date.now().toString(36)}-${idCounter}`
}

/** Applies a change to one sub-goal, leaving the rest of the goal untouched. */
function mapSubGoal(
  goal: GoalBreakdownPayload,
  subGoalId: string,
  change: (subGoal: SubGoal) => SubGoal
): GoalBreakdownPayload {
  if (!goal.subGoals.some((subGoal) => subGoal.id === subGoalId)) return goal
  return {
    ...goal,
    subGoals: goal.subGoals.map((subGoal) =>
      subGoal.id === subGoalId ? change(subGoal) : subGoal
    ),
  }
}

export function addSubGoal(goal: GoalBreakdownPayload, title: string): GoalBreakdownPayload {
  return {
    ...goal,
    subGoals: [
      ...goal.subGoals,
      { id: nodeId('sub'), title: title.trim(), targetDate: null, actions: [] },
    ],
  }
}

export function updateSubGoal(
  goal: GoalBreakdownPayload,
  subGoalId: string,
  patch: Partial<SubGoal>
): GoalBreakdownPayload {
  return mapSubGoal(goal, subGoalId, (subGoal) => ({ ...subGoal, ...patch }))
}

/** Removing a sub-goal takes its actions with it; nothing is left orphaned. */
export function removeSubGoal(
  goal: GoalBreakdownPayload,
  subGoalId: string
): GoalBreakdownPayload {
  return { ...goal, subGoals: goal.subGoals.filter((subGoal) => subGoal.id !== subGoalId) }
}

export function addAction(
  goal: GoalBreakdownPayload,
  subGoalId: string,
  title: string
): GoalBreakdownPayload {
  return mapSubGoal(goal, subGoalId, (subGoal) => ({
    ...subGoal,
    actions: [...subGoal.actions, { id: nodeId('act'), title: title.trim(), done: false }],
  }))
}

function mapAction(
  goal: GoalBreakdownPayload,
  subGoalId: string,
  actionId: string,
  change: (action: Action) => Action
): GoalBreakdownPayload {
  return mapSubGoal(goal, subGoalId, (subGoal) =>
    subGoal.actions.some((action) => action.id === actionId)
      ? {
          ...subGoal,
          actions: subGoal.actions.map((action) =>
            action.id === actionId ? change(action) : action
          ),
        }
      : subGoal
  )
}

export function toggleAction(
  goal: GoalBreakdownPayload,
  subGoalId: string,
  actionId: string
): GoalBreakdownPayload {
  return mapAction(goal, subGoalId, actionId, (action) => ({ ...action, done: !action.done }))
}

export function updateAction(
  goal: GoalBreakdownPayload,
  subGoalId: string,
  actionId: string,
  patch: Partial<Action>
): GoalBreakdownPayload {
  return mapAction(goal, subGoalId, actionId, (action) => ({ ...action, ...patch }))
}

export function removeAction(
  goal: GoalBreakdownPayload,
  subGoalId: string,
  actionId: string
): GoalBreakdownPayload {
  return mapSubGoal(goal, subGoalId, (subGoal) => ({
    ...subGoal,
    actions: subGoal.actions.filter((action) => action.id !== actionId),
  }))
}

/** Stable identifier, also the tool_id written to tool_entries. Never rename. */
export const GOAL_BREAKDOWN_TOOL_ID = 'goal-breakdown'

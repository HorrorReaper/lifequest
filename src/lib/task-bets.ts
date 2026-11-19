import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Bets on tasks (docs/features/planning-tasks-habits.md#task-bets): stake
 * coins that a task is done by its due date, win twice the stake back.
 * Every coin movement happens in the database
 * (supabase/migrations/20261119120000_task_bets.sql); this only asks.
 */

export const MIN_BET_STAKE = 1
export const MAX_BET_STAKE = 20
export const DAILY_BET_LIMIT = 3

export type TaskBetStatus = 'open' | 'won' | 'lost'

export interface TaskBet {
  id: string
  task_id: string | null
  task_title: string
  stake: number
  due_date: string
  status: TaskBetStatus
  payout: number
}

export interface SettledTaskBet {
  id: string
  taskId: string | null
  taskTitle: string
  stake: number
  status: 'won' | 'lost'
  payout: number
  /** The coin balance after settling. */
  coins: number
}

/** What a won bet pays back: the stake twice. */
export function betPayout(stake: number): number {
  return stake * 2
}

/** Clamps a typed or dragged stake into what a bet may be. */
export function clampStake(value: number): number {
  if (!Number.isFinite(value)) return MIN_BET_STAKE
  return Math.min(MAX_BET_STAKE, Math.max(MIN_BET_STAKE, Math.round(value)))
}

/**
 * Whether a task can still be bet on: open, due today or later, and never
 * bet on before (one bet per task, whatever became of it).
 */
export function canBetOn(
  task: { is_completed: boolean; due_date: string | null },
  today: string,
  bet: TaskBet | null | undefined
): boolean {
  return !task.is_completed && Boolean(task.due_date) && task.due_date! >= today && !bet
}

export type PlaceBetFailure =
  | 'stake'
  | 'not_found'
  | 'completed'
  | 'due_date'
  | 'already_bet'
  | 'daily_limit'
  | 'coins'
  | 'failed'

export const PLACE_BET_MESSAGES: Record<PlaceBetFailure, string> = {
  stake: `A bet is ${MIN_BET_STAKE} to ${MAX_BET_STAKE} coins.`,
  not_found: 'This task is gone. Reload the page.',
  completed: 'This task is already done.',
  due_date: 'Only tasks due today or later can be bet on.',
  already_bet: 'This task already had its bet.',
  daily_limit: `That makes ${DAILY_BET_LIMIT} bets today. Try again tomorrow.`,
  coins: 'Not enough coins for this bet.',
  failed: 'The bet was not placed. Check your connection and try again.',
}

/** Reads the reason out of a database error ('bet:<reason>'). */
export function betFailureFrom(error: unknown): PlaceBetFailure {
  const message =
    typeof error === 'object' && error !== null && 'message' in error
      ? String((error as { message: unknown }).message)
      : ''
  const match = /bet:([a-z_]+)/.exec(message)
  const reason = match?.[1] as PlaceBetFailure | undefined
  return reason && reason in PLACE_BET_MESSAGES ? reason : 'failed'
}

/** Whether an error is the database refusing a due date change for an open bet. */
export function isDueDateLockedError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    String((error as { message: unknown }).message).includes('bet:due_date_locked')
  )
}

export async function placeTaskBet(
  supabase: SupabaseClient,
  taskId: string,
  stake: number
): Promise<{ ok: true; betId: string; coins: number } | { ok: false; reason: PlaceBetFailure }> {
  const { data, error } = await supabase.rpc('place_task_bet', {
    p_task_id: taskId,
    p_stake: stake,
  })
  if (error) return { ok: false, reason: betFailureFrom(error) }
  const row = (Array.isArray(data) ? data[0] : data) as { bet_id: string; coins: number } | undefined
  if (!row) return { ok: false, reason: 'failed' }
  return { ok: true, betId: row.bet_id, coins: row.coins }
}

/** The user's bets on tasks that still exist, keyed by task. */
export async function fetchTaskBets(supabase: SupabaseClient): Promise<Map<string, TaskBet>> {
  const { data, error } = await supabase
    .from('task_bets')
    .select('id, task_id, task_title, stake, due_date, status, payout')
    .not('task_id', 'is', null)
  if (error) throw error
  const bets = new Map<string, TaskBet>()
  for (const bet of (data ?? []) as TaskBet[]) {
    if (bet.task_id) bets.set(bet.task_id, bet)
  }
  return bets
}

/**
 * Loses bets whose day has passed and returns every settled bet not
 * reported yet, each once.
 */
export async function settleTaskBets(supabase: SupabaseClient): Promise<SettledTaskBet[]> {
  const { data, error } = await supabase.rpc('settle_task_bets')
  if (error) throw error
  return ((data ?? []) as Array<{
    id: string
    task_id: string | null
    task_title: string
    stake: number
    status: 'won' | 'lost'
    payout: number
    coins: number
  }>).map((row) => ({
    id: row.id,
    taskId: row.task_id,
    taskTitle: row.task_title,
    stake: row.stake,
    status: row.status,
    payout: row.payout,
    coins: row.coins,
  }))
}

/** One line per settled bet: "You won 40 coins on “Call the bank”." */
export function describeSettledBet(bet: SettledTaskBet): string {
  return bet.status === 'won'
    ? `You won ${bet.payout} coins on “${bet.taskTitle}”.`
    : `You lost ${bet.stake} ${bet.stake === 1 ? 'coin' : 'coins'} on “${bet.taskTitle}”.`
}

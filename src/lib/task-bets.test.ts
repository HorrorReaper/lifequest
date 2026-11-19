import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  betFailureFrom,
  betPayout,
  canBetOn,
  clampStake,
  describeSettledBet,
  isDueDateLockedError,
  placeTaskBet,
  settleTaskBets,
  type TaskBet,
} from '@/lib/task-bets'

const bet: TaskBet = {
  id: 'b1',
  task_id: 't1',
  task_title: 'Call the bank',
  stake: 10,
  due_date: '2026-11-20',
  status: 'open',
  payout: 0,
}

describe('task bet rules', () => {
  it('pays twice the stake and keeps stakes between 1 and 20', () => {
    expect(betPayout(20)).toBe(40)
    expect(clampStake(0)).toBe(1)
    expect(clampStake(25)).toBe(20)
    expect(clampStake(7.4)).toBe(7)
    expect(clampStake(Number.NaN)).toBe(1)
  })

  it('allows one bet on an open task due today or later', () => {
    const today = '2026-11-19'
    expect(canBetOn({ is_completed: false, due_date: '2026-11-19' }, today, null)).toBe(true)
    expect(canBetOn({ is_completed: false, due_date: '2026-11-18' }, today, null)).toBe(false)
    expect(canBetOn({ is_completed: false, due_date: null }, today, null)).toBe(false)
    expect(canBetOn({ is_completed: true, due_date: '2026-11-20' }, today, null)).toBe(false)
    expect(canBetOn({ is_completed: false, due_date: '2026-11-20' }, today, { ...bet, status: 'lost' })).toBe(false)
  })

  it('reads the reason out of a database error', () => {
    expect(betFailureFrom({ message: 'bet:coins' })).toBe('coins')
    expect(betFailureFrom({ message: 'bet:daily_limit' })).toBe('daily_limit')
    expect(betFailureFrom({ message: 'network down' })).toBe('failed')
    expect(betFailureFrom(null)).toBe('failed')
    expect(isDueDateLockedError({ message: 'bet:due_date_locked' })).toBe(true)
    expect(isDueDateLockedError({ message: 'other' })).toBe(false)
  })

  it('says how a bet went', () => {
    const base = { id: 'b', taskId: 't', taskTitle: 'Call the bank', coins: 50 }
    expect(describeSettledBet({ ...base, stake: 20, payout: 40, status: 'won' })).toBe(
      'You won 40 coins on “Call the bank”.'
    )
    expect(describeSettledBet({ ...base, stake: 1, payout: 0, status: 'lost' })).toBe(
      'You lost 1 coin on “Call the bank”.'
    )
  })
})

describe('placeTaskBet and settleTaskBets', () => {
  it('places through the RPC and returns the new balance', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [{ bet_id: 'b9', coins: 30 }], error: null })
    const result = await placeTaskBet({ rpc } as unknown as SupabaseClient, 't1', 20)
    expect(rpc).toHaveBeenCalledWith('place_task_bet', { p_task_id: 't1', p_stake: 20 })
    expect(result).toEqual({ ok: true, betId: 'b9', coins: 30 })
  })

  it('turns a refusal into its reason', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { message: 'bet:coins' } })
    expect(await placeTaskBet({ rpc } as unknown as SupabaseClient, 't1', 20)).toEqual({
      ok: false,
      reason: 'coins',
    })
  })

  it('maps settled rows', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [{ id: 'b1', task_id: 't1', task_title: 'X', stake: 5, status: 'won', payout: 10, coins: 42 }],
      error: null,
    })
    expect(await settleTaskBets({ rpc } as unknown as SupabaseClient)).toEqual([
      { id: 'b1', taskId: 't1', taskTitle: 'X', stake: 5, status: 'won', payout: 10, coins: 42 },
    ])
  })
})

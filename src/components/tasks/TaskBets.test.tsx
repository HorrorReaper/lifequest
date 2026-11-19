import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ManagedTask } from '@/lib/tasks'
import type { TaskBet } from '@/lib/task-bets'
import { TaskList } from './TaskList'

const mocks = vi.hoisted(() => ({
  fetchTasks: vi.fn(),
  toggleTask: vi.fn(),
  awardTaskCompletionXp: vi.fn(),
  refresh: vi.fn(),
  addXp: vi.fn(),
  setCoins: vi.fn(),
  coins: 25,
  fetchTaskBets: vi.fn(),
  placeTaskBet: vi.fn(),
  settleTaskBets: vi.fn(),
}))

vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({ client: true }) }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: mocks.refresh }) }))
vi.mock('@/lib/stores/user-store', () => {
  const state = () => ({ addXp: mocks.addXp, setCoins: mocks.setCoins, coins: mocks.coins })
  return {
    useUserStore: (selector?: (value: ReturnType<typeof state>) => unknown) =>
      selector ? selector(state()) : state(),
  }
})
vi.mock('@/lib/tasks', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/tasks')>()),
  fetchTasks: mocks.fetchTasks,
  toggleTask: mocks.toggleTask,
  awardTaskCompletionXp: mocks.awardTaskCompletionXp,
}))
vi.mock('@/lib/task-bets', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/task-bets')>()),
  fetchTaskBets: mocks.fetchTaskBets,
  placeTaskBet: mocks.placeTaskBet,
  settleTaskBets: mocks.settleTaskBets,
}))

const TODAY = '2026-11-19'
const task = (over: Partial<ManagedTask>): ManagedTask => ({
  id: 'task-1',
  user_id: 'user-1',
  title: 'Call the bank',
  description: null,
  is_completed: false,
  due_date: TODAY,
  priority: 'medium',
  created_at: '2026-11-19T08:00:00Z',
  updated_at: '2026-11-19T08:00:00Z',
  ...over,
})
const openBet: TaskBet = {
  id: 'bet-1',
  task_id: 'task-1',
  task_title: 'Call the bank',
  stake: 20,
  due_date: TODAY,
  status: 'open',
  payout: 0,
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.coins = 25
  mocks.fetchTasks.mockResolvedValue([
    task({}),
    task({ id: 'task-2', title: 'Overdue errand', due_date: '2026-11-18' }),
  ])
  mocks.fetchTaskBets.mockResolvedValue(new Map())
  mocks.settleTaskBets.mockResolvedValue([])
  mocks.awardTaskCompletionXp.mockResolvedValue({ awarded: false, previousTotal: 0, newTotal: 0 })
})

afterEach(cleanup)

const row = (title: string) => screen.getByText(title).closest('li') as HTMLElement

describe('Task bets in the task list', () => {
  it('offers a bet only on open tasks due today or later, and places it', async () => {
    const user = userEvent.setup()
    mocks.placeTaskBet.mockResolvedValue({ ok: true, betId: 'bet-1', coins: 5 })
    render(<TaskList userId="user-1" today={TODAY} />)

    await screen.findByText('Call the bank')
    expect(within(row('Overdue errand')).queryByRole('button', { name: /Bet coins/ })).toBeNull()
    await user.click(within(row('Call the bank')).getByRole('button', { name: 'Bet coins on Call the bank' }))

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('+20 coins')).toBeTruthy()
    await user.click(within(dialog).getByRole('button', { name: '20 coins' }))
    expect(within(dialog).getByText('+40 coins')).toBeTruthy()

    mocks.fetchTaskBets.mockResolvedValue(new Map([['task-1', openBet]]))
    await user.click(within(dialog).getByRole('button', { name: 'Bet 20 coins' }))

    await waitFor(() => expect(mocks.placeTaskBet).toHaveBeenCalledWith(expect.anything(), 'task-1', 20))
    expect(mocks.setCoins).toHaveBeenCalledWith(5)
    expect(await screen.findByText('Bet 20 · win 40')).toBeTruthy()
    // The due date is what the bet is on: no "Tomorrow", no second bet.
    expect(within(row('Call the bank')).queryByRole('button', { name: /Tomorrow/ })).toBeNull()
    expect(within(row('Call the bank')).queryByRole('button', { name: /Bet coins/ })).toBeNull()
  })

  it('will not stake more coins than the user has', async () => {
    const user = userEvent.setup()
    mocks.coins = 8
    render(<TaskList userId="user-1" today={TODAY} />)
    await user.click(await screen.findByRole('button', { name: 'Bet coins on Call the bank' }))

    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: '20 coins' }))
    expect(within(dialog).getByRole('alert').textContent).toBe('Not enough coins for this bet.')
    expect((within(dialog).getByRole('button', { name: 'Bet 20 coins' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('says why the server refused a bet', async () => {
    const user = userEvent.setup()
    mocks.placeTaskBet.mockResolvedValue({ ok: false, reason: 'daily_limit' })
    render(<TaskList userId="user-1" today={TODAY} />)
    await user.click(await screen.findByRole('button', { name: 'Bet coins on Call the bank' }))
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: /^Bet \d+ coins$/ }))

    expect((await screen.findByRole('alert')).textContent).toBe('That makes 3 bets today. Try again tomorrow.')
  })

  it('reports settled bets on load and updates the coins', async () => {
    mocks.settleTaskBets.mockResolvedValue([
      { id: 'b1', taskId: 'x', taskTitle: 'Old task', stake: 5, status: 'lost', payout: 0, coins: 12 },
    ])
    render(<TaskList userId="user-1" today={TODAY} />)

    expect(await screen.findByText('You lost 5 coins on “Old task”.')).toBeTruthy()
    expect(mocks.setCoins).toHaveBeenCalledWith(12)
  })

  it('settles the bet straight away when its task is completed', async () => {
    const user = userEvent.setup()
    mocks.fetchTaskBets.mockResolvedValue(new Map([['task-1', openBet]]))
    mocks.toggleTask.mockResolvedValue(task({ is_completed: true }))
    render(<TaskList userId="user-1" today={TODAY} />)
    await screen.findByText('Bet 20 · win 40')

    mocks.settleTaskBets.mockResolvedValue([
      { id: 'bet-1', taskId: 'task-1', taskTitle: 'Call the bank', stake: 20, status: 'won', payout: 40, coins: 45 },
    ])
    await user.click(screen.getByRole('checkbox', { name: 'Complete Call the bank' }))

    expect(await screen.findByText('You won 40 coins on “Call the bank”.')).toBeTruthy()
    expect(mocks.setCoins).toHaveBeenCalledWith(45)
  })

  it('locks the due date in the editor while a bet runs', async () => {
    const user = userEvent.setup()
    mocks.fetchTaskBets.mockResolvedValue(new Map([['task-1', openBet]]))
    render(<TaskList userId="user-1" today={TODAY} />)
    await screen.findByText('Bet 20 · win 40')
    await user.click(screen.getByRole('button', { name: 'Edit Call the bank' }))

    expect(await screen.findByText('The due date is locked while a bet runs on this task.')).toBeTruthy()
  })

  it('offers no bets in Work, where tasks earn no rewards', async () => {
    render(<TaskList userId="user-1" today={TODAY} projectId="project-1" awardCompletionXp={false} />)
    await screen.findByText('Call the bank')
    expect(screen.queryByRole('button', { name: /Bet coins/ })).toBeNull()
    expect(mocks.settleTaskBets).not.toHaveBeenCalled()
  })
})

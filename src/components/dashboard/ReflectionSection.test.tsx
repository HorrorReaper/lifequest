import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ReflectionSection } from '@/components/dashboard/ReflectionSection'
import { REFLECTION_PROMPTS, type ReflectionPrompt } from '@/lib/daily-reflection'

const saveReflectionEntry = vi.fn()
const refresh = vi.fn()
const addXp = vi.fn()
const updateStreak = vi.fn()
const randomReflectionPrompt = vi.fn()

vi.mock('@/lib/reflection-entry', () => ({
  saveReflectionEntry: (...args: unknown[]) => saveReflectionEntry(...args),
}))
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: { getUser: () => Promise.resolve({ data: { user: { id: 'user-1' } } }) },
  }),
}))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }))
vi.mock('@/lib/stores/user-store', () => ({
  useUserStore: () => ({ addXp, updateStreak }),
}))
vi.mock('@/lib/daily-reflection', async () => {
  const actual = await vi.importActual<typeof import('@/lib/daily-reflection')>(
    '@/lib/daily-reflection'
  )
  return { ...actual, randomReflectionPrompt: (...a: unknown[]) => randomReflectionPrompt(...a) }
})

const prompt: ReflectionPrompt = {
  id: 'energy-giver',
  theme: 'Energy',
  text: 'What gave you energy today, and what quietly drained it?',
}

// The restore-from-storage path resolves a stored id back to a real prompt
// via findReflectionPrompt, so this has to be an actual list entry — not a
// fabricated stand-in — or a reload would show different text than the
// click that chose it.
const otherPrompt = REFLECTION_PROMPTS.find((p) => p.id === 'avoiding') as ReflectionPrompt

// Node 22+'s experimental global `localStorage` shadows jsdom's real
// implementation in this project's Vitest setup (throws/undefined without
// --localstorage-file), so window.localStorage is unusable as-is here. A
// minimal in-memory stand-in keeps this test self-contained rather than
// changing shared Vitest config for one test file. See DailyPlanPrompt.test.tsx.
function installLocalStorageStub() {
  const store = new Map<string, string>()
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, value),
      removeItem: (key: string) => void store.delete(key),
      clear: () => store.clear(),
    },
  })
}

afterEach(() => {
  cleanup()
})

beforeEach(() => {
  saveReflectionEntry.mockReset().mockResolvedValue({
    entryId: 'entry-1',
    xpEarned: 10,
    totalXp: 210,
    streak: 3,
  })
  refresh.mockReset()
  addXp.mockReset()
  updateStreak.mockReset()
  randomReflectionPrompt.mockReset().mockReturnValue(otherPrompt)
  installLocalStorageStub()
})

describe('ReflectionSection', () => {
  it('shows the day’s question and its theme', () => {
    render(<ReflectionSection prompt={prompt} writtenToday={false} entryId={null} timezone="UTC" userId="user-1" />)

    expect(screen.getByText(prompt.text)).toBeTruthy()
    expect(screen.getByText('Energy')).toBeTruthy()
  })

  it('opens an inline composer instead of navigating away', () => {
    render(<ReflectionSection prompt={prompt} writtenToday={false} entryId={null} timezone="UTC" userId="user-1" />)

    expect(screen.queryByRole('textbox')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /write about it/i }))

    expect(screen.getByRole('textbox')).toBeTruthy()
    expect(screen.getByRole('button', { name: /^save$/i })).toBeTruthy()
  })

  it('keeps Save disabled until something is written', () => {
    render(<ReflectionSection prompt={prompt} writtenToday={false} entryId={null} timezone="UTC" userId="user-1" />)
    fireEvent.click(screen.getByRole('button', { name: /write about it/i }))

    const save = screen.getByRole('button', { name: /^save$/i }) as HTMLButtonElement
    expect(save.disabled).toBe(true)

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Grateful for coffee.' } })
    expect(save.disabled).toBe(false)

    fireEvent.change(screen.getByRole('textbox'), { target: { value: '   ' } })
    expect(save.disabled).toBe(true)
  })

  it('saves the written reflection as a new journal entry', async () => {
    render(<ReflectionSection prompt={prompt} writtenToday={false} entryId={null} timezone="UTC" userId="user-1" />)
    fireEvent.click(screen.getByRole('button', { name: /write about it/i }))
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Grateful for coffee.' } })
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() => expect(saveReflectionEntry).toHaveBeenCalledTimes(1))
    expect(saveReflectionEntry).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ userId: 'user-1', text: 'Grateful for coffee.' })
    )
  })

  it('collapses to answered-today in place once the save resolves, without a page navigation', async () => {
    render(<ReflectionSection prompt={prompt} writtenToday={false} entryId={null} timezone="UTC" userId="user-1" />)
    fireEvent.click(screen.getByRole('button', { name: /write about it/i }))
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Grateful for coffee.' } })
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() => expect(screen.getByText(/answered today/i)).toBeTruthy())
    expect(screen.queryByRole('textbox')).toBeNull()
    expect(screen.getByRole('link', { name: /read what you wrote/i }).getAttribute('href')).toBe(
      '/journal/entry-1'
    )
  })

  it('carries the earned XP and streak into the shared store so the nav updates immediately', async () => {
    render(<ReflectionSection prompt={prompt} writtenToday={false} entryId={null} timezone="UTC" userId="user-1" />)
    fireEvent.click(screen.getByRole('button', { name: /write about it/i }))
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Grateful for coffee.' } })
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() => expect(addXp).toHaveBeenCalledWith(10, expect.any(Number)))
    expect(updateStreak).toHaveBeenCalledWith(3)
    expect(refresh).toHaveBeenCalled()
  })

  it('shows what went wrong and keeps the draft if saving fails', async () => {
    saveReflectionEntry.mockRejectedValue(new Error('network down'))
    render(<ReflectionSection prompt={prompt} writtenToday={false} entryId={null} timezone="UTC" userId="user-1" />)
    fireEvent.click(screen.getByRole('button', { name: /write about it/i }))
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Grateful for coffee.' } })
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() => expect(screen.getByText(/something went wrong/i)).toBeTruthy())
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('Grateful for coffee.')
  })

  it('shows only the Write about it button before anything is expanded', () => {
    render(<ReflectionSection prompt={prompt} writtenToday={false} entryId={null} timezone="UTC" userId="user-1" />)

    expect(screen.getByRole('button', { name: /write about it/i })).toBeTruthy()
    expect(screen.queryAllByRole('link')).toHaveLength(0)
  })

  it('swaps in a different prompt when asked for a new question', () => {
    render(<ReflectionSection prompt={prompt} writtenToday={false} entryId={null} timezone="UTC" userId="user-1" />)

    fireEvent.click(screen.getByRole('button', { name: /new question/i }))

    expect(randomReflectionPrompt).toHaveBeenCalledWith('energy-giver')
    expect(screen.getByText(otherPrompt.text)).toBeTruthy()
    expect(screen.getByText('Honesty')).toBeTruthy()
    expect(screen.queryByText(prompt.text)).toBeNull()
  })

  it('keeps a new question available while the composer is open', () => {
    render(<ReflectionSection prompt={prompt} writtenToday={false} entryId={null} timezone="UTC" userId="user-1" />)
    fireEvent.click(screen.getByRole('button', { name: /write about it/i }))

    fireEvent.click(screen.getByRole('button', { name: /new question/i }))

    expect(screen.getByText(otherPrompt.text)).toBeTruthy()
    expect(screen.getByRole('textbox')).toBeTruthy()
  })

  it('has nothing to shuffle once the day is answered', () => {
    render(<ReflectionSection prompt={prompt} writtenToday entryId="entry-1" timezone="UTC" userId="user-1" />)

    expect(screen.queryByRole('button', { name: /new question/i })).toBeNull()
  })

  it('keeps a chosen question across a reload, instead of reverting to the day’s default', () => {
    const { unmount } = render(
      <ReflectionSection prompt={prompt} writtenToday={false} entryId={null} timezone="UTC" userId="user-1" />
    )
    fireEvent.click(screen.getByRole('button', { name: /new question/i }))
    expect(screen.getByText(otherPrompt.text)).toBeTruthy()
    unmount()

    // A reload re-mounts the section with the same server-computed default
    // prompt for the day — the point is that the stored pick wins over it.
    render(<ReflectionSection prompt={prompt} writtenToday={false} entryId={null} timezone="UTC" userId="user-1" />)

    expect(screen.getByText(otherPrompt.text)).toBeTruthy()
    expect(screen.queryByText(prompt.text)).toBeNull()
  })

  it('never mixes up two users’ chosen questions on one shared browser', () => {
    const { unmount } = render(
      <ReflectionSection prompt={prompt} writtenToday={false} entryId={null} timezone="UTC" userId="user-1" />
    )
    fireEvent.click(screen.getByRole('button', { name: /new question/i }))
    unmount()

    render(
      <ReflectionSection prompt={prompt} writtenToday={false} entryId={null} timezone="UTC" userId="user-2" />
    )

    expect(screen.getByText(prompt.text)).toBeTruthy()
  })

  it('opens the existing entry once today has been answered', () => {
    render(<ReflectionSection prompt={prompt} writtenToday entryId="entry-1" timezone="UTC" userId="user-1" />)

    // Starting a second entry for the same day would split one answer across
    // two records and pay the entry XP twice.
    const link = screen.getByRole('link', { name: /read what you wrote/i })
    expect(link.getAttribute('href')).toBe('/journal/entry-1')
    expect(screen.getByText(/answered today/i)).toBeTruthy()
    expect(screen.queryByRole('button', { name: /write about it/i })).toBeNull()
  })
})

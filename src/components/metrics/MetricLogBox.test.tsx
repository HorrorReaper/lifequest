import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MetricLogBox } from '@/components/metrics/MetricLogBox'

const logMetricValue = vi.fn()
const refresh = vi.fn()

vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({ client: true }) }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }))
vi.mock('@/lib/metrics', async () => {
  const actual = await vi.importActual<typeof import('@/lib/metrics')>('@/lib/metrics')
  return { ...actual, logMetricValue: (...a: unknown[]) => logMetricValue(...a) }
})

const metric = { id: 'metric-1', name: 'Weight', unit: 'kg' }
const today = '2026-11-01'

function renderBox(latest: { value: number; date: string } | null) {
  render(<MetricLogBox userId="user-1" metric={metric} latest={latest} today={today} />)
}

function valueInput() {
  return screen.getByRole('textbox', { name: 'Weight' }) as HTMLInputElement
}

function saveButton() {
  return screen.getByRole('button', { name: 'Save for today' }) as HTMLButtonElement
}

beforeEach(() => {
  logMetricValue.mockReset().mockResolvedValue(undefined)
  refresh.mockReset()
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('MetricLogBox', () => {
  it('asks to log today when nothing was logged today', () => {
    renderBox({ value: 81.6, date: '2026-10-30' })

    expect(screen.getByRole('heading', { name: 'Log today' })).toBeTruthy()
  })

  it('asks to update today when today already has a value', () => {
    renderBox({ value: 81.6, date: today })

    expect(screen.getByRole('heading', { name: 'Update today' })).toBeTruthy()
  })

  it('warns that saving replaces today\'s value when one exists', () => {
    renderBox({ value: 81.6, date: today })

    expect(screen.getByText('You already logged 81.6 kg today. Saving replaces it.')).toBeTruthy()
  })

  it('shows no replace warning when today has no value yet', () => {
    renderBox({ value: 81.6, date: '2026-10-30' })

    expect(screen.queryByText(/Saving replaces it/)).toBeNull()
  })

  it('starts from the latest value and steps by the size that fits it', () => {
    renderBox({ value: 81.6, date: '2026-10-30' })

    expect(valueInput().value).toBe('81.6')
    fireEvent.click(screen.getByRole('button', { name: 'Increase Weight' }))
    expect(valueInput().value).toBe('82.1')
  })

  it('saves a comma decimal for today and refreshes', async () => {
    renderBox({ value: 81.6, date: '2026-10-30' })

    fireEvent.change(valueInput(), { target: { value: '81,2' } })
    fireEvent.click(saveButton())

    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1))
    expect(logMetricValue).toHaveBeenCalledTimes(1)
    expect(logMetricValue).toHaveBeenCalledWith(expect.anything(), 'user-1', {
      metricId: 'metric-1',
      date: today,
      value: 81.2,
    })
  })

  it('does not write twice when Save is tapped again while pending', async () => {
    let finish: () => void = () => {}
    logMetricValue.mockReturnValue(new Promise<void>((resolve) => (finish = resolve)))
    renderBox({ value: 81.6, date: '2026-10-30' })

    const save = saveButton()
    fireEvent.click(save)
    fireEvent.click(save)

    expect(logMetricValue).toHaveBeenCalledTimes(1)
    finish()
    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1))
  })

  it('cannot save an empty value', () => {
    renderBox(null)

    expect(valueInput().value).toBe('')
    expect(saveButton().disabled).toBe(true)

    fireEvent.click(saveButton())
    expect(logMetricValue).not.toHaveBeenCalled()
  })

  it('shows an error when the write fails and lets the user try again', async () => {
    logMetricValue.mockRejectedValue(new Error('network'))
    renderBox({ value: 81.6, date: '2026-10-30' })

    fireEvent.click(saveButton())

    expect((await screen.findByRole('alert')).textContent).toMatch(/could not save/i)
    expect(refresh).not.toHaveBeenCalled()
    expect(saveButton().disabled).toBe(false)
  })
})

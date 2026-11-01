import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MetricLogDialog } from '@/components/metrics/MetricLogDialog'

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

function renderDialog(latest: { value: number; date: string } | null, onOpenChange = vi.fn()) {
  render(
    <MetricLogDialog
      open
      onOpenChange={onOpenChange}
      userId="user-1"
      metric={metric}
      latest={latest}
      today={today}
    />
  )
  return onOpenChange
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

describe('MetricLogDialog', () => {
  it('starts from the latest value', () => {
    renderDialog({ value: 81.6, date: '2026-10-30' })

    expect(valueInput().value).toBe('81.6')
  })

  it('starts empty when there is no value yet', () => {
    renderDialog(null)

    expect(valueInput().value).toBe('')
    expect(screen.getByText('Last: nothing yet')).toBeTruthy()
  })

  it('shows the last value and its date', () => {
    renderDialog({ value: 81.6, date: '2026-10-30' })

    expect(screen.getByText('Last: 81.6 kg · Oct 30')).toBeTruthy()
  })

  it('warns that saving replaces a value already logged today', () => {
    renderDialog({ value: 81.6, date: today })

    expect(screen.getByText('You already logged 81.6 kg today. Saving replaces it.')).toBeTruthy()
    expect(screen.queryByText(/^Last:/)).toBeNull()
  })

  it('steps by the size that fits the latest value', () => {
    renderDialog({ value: 81.6, date: '2026-10-30' })

    fireEvent.click(screen.getByRole('button', { name: 'Increase Weight' }))

    expect(valueInput().value).toBe('82.1')
  })

  it('saves a comma decimal for today and refreshes', async () => {
    const onOpenChange = renderDialog({ value: 81.6, date: '2026-10-30' })

    fireEvent.change(valueInput(), { target: { value: '81,2' } })
    fireEvent.click(saveButton())

    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1))
    expect(logMetricValue).toHaveBeenCalledTimes(1)
    expect(logMetricValue).toHaveBeenCalledWith(expect.anything(), 'user-1', {
      metricId: 'metric-1',
      date: today,
      value: 81.2,
    })
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('does not write twice when Save is tapped again while pending', async () => {
    let finish: () => void = () => {}
    logMetricValue.mockReturnValue(new Promise<void>((resolve) => (finish = resolve)))
    renderDialog({ value: 81.6, date: '2026-10-30' })

    const save = saveButton()
    fireEvent.click(save)
    fireEvent.click(save)

    expect(logMetricValue).toHaveBeenCalledTimes(1)
    finish()
    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1))
  })

  it('cannot save an empty value', () => {
    renderDialog(null)

    expect(saveButton().disabled).toBe(true)

    fireEvent.click(saveButton())
    expect(logMetricValue).not.toHaveBeenCalled()
  })

  it('shows an error and stays open when the write fails', async () => {
    logMetricValue.mockRejectedValue(new Error('network'))
    const onOpenChange = renderDialog({ value: 81.6, date: '2026-10-30' })

    fireEvent.click(saveButton())

    expect((await screen.findByRole('alert')).textContent).toMatch(/could not save/i)
    expect(onOpenChange).not.toHaveBeenCalled()
    expect(refresh).not.toHaveBeenCalled()
    expect(saveButton().disabled).toBe(false)
  })

  it('links to the metric page', () => {
    renderDialog({ value: 81.6, date: '2026-10-30' })

    const link = screen.getByRole('link', { name: 'Open Weight ›' })
    expect(link.getAttribute('href')).toBe('/journal/metrics/metric-1?from=home')
  })
})

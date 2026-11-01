import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MetricValueDialog } from '@/components/metrics/MetricValueDialog'
import type { MetricValue } from '@/lib/metrics'

const updateMetricValue = vi.fn()
const deleteMetricValue = vi.fn()
const refresh = vi.fn()

vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({ client: true }) }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }))
vi.mock('@/lib/metrics', async () => {
  const actual = await vi.importActual<typeof import('@/lib/metrics')>('@/lib/metrics')
  return {
    ...actual,
    updateMetricValue: (...a: unknown[]) => updateMetricValue(...a),
    deleteMetricValue: (...a: unknown[]) => deleteMetricValue(...a),
  }
})

const metric = { id: 'metric-1', name: 'Weight', unit: 'kg' }
const entered: MetricValue = {
  date: '2026-10-29',
  value: 81.8,
  sourceEntryId: null,
  sourceLabel: null,
}
const fromEntry: MetricValue = {
  date: '2026-10-29',
  value: 81.8,
  sourceEntryId: 'entry-1',
  sourceLabel: 'Morning check-in',
}

function renderDialog(value: MetricValue = entered, onOpenChange = vi.fn()) {
  render(<MetricValueDialog open onOpenChange={onOpenChange} metric={metric} value={value} />)
  return onOpenChange
}

function valueInput() {
  return screen.getByRole('textbox', { name: 'Weight' }) as HTMLInputElement
}

beforeEach(() => {
  updateMetricValue.mockReset().mockResolvedValue(undefined)
  deleteMetricValue.mockReset().mockResolvedValue(undefined)
  refresh.mockReset()
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('MetricValueDialog', () => {
  it('shows the formatted date as the title and prefills the value', () => {
    renderDialog()

    expect(screen.getByRole('heading', { name: 'Oct 29' })).toBeTruthy()
    expect(valueInput().value).toBe('81.8')
  })

  it('has no date input', () => {
    renderDialog()

    expect(document.body.querySelector('input[type="date"]')).toBeNull()
    expect(screen.getAllByRole('textbox')).toHaveLength(1)
  })

  it('saves a comma decimal for that day, then refreshes and closes', async () => {
    const onOpenChange = renderDialog()

    fireEvent.change(valueInput(), { target: { value: '82,0' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(updateMetricValue).toHaveBeenCalledTimes(1))
    expect(updateMetricValue).toHaveBeenCalledWith({ client: true }, 'metric-1', '2026-10-29', 82)
    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1))
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('disables Save for an empty value and writes nothing', () => {
    renderDialog()

    fireEvent.change(valueInput(), { target: { value: '' } })

    const save = screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement
    expect(save.disabled).toBe(true)
    fireEvent.click(save)
    expect(updateMetricValue).not.toHaveBeenCalled()
  })

  it('sends one write when Save is tapped twice', async () => {
    renderDialog()

    const save = screen.getByRole('button', { name: 'Save' })
    fireEvent.click(save)
    fireEvent.click(save)

    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1))
    expect(updateMetricValue).toHaveBeenCalledTimes(1)
  })

  it('shows an error and stays open when the save fails', async () => {
    updateMetricValue.mockRejectedValue(new Error('boom'))
    const onOpenChange = renderDialog()

    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect((await screen.findByRole('alert')).textContent).toBe(
      'Could not save this value. Please try again.'
    )
    expect(refresh).not.toHaveBeenCalled()
    expect(onOpenChange).not.toHaveBeenCalledWith(false)
  })

  it('keeps the source line after editing, and never sends the source entry', async () => {
    renderDialog(fromEntry)

    expect(screen.getByText('Morning check-in')).toBeTruthy()
    fireEvent.change(valueInput(), { target: { value: '82' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(updateMetricValue).toHaveBeenCalledTimes(1))
    expect(updateMetricValue.mock.calls[0]).toHaveLength(4)
    expect(screen.getByText('Morning check-in')).toBeTruthy()
  })

  it('says Entered as the source of a value typed in', () => {
    renderDialog(entered)

    expect(screen.getByText('Entered')).toBeTruthy()
  })

  it('asks before deleting and deletes only after confirming', async () => {
    const onOpenChange = renderDialog()

    fireEvent.click(screen.getByRole('button', { name: 'Delete value' }))

    expect(screen.getByText('Delete this value?')).toBeTruthy()
    expect(deleteMetricValue).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))

    await waitFor(() => expect(deleteMetricValue).toHaveBeenCalledTimes(1))
    expect(deleteMetricValue).toHaveBeenCalledWith({ client: true }, 'metric-1', '2026-10-29')
    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1))
    expect(onOpenChange).toHaveBeenCalledWith(false)
    expect(updateMetricValue).not.toHaveBeenCalled()
  })

  it('goes back to the value when the deletion is cancelled', () => {
    renderDialog()

    fireEvent.click(screen.getByRole('button', { name: 'Delete value' }))
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(deleteMetricValue).not.toHaveBeenCalled()
    expect(screen.queryByText('Delete this value?')).toBeNull()
    expect(valueInput().value).toBe('81.8')
  })

  it('shows an error and stays open when the delete fails', async () => {
    deleteMetricValue.mockRejectedValue(new Error('boom'))
    const onOpenChange = renderDialog()

    fireEvent.click(screen.getByRole('button', { name: 'Delete value' }))
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))

    expect((await screen.findByRole('alert')).textContent).toBe(
      'Could not delete this value. Please try again.'
    )
    expect(refresh).not.toHaveBeenCalled()
    expect(onOpenChange).not.toHaveBeenCalledWith(false)
  })

  it('says the journal entry stays when deleting a value that came from one', () => {
    renderDialog(fromEntry)

    fireEvent.click(screen.getByRole('button', { name: 'Delete value' }))

    expect(screen.getByText(/journal entry stays as it is/i)).toBeTruthy()
  })
})

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MetricTargetControl } from '@/components/journal/MetricTargetControl'

const upsertMetricTarget = vi.fn()
const deleteMetricTarget = vi.fn()
const refresh = vi.fn()

vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({ client: true }) }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }))
vi.mock('@/lib/metric-targets', async () => {
  const actual = await vi.importActual<typeof import('@/lib/metric-targets')>(
    '@/lib/metric-targets'
  )
  return {
    ...actual,
    upsertMetricTarget: (...a: unknown[]) => upsertMetricTarget(...a),
    deleteMetricTarget: (...a: unknown[]) => deleteMetricTarget(...a),
  }
})

const props = {
  userId: 'user-1',
  fieldId: 'field-steps',
  label: 'Steps',
  unit: 'steps',
}

beforeEach(() => {
  upsertMetricTarget.mockReset().mockResolvedValue(undefined)
  deleteMetricTarget.mockReset().mockResolvedValue(undefined)
  refresh.mockReset()
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('MetricTargetControl', () => {
  it('invites a target when there is none', () => {
    render(<MetricTargetControl {...props} initial={null} />)

    expect(screen.getByRole('button', { name: /set a target/i })).toBeTruthy()
  })

  it('states the target it already has', () => {
    render(
      <MetricTargetControl
        {...props}
        initial={{ fieldId: 'field-steps', targetValue: 8000, direction: 'at_least' }}
      />
    )

    expect(screen.getByText(/at least 8000 steps/i)).toBeTruthy()
  })

  it('states an at_most target as a limit', () => {
    render(
      <MetricTargetControl
        {...props}
        label="Coffee"
        unit="cups"
        initial={{ fieldId: 'field-steps', targetValue: 2, direction: 'at_most' }}
      />
    )

    expect(screen.getByText(/at most 2 cups/i)).toBeTruthy()
  })

  it('tells you a target shows up on the dashboard', async () => {
    render(<MetricTargetControl {...props} initial={null} />)
    fireEvent.click(screen.getByRole('button', { name: /set a target/i }))

    await waitFor(() => expect(screen.getByLabelText('Target')).toBeTruthy())
    expect(screen.getByText(/dashboard/i)).toBeTruthy()
  })

  it('saves what the dialog submits', async () => {
    render(<MetricTargetControl {...props} initial={null} />)
    fireEvent.click(screen.getByRole('button', { name: /set a target/i }))

    await waitFor(() => expect(screen.getByLabelText('Target')).toBeTruthy())
    fireEvent.change(screen.getByLabelText('Target'), { target: { value: '8000' } })
    fireEvent.change(screen.getByLabelText('Direction'), { target: { value: 'at_most' } })
    fireEvent.submit(screen.getByLabelText('Target').closest('form') as HTMLFormElement)

    await waitFor(() =>
      expect(upsertMetricTarget).toHaveBeenCalledWith(expect.anything(), 'user-1', {
        fieldId: 'field-steps',
        targetValue: 8000,
        direction: 'at_most',
      })
    )
  })

  it('changes a target it already has', async () => {
    render(
      <MetricTargetControl
        {...props}
        initial={{ fieldId: 'field-steps', targetValue: 8000, direction: 'at_least' }}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /at least 8000 steps/i }))

    await waitFor(() => expect(screen.getByLabelText('Target')).toBeTruthy())
    // The dialog opens on the current value, so editing starts from it.
    expect(screen.getByLabelText('Target')).toHaveProperty('value', '8000')

    fireEvent.change(screen.getByLabelText('Target'), { target: { value: '10000' } })
    fireEvent.submit(screen.getByLabelText('Target').closest('form') as HTMLFormElement)

    await waitFor(() =>
      expect(upsertMetricTarget).toHaveBeenCalledWith(expect.anything(), 'user-1', {
        fieldId: 'field-steps',
        targetValue: 10000,
        direction: 'at_least',
      })
    )
    // And the button reflects the new target without a reload.
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /at least 10000 steps/i })).toBeTruthy()
    )
  })

  it('removes the target it has', async () => {
    render(
      <MetricTargetControl
        {...props}
        initial={{ fieldId: 'field-steps', targetValue: 8000, direction: 'at_least' }}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /at least 8000 steps/i }))

    await waitFor(() => expect(screen.getByLabelText('Target')).toBeTruthy())
    fireEvent.click(screen.getByRole('button', { name: /remove target/i }))

    await waitFor(() =>
      expect(deleteMetricTarget).toHaveBeenCalledWith(
        expect.anything(),
        'user-1',
        'field-steps'
      )
    )
  })

  it('explains a failed save instead of closing', async () => {
    upsertMetricTarget.mockRejectedValue(new Error('offline'))
    render(<MetricTargetControl {...props} initial={null} />)
    fireEvent.click(screen.getByRole('button', { name: /set a target/i }))

    await waitFor(() => expect(screen.getByLabelText('Target')).toBeTruthy())
    fireEvent.change(screen.getByLabelText('Target'), { target: { value: '8000' } })
    fireEvent.submit(screen.getByLabelText('Target').closest('form') as HTMLFormElement)

    await waitFor(() => expect(screen.getByText(/could not save/i)).toBeTruthy())
    expect(screen.getByLabelText('Target')).toBeTruthy()
  })

  it('refuses a target that is not a number', async () => {
    render(<MetricTargetControl {...props} initial={null} />)
    fireEvent.click(screen.getByRole('button', { name: /set a target/i }))

    await waitFor(() => expect(screen.getByLabelText('Target')).toBeTruthy())
    fireEvent.change(screen.getByLabelText('Target'), { target: { value: '' } })
    fireEvent.submit(screen.getByLabelText('Target').closest('form') as HTMLFormElement)

    expect(upsertMetricTarget).not.toHaveBeenCalled()
  })
})

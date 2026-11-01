import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MetricCreateDialog } from '@/components/metrics/MetricCreateDialog'

const createMetric = vi.fn()
const push = vi.fn()

vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({ client: true }) }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }))
vi.mock('@/lib/metrics', async () => {
  const actual = await vi.importActual<typeof import('@/lib/metrics')>('@/lib/metrics')
  return { ...actual, createMetric: (...a: unknown[]) => createMetric(...a) }
})

function renderDialog(onOpenChange = vi.fn()) {
  render(<MetricCreateDialog open onOpenChange={onOpenChange} userId="user-1" />)
  return onOpenChange
}

function createButton() {
  return screen.getByRole('button', { name: 'Create' }) as HTMLButtonElement
}

beforeEach(() => {
  createMetric.mockReset().mockResolvedValue({ id: 'metric-9' })
  push.mockReset()
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('MetricCreateDialog', () => {
  it('cannot create without a name', () => {
    renderDialog()

    expect(createButton().disabled).toBe(true)

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: '   ' } })
    expect(createButton().disabled).toBe(true)

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Water' } })
    expect(createButton().disabled).toBe(false)
  })

  it('creates the metric and opens its page', async () => {
    renderDialog()

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Water' } })
    fireEvent.change(screen.getByLabelText(/Unit/), { target: { value: 'glasses' } })
    fireEvent.click(createButton())

    await waitFor(() => expect(push).toHaveBeenCalledWith('/journal/metrics/metric-9?created=1'))
    expect(createMetric).toHaveBeenCalledTimes(1)
    expect(createMetric).toHaveBeenCalledWith(expect.anything(), 'user-1', {
      name: 'Water',
      unit: 'glasses',
    })
  })

  it('does not create twice when submitted again while pending', async () => {
    let finish: (metric: { id: string }) => void = () => {}
    createMetric.mockReturnValue(new Promise((resolve) => (finish = resolve)))
    renderDialog()

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Water' } })
    fireEvent.click(createButton())
    fireEvent.submit(screen.getByLabelText('Name').closest('form') as HTMLFormElement)

    expect(createMetric).toHaveBeenCalledTimes(1)
    finish({ id: 'metric-9' })
    await waitFor(() => expect(push).toHaveBeenCalledTimes(1))
  })

  it('limits the unit to 12 characters', () => {
    renderDialog()

    expect(screen.getByLabelText(/Unit/).getAttribute('maxlength')).toBe('12')
  })

  it('shows an error and stays open when creating fails', async () => {
    createMetric.mockRejectedValue(new Error('network'))
    const onOpenChange = renderDialog()

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Water' } })
    fireEvent.click(createButton())

    expect((await screen.findByRole('alert')).textContent).toMatch(/could not create/i)
    expect(push).not.toHaveBeenCalled()
    expect(onOpenChange).not.toHaveBeenCalled()
  })
})

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MetricSettingsDialog } from '@/components/metrics/MetricSettingsDialog'
import type { Metric } from '@/lib/metrics'

const updateMetric = vi.fn()
const deleteMetric = vi.fn()
const refresh = vi.fn()
const push = vi.fn()

vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({ client: true }) }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh, push }) }))
vi.mock('@/lib/metrics', async () => {
  const actual = await vi.importActual<typeof import('@/lib/metrics')>('@/lib/metrics')
  return {
    ...actual,
    updateMetric: (...a: unknown[]) => updateMetric(...a),
    deleteMetric: (...a: unknown[]) => deleteMetric(...a),
  }
})

const metric: Metric = {
  id: 'metric-1',
  name: 'Weight',
  unit: 'kg',
  targetValue: null,
  targetDirection: null,
  templateId: null,
  templateName: null,
  templateArchived: false,
  sourceFieldId: null,
  createdAt: '2026-10-01T00:00:00Z',
}

const templates = [
  {
    id: 'tpl-1',
    name: 'Morning check-in',
    archived: false,
    numberFields: [{ id: 'fld-1-weight', label: 'Weight' }],
  },
  {
    id: 'tpl-2',
    name: 'Evening review',
    archived: false,
    numberFields: [
      { id: 'fld-2-sleep', label: 'Sleep' },
      { id: 'fld-2-weight', label: '  weight ' },
    ],
  },
  { id: 'tpl-3', name: 'Weekly plan', archived: false, numberFields: [{ id: 'f3', label: 'Mood' }] },
]

function renderDialog(
  overrides: Partial<Metric> = {},
  props: { focus?: 'target' | 'journal'; templates?: typeof templates } = {}
) {
  const onOpenChange = vi.fn()
  render(
    <MetricSettingsDialog
      open
      onOpenChange={onOpenChange}
      metric={{ ...metric, ...overrides }}
      templates={props.templates ?? templates}
      focus={props.focus}
    />
  )
  return onOpenChange
}

function targetSwitch() {
  return screen.getByRole('switch', { name: 'Target' })
}

function journalSwitch() {
  return screen.getByRole('switch', { name: 'Also ask in my journal' })
}

function templateSelect() {
  return screen.getByLabelText('Journal template') as HTMLSelectElement
}

beforeEach(() => {
  updateMetric.mockReset().mockResolvedValue(undefined)
  deleteMetric.mockReset().mockResolvedValue(undefined)
  refresh.mockReset()
  push.mockReset()
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('MetricSettingsDialog', () => {
  it('prefills the unit and starts with the target off', () => {
    renderDialog()

    expect((screen.getByLabelText('Unit') as HTMLInputElement).value).toBe('kg')
    expect(targetSwitch().getAttribute('aria-checked')).toBe('false')
    expect(screen.queryByText('At least')).toBeNull()
  })

  it('reveals the direction and value when the target is switched on', () => {
    renderDialog()

    fireEvent.click(targetSwitch())

    expect(screen.getByRole('radio', { name: 'At least' })).toBeTruthy()
    expect(screen.getByRole('radio', { name: 'At most' })).toBeTruthy()
    expect(screen.getByLabelText('Target value')).toBeTruthy()
  })

  it('saves an at-least target of 8000', async () => {
    const onOpenChange = renderDialog()

    fireEvent.click(targetSwitch())
    fireEvent.click(screen.getByRole('radio', { name: 'At least' }))
    fireEvent.change(screen.getByLabelText('Target value'), { target: { value: '8000' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(updateMetric).toHaveBeenCalledTimes(1))
    expect(updateMetric).toHaveBeenCalledWith({ client: true }, 'metric-1', {
      name: 'Weight',
      unit: 'kg',
      targetValue: 8000,
      targetDirection: 'at_least',
      templateId: null,
    })
    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1))
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('saves an at-most target with a comma decimal', async () => {
    renderDialog()

    fireEvent.click(targetSwitch())
    fireEvent.click(screen.getByRole('radio', { name: 'At most' }))
    fireEvent.change(screen.getByLabelText('Target value'), { target: { value: '79,5' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(updateMetric).toHaveBeenCalledTimes(1))
    expect(updateMetric).toHaveBeenCalledWith(
      { client: true },
      'metric-1',
      expect.objectContaining({ targetValue: 79.5, targetDirection: 'at_most' })
    )
  })

  it('keeps Save disabled while the target is on without a number', () => {
    renderDialog()

    fireEvent.click(targetSwitch())

    expect((screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('shows the saved target and sends both fields as null when it is switched off', async () => {
    renderDialog({ targetValue: 80, targetDirection: 'at_most' })

    expect(targetSwitch().getAttribute('aria-checked')).toBe('true')
    expect((screen.getByLabelText('Target value') as HTMLInputElement).value).toBe('80')
    expect(screen.getByRole('radio', { name: 'At most' }).getAttribute('aria-checked')).toBe(
      'true'
    )

    fireEvent.click(targetSwitch())
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(updateMetric).toHaveBeenCalledTimes(1))
    expect(updateMetric).toHaveBeenCalledWith(
      { client: true },
      'metric-1',
      expect.objectContaining({ targetValue: null, targetDirection: null })
    )
  })

  it('limits the unit to 12 characters', () => {
    renderDialog()

    expect(screen.getByLabelText('Unit').getAttribute('maxlength')).toBe('12')
  })

  it('sends an emptied unit as null', async () => {
    renderDialog()

    fireEvent.change(screen.getByLabelText('Unit'), { target: { value: '  ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(updateMetric).toHaveBeenCalledTimes(1))
    expect(updateMetric).toHaveBeenCalledWith(
      { client: true },
      'metric-1',
      expect.objectContaining({ unit: null })
    )
  })

  it('links a journal template with Also ask in my journal', async () => {
    renderDialog()

    expect(screen.queryByLabelText('Journal template')).toBeNull()
    fireEvent.click(journalSwitch())
    fireEvent.change(templateSelect(), { target: { value: 'tpl-2' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(updateMetric).toHaveBeenCalledTimes(1))
    expect(updateMetric).toHaveBeenCalledWith(
      { client: true },
      'metric-1',
      expect.objectContaining({ templateId: 'tpl-2' })
    )
  })

  it('needs a template before saving a journal link', () => {
    renderDialog()

    fireEvent.click(journalSwitch())

    expect((screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('unlinks the template when the journal switch is turned off', async () => {
    renderDialog({ templateId: 'tpl-1', templateName: 'Morning check-in', sourceFieldId: 'fld-1-weight' })

    expect(templateSelect().value).toBe('tpl-1')
    fireEvent.click(journalSwitch())
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(updateMetric).toHaveBeenCalledTimes(1))
    expect(updateMetric).toHaveBeenCalledWith(
      { client: true },
      'metric-1',
      expect.objectContaining({ templateId: null, sourceFieldId: null })
    )
  })

  it('re-points the source field at the same-named number field of a new template', async () => {
    renderDialog({ templateId: 'tpl-1', templateName: 'Morning check-in', sourceFieldId: 'fld-1-weight' })

    fireEvent.change(templateSelect(), { target: { value: 'tpl-2' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(updateMetric).toHaveBeenCalledTimes(1))
    expect(updateMetric).toHaveBeenCalledWith(
      { client: true },
      'metric-1',
      expect.objectContaining({ templateId: 'tpl-2', sourceFieldId: 'fld-2-weight' })
    )
  })

  it('clears the source field when the new template has no field of that name', async () => {
    renderDialog({ templateId: 'tpl-1', templateName: 'Morning check-in', sourceFieldId: 'fld-1-weight' })

    fireEvent.change(templateSelect(), { target: { value: 'tpl-3' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(updateMetric).toHaveBeenCalledTimes(1))
    expect(updateMetric).toHaveBeenCalledWith(
      { client: true },
      'metric-1',
      expect.objectContaining({ templateId: 'tpl-3', sourceFieldId: null })
    )
  })

  it('leaves the source field alone when the template is unchanged', async () => {
    renderDialog({ templateId: 'tpl-1', templateName: 'Morning check-in', sourceFieldId: 'fld-1-weight' })

    fireEvent.change(screen.getByLabelText('Unit'), { target: { value: 'lb' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(updateMetric).toHaveBeenCalledTimes(1))
    const patch = updateMetric.mock.calls[0][2]
    expect(patch).toMatchObject({ templateId: 'tpl-1', unit: 'lb' })
    expect(patch).not.toHaveProperty('sourceFieldId')
  })

  it('prefills the name and saves a renamed, trimmed one', async () => {
    renderDialog()

    expect((screen.getByLabelText('Name') as HTMLInputElement).value).toBe('Weight')
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: '  Body weight ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(updateMetric).toHaveBeenCalledTimes(1))
    expect(updateMetric).toHaveBeenCalledWith(
      { client: true },
      'metric-1',
      expect.objectContaining({ name: 'Body weight' })
    )
  })

  it('does not save an empty name', () => {
    renderDialog()

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: '   ' } })

    expect(screen.getByText('Give the metric a name.')).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.submit(screen.getByRole('button', { name: 'Save' }).closest('form')!)
    expect(updateMetric).not.toHaveBeenCalled()
  })

  it('limits the name to 60 characters', () => {
    renderDialog()

    expect(screen.getByLabelText('Name').getAttribute('maxlength')).toBe('60')
  })

  it('says so when there is no template to link', () => {
    renderDialog({}, { templates: [] })

    expect(journalSwitch().getAttribute('aria-disabled')).toBe('true')
    expect(
      screen.getByText('Create a journal template first to ask for this number there.')
    ).toBeTruthy()
  })

  it('shows an archived link and focuses the select on Change template', () => {
    renderDialog(
      { templateId: 'tpl-old', templateName: 'Morning check-in', templateArchived: true },
      {
        templates: [
          { id: 'tpl-old', name: 'Morning check-in', archived: true, numberFields: [] },
          ...templates,
        ],
      }
    )

    expect(screen.getByText('Asked in Morning check-in (archived)')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Change template' }))

    expect(document.activeElement).toBe(templateSelect())
  })

  it('does not show the archived line for an active template', () => {
    renderDialog({ templateId: 'tpl-1', templateName: 'Morning check-in' })

    expect(screen.queryByText(/\(archived\)/)).toBeNull()
    expect(screen.queryByRole('button', { name: 'Change template' })).toBeNull()
  })

  it('shows an error and stays open when saving fails', async () => {
    updateMetric.mockRejectedValue(new Error('nope'))
    const onOpenChange = renderDialog()

    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByRole('alert')).toBeTruthy()
    expect(onOpenChange).not.toHaveBeenCalledWith(false)
    expect(refresh).not.toHaveBeenCalled()
  })

  it('sends one write for a double tap on Save', async () => {
    renderDialog()
    const save = screen.getByRole('button', { name: 'Save' })

    fireEvent.click(save)
    fireEvent.click(save)

    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1))
    expect(updateMetric).toHaveBeenCalledTimes(1)
  })

  it('asks before deleting, then deletes and returns to the list', async () => {
    renderDialog()

    fireEvent.click(screen.getByRole('button', { name: 'Delete metric' }))
    expect(screen.getByText('Delete Weight and all its values?')).toBeTruthy()
    expect(deleteMetric).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))

    await waitFor(() => expect(deleteMetric).toHaveBeenCalledWith({ client: true }, 'metric-1'))
    await waitFor(() => expect(push).toHaveBeenCalledWith('/journal/metrics'))
  })

  it('goes back from the delete question without deleting', () => {
    renderDialog()

    fireEvent.click(screen.getByRole('button', { name: 'Delete metric' }))
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(deleteMetric).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Save' })).toBeTruthy()
  })

  it('keeps the dialog open with an error when deleting fails', async () => {
    deleteMetric.mockRejectedValue(new Error('nope'))
    renderDialog()

    fireEvent.click(screen.getByRole('button', { name: 'Delete metric' }))
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))

    expect(await screen.findByRole('alert')).toBeTruthy()
    expect(push).not.toHaveBeenCalled()
  })

  it('focuses the target switch when opened for the target', async () => {
    renderDialog({}, { focus: 'target' })

    await waitFor(() => expect(document.activeElement).toBe(targetSwitch()))
  })

  it('focuses the journal switch when opened for the journal', async () => {
    renderDialog({}, { focus: 'journal' })

    await waitFor(() => expect(document.activeElement).toBe(journalSwitch()))
  })
})

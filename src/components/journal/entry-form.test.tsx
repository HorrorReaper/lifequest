import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { EntryForm } from '@/components/journal/entry-form'
import type { Metric } from '@/lib/metrics'
import type { JournalTemplate, TemplateField } from '@/lib/types'
import { journalDraftKey, serializeJournalDraft } from '@/components/journal/journal-wizard'

// Only the metric writes of the submit are under test here; everything else
// the form saves goes through a fake client that accepts any call.
const logMetricValue = vi.fn()
const routerBack = vi.fn()
const insertedTables: string[] = []

vi.mock('@/lib/supabase/client', () => ({ createClient: () => fakeClient() }))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), back: routerBack, refresh: vi.fn() }),
}))
vi.mock('@/lib/metrics', async () => {
  const actual = await vi.importActual<typeof import('@/lib/metrics')>('@/lib/metrics')
  return { ...actual, logMetricValue: (...a: unknown[]) => logMetricValue(...a) }
})

const singleResults: Record<string, unknown> = {
  journal_entries: { id: 'entry-new' },
  profiles: {
    total_xp: 10,
    current_streak: 1,
    best_streak: 1,
    last_journal_date: '2026-11-01',
    streak_freezes: 0,
  },
}

function fakeClient() {
  return {
    auth: { getUser: async () => ({ data: { user: { id: 'user-1' } } }) },
    from(table: string) {
      const builder: Record<string, unknown> = {}
      for (const method of ['select', 'insert', 'update', 'delete', 'upsert', 'eq', 'in']) {
        builder[method] = () => {
          if (method === 'insert') insertedTables.push(table)
          return builder
        }
      }
      builder.single = async () => ({ data: singleResults[table] ?? null, error: null })
      builder.then = (resolve: (value: unknown) => unknown) =>
        Promise.resolve({ data: [], error: null }).then(resolve)
      return builder
    },
  }
}

const template = {
  id: 'tpl-1',
  user_id: 'user-1',
  name: 'Morning',
  description: null,
  entry_type: 'morning',
  icon: '☀️',
  is_default: false,
  is_system: false,
  xp_reward: 10,
  sort_order: 0,
  is_active: true,
  created_at: '2026-10-01T08:00:00Z',
  updated_at: '2026-10-01T08:00:00Z',
} as JournalTemplate

const numberField = {
  id: 'field-steps',
  template_id: 'tpl-1',
  field_type: 'number',
  label: 'Steps',
  description: null,
  placeholder: null,
  is_required: false,
  sort_order: 0,
  config: {},
  created_at: '2026-10-01T08:00:00Z',
} as TemplateField

function metric(overrides: Partial<Metric> = {}): Metric {
  return {
    id: 'metric-weight',
    name: 'Weight',
    unit: 'kg',
    targetValue: null,
    targetDirection: null,
    templateId: 'tpl-1',
    templateName: 'Morning',
    templateArchived: false,
    sourceFieldId: null,
    createdAt: '2026-10-01T08:00:00Z',
    ...overrides,
  }
}

const weight = { metric: metric(), value: null }
const stepsMetric = {
  metric: metric({ id: 'metric-steps', name: 'Daily steps', unit: null, sourceFieldId: 'field-steps' }),
  value: null,
}

function renderForm(props: Partial<React.ComponentProps<typeof EntryForm>> = {}) {
  return render(
    <EntryForm
      userId="user-1"
      template={template}
      fields={[numberField]}
      timezone="UTC"
      today="2026-11-01"
      {...props}
    />
  )
}

function weightInput() {
  return screen.getByRole('textbox', { name: 'Weight' }) as HTMLInputElement
}

/** The template's own number field: the only textbox that is not a metrics input. */
function stepsInput() {
  return screen
    .getAllByRole('textbox')
    .find((input) => !input.id.startsWith('journal-metric-')) as HTMLInputElement
}

async function save() {
  // The navigation is rendered twice (phone and desktop footers).
  await act(async () => {
    fireEvent.click(screen.getAllByRole('button', { name: /save reflection/i })[0])
  })
}

beforeEach(() => {
  logMetricValue.mockReset().mockResolvedValue(undefined)
  insertedTables.length = 0
  vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-11-01T22:30:00Z') })
})

afterEach(() => {
  vi.useRealTimers()
  cleanup()
  window.sessionStorage.clear()
})

describe('EntryForm metrics block', () => {
  it('asks only for metrics that the template does not already feed from a field', () => {
    renderForm({ linkedMetrics: [weight, stepsMetric] })

    expect(screen.getByRole('textbox', { name: 'Weight' })).toBeTruthy()
    expect(screen.queryByRole('textbox', { name: 'Daily steps' })).toBeNull()
  })

  it('shows no block without linked metrics', () => {
    renderForm()

    expect(screen.queryByRole('heading', { name: 'Metrics' })).toBeNull()
  })

  it('prefills the entry date value and warns that saving replaces it', () => {
    renderForm({ linkedMetrics: [{ metric: metric(), value: 81.6 }] })

    expect(weightInput().value).toBe('81.6')
    expect(
      screen.getByText('Already logged for this day (81.6 kg). Changing it replaces it.')
    ).toBeTruthy()
  })
})

describe('EntryForm metric writes', () => {
  it('writes a typed comma decimal and a field-fed value for the day of the entry', async () => {
    renderForm({ linkedMetrics: [weight, stepsMetric] })

    fireEvent.change(weightInput(), { target: { value: '81,6' } })
    fireEvent.change(stepsInput(), { target: { value: '8200' } })
    await save()

    await waitFor(() => expect(logMetricValue).toHaveBeenCalledTimes(2))
    expect(logMetricValue).toHaveBeenCalledWith(expect.anything(), 'user-1', {
      metricId: 'metric-weight',
      date: '2026-11-01',
      value: 81.6,
      sourceEntryId: 'entry-new',
    })
    expect(logMetricValue).toHaveBeenCalledWith(expect.anything(), 'user-1', {
      metricId: 'metric-steps',
      date: '2026-11-01',
      value: 8200,
      sourceEntryId: 'entry-new',
    })
    expect(await screen.findByText('Reflection saved')).toBeTruthy()
  })

  it.each([
    // Ahead of UTC: 00:30 on Nov 2 in Berlin is still Nov 1 in UTC.
    ['Europe/Berlin', '2026-11-01T23:30:00Z', '2026-11-02'],
    // Behind UTC: 22:30 on Nov 1 in New York is already Nov 2 in UTC.
    ['America/New_York', '2026-11-02T03:30:00Z', '2026-11-01'],
  ])('files a late-evening entry in %s under the user day, not the UTC one', async (timezone, now, day) => {
    vi.setSystemTime(new Date(now))
    renderForm({ timezone, linkedMetrics: [weight] })

    fireEvent.change(weightInput(), { target: { value: '80' } })
    await save()

    await waitFor(() => expect(logMetricValue).toHaveBeenCalledTimes(1))
    expect(logMetricValue.mock.calls[0][2]).toMatchObject({ date: day })
  })

  it('writes to the date of an entry that is edited later', async () => {
    renderForm({
      existingEntryId: 'entry-old',
      existingResponses: {},
      entryDate: '2026-10-20',
      linkedMetrics: [weight],
    })

    fireEvent.change(weightInput(), { target: { value: '79.5' } })
    await save()

    await waitFor(() => expect(logMetricValue).toHaveBeenCalledTimes(1))
    expect(logMetricValue).toHaveBeenCalledWith(expect.anything(), 'user-1', {
      metricId: 'metric-weight',
      date: '2026-10-20',
      value: 79.5,
      sourceEntryId: 'entry-old',
    })
  })

  describe('a field-fed value on an edited entry', () => {
    const stepsResponse = {
      'field-steps': {
        field_id: 'field-steps',
        value_text: null,
        value_number: 8200,
        value_boolean: null,
        value_json: null,
        insight_type: null,
        topic_tags: [],
      },
    } as unknown as React.ComponentProps<typeof EntryForm>['existingResponses']

    function renderEdit() {
      renderForm({
        existingEntryId: 'entry-old',
        existingResponses: stepsResponse,
        entryDate: '2026-10-20',
        linkedMetrics: [stepsMetric],
      })
    }

    it('writes nothing when the field still holds the loaded number', async () => {
      renderEdit()

      expect(stepsInput().value).toBe('8200')
      await save()

      expect(await screen.findByText('Reflection saved')).toBeTruthy()
      expect(logMetricValue).not.toHaveBeenCalled()
    })

    it('writes the number when the field was changed', async () => {
      renderEdit()

      fireEvent.change(stepsInput(), { target: { value: '9000' } })
      await save()

      await waitFor(() => expect(logMetricValue).toHaveBeenCalledTimes(1))
      expect(logMetricValue).toHaveBeenCalledWith(expect.anything(), 'user-1', {
        metricId: 'metric-steps',
        date: '2026-10-20',
        value: 9000,
        sourceEntryId: 'entry-old',
      })
    })

    it('writes the number of a new entry even when it equals nothing loaded', async () => {
      renderForm({ linkedMetrics: [stepsMetric] })

      fireEvent.change(stepsInput(), { target: { value: '8200' } })
      await save()

      await waitFor(() => expect(logMetricValue).toHaveBeenCalledTimes(1))
      expect(logMetricValue.mock.calls[0][2]).toMatchObject({ metricId: 'metric-steps', value: 8200 })
    })
  })

  it('writes nothing for an empty input or an empty field', async () => {
    renderForm({ linkedMetrics: [weight, stepsMetric] })

    await save()

    expect(await screen.findByText('Reflection saved')).toBeTruthy()
    expect(logMetricValue).not.toHaveBeenCalled()
  })

  it('keeps the entry and asks for a retry when a metric write fails', async () => {
    logMetricValue.mockRejectedValueOnce(new Error('boom'))
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    renderForm({ linkedMetrics: [weight] })

    fireEvent.change(weightInput(), { target: { value: '81,6' } })
    await save()

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain('saved')
    expect(alert.textContent).toContain('try again')
    expect(screen.queryByText('Reflection saved')).toBeNull()
    expect(weightInput().value).toBe('81,6')
    const entryInserts = insertedTables.filter((table) => table === 'journal_entries').length

    // The retry updates the entry that was saved instead of creating a second one.
    await save()

    expect(await screen.findByText('Reflection saved')).toBeTruthy()
    expect(logMetricValue).toHaveBeenCalledTimes(2)
    expect(logMetricValue.mock.calls[1][2]).toMatchObject({ sourceEntryId: 'entry-new' })
    expect(insertedTables.filter((table) => table === 'journal_entries')).toHaveLength(entryInserts)
    consoleError.mockRestore()
  })

  it('keeps the saved entry day on a retry after midnight', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    logMetricValue.mockRejectedValueOnce(new Error('boom'))
    renderForm({ linkedMetrics: [weight] })

    fireEvent.change(weightInput(), { target: { value: '81' } })
    await save()
    await screen.findByRole('alert')

    vi.setSystemTime(new Date('2026-11-02T00:10:00Z'))
    await save()

    await waitFor(() => expect(logMetricValue).toHaveBeenCalledTimes(2))
    expect(logMetricValue.mock.calls[0][2]).toMatchObject({ date: '2026-11-01' })
    expect(logMetricValue.mock.calls[1][2]).toMatchObject({ date: '2026-11-01' })
    consoleError.mockRestore()
  })
})

describe('EntryForm prefilled metric values', () => {
  const logged = { metric: metric(), value: 81.6 }

  it('writes nothing for a prefilled value that was not touched', async () => {
    renderForm({ linkedMetrics: [logged] })

    await save()

    expect(await screen.findByText('Reflection saved')).toBeTruthy()
    expect(logMetricValue).not.toHaveBeenCalled()
  })

  it('treats the same number typed with a comma as untouched', async () => {
    renderForm({ linkedMetrics: [logged] })

    fireEvent.change(weightInput(), { target: { value: '81,6' } })
    await save()

    expect(await screen.findByText('Reflection saved')).toBeTruthy()
    expect(logMetricValue).not.toHaveBeenCalled()
  })

  it('writes a prefilled value that was edited', async () => {
    renderForm({ linkedMetrics: [logged] })

    fireEvent.change(weightInput(), { target: { value: '80,9' } })
    await save()

    await waitFor(() => expect(logMetricValue).toHaveBeenCalledTimes(1))
    expect(logMetricValue.mock.calls[0][2]).toMatchObject({ metricId: 'metric-weight', value: 80.9 })
  })

  it('writes nothing for a cleared prefilled input and leaves the value of the day', async () => {
    renderForm({ linkedMetrics: [logged] })

    fireEvent.change(weightInput(), { target: { value: '' } })
    await save()

    expect(await screen.findByText('Reflection saved')).toBeTruthy()
    expect(logMetricValue).not.toHaveBeenCalled()
  })
})

describe('EntryForm draft', () => {
  const draftKey = journalDraftKey({ userId: 'user-1', templateId: 'tpl-1' })

  it('restores what was typed in the Metrics block', () => {
    window.sessionStorage.setItem(
      draftKey,
      serializeJournalDraft({ activeStep: 0, values: {}, metricInputs: { 'metric-weight': '79,5' } })
    )

    renderForm({ linkedMetrics: [weight] })

    expect(weightInput().value).toBe('79,5')
  })

  it('keeps the prefill when the draft predates the block', () => {
    window.sessionStorage.setItem(draftKey, serializeJournalDraft({ activeStep: 0, values: {} }))

    renderForm({ linkedMetrics: [{ metric: metric(), value: 81.6 }] })

    expect(weightInput().value).toBe('81.6')
  })

  it('stores the block input in the draft', async () => {
    renderForm({ linkedMetrics: [weight] })

    fireEvent.change(weightInput(), { target: { value: '78' } })

    await waitFor(() => {
      const stored = JSON.parse(window.sessionStorage.getItem(draftKey) ?? '{}')
      expect(stored.metricInputs).toEqual({ 'metric-weight': '78' })
    })
  })
})

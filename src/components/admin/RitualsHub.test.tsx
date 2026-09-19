import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RitualsHub } from '@/components/admin/RitualsHub'
import { DEFAULT_RITUAL_SETTINGS } from '@/lib/rituals'

const update = vi.fn()
const refresh = vi.fn()

vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({ client: true }) }))
vi.mock('@/lib/supabase/helpers', () => ({
  supabaseUpdateWhereReturning: (...args: unknown[]) => update(...args),
}))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }))

const templates = [
  { id: 'tmpl-evening', name: 'Evening Review', icon: '🌙' },
  { id: 'tmpl-weekly', name: 'Weekly Review', icon: '📝' },
]

const settings = {
  ...DEFAULT_RITUAL_SETTINGS,
  evening_review: { ...DEFAULT_RITUAL_SETTINGS.evening_review, templateId: 'tmpl-evening' },
}

function card(name: RegExp) {
  return screen.getByRole('region', { name })
}

beforeEach(() => {
  update.mockReset().mockResolvedValue({ data: [{ ritual: 'x' }], error: null })
  refresh.mockReset()
})

afterEach(() => {
  cleanup()
})

describe('RitualsHub', () => {
  it('shows one card per ritual in dashboard order', () => {
    render(<RitualsHub userId="admin-1" trusted settings={settings} templates={templates} />)

    const headings = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)
    expect(headings).toEqual(['Daily Plan', 'Evening Review', 'Weekly Review', 'Weekly Plan'])
  })

  it('offers a weekday only for the weekly rituals and a template only for the journal-backed ones', () => {
    render(<RitualsHub userId="admin-1" trusted settings={settings} templates={templates} />)

    expect(card(/daily plan/i).querySelector('select[name="weekday"]')).toBeNull()
    expect(card(/daily plan/i).querySelector('select[name="template"]')).toBeNull()
    expect(card(/evening review/i).querySelector('select[name="weekday"]')).toBeNull()
    expect(card(/evening review/i).querySelector('select[name="template"]')).not.toBeNull()
    expect(card(/weekly review/i).querySelector('select[name="weekday"]')).not.toBeNull()
  })

  it('keeps Save disabled until something changed', () => {
    render(<RitualsHub userId="admin-1" trusted settings={settings} templates={templates} />)

    const save = card(/evening review/i).querySelector('button[type="submit"]') as HTMLButtonElement
    expect(save.disabled).toBe(true)

    fireEvent.change(card(/evening review/i).querySelector('input[name="title"]')!, { target: { value: 'Evening, {name}' } })
    expect(save.disabled).toBe(false)
  })

  it('previews the title with a sample name', () => {
    render(<RitualsHub userId="admin-1" trusted settings={settings} templates={templates} />)

    fireEvent.change(card(/evening review/i).querySelector('input[name="title"]')!, { target: { value: 'Evening, {name}' } })
    expect(card(/evening review/i).textContent).toContain('Evening, Alex')
  })

  it('saves the row in snake_case, keyed by the ritual', async () => {
    render(<RitualsHub userId="admin-1" trusted settings={settings} templates={templates} />)
    const region = card(/evening review/i)

    fireEvent.change(region.querySelector('input[name="from"]')!, { target: { value: '21:30' } })
    fireEvent.change(region.querySelector('select[name="template"]')!, { target: { value: 'tmpl-weekly' } })
    fireEvent.change(region.querySelector('input[name="cta"]')!, { target: { value: 'Wrap up' } })
    fireEvent.submit(region.querySelector('form')!)

    await waitFor(() => expect(update).toHaveBeenCalledTimes(1))
    const [, table, payload, eqField, eqValue] = update.mock.calls[0]
    expect(table).toBe('ritual_settings')
    expect(eqField).toBe('ritual')
    expect(eqValue).toBe('evening_review')
    expect(payload).toMatchObject({
      enabled: true,
      weekday: null,
      from_minutes: 21 * 60 + 30,
      template_id: 'tmpl-weekly',
      title: settings.evening_review.title,
      description: settings.evening_review.description,
      cta_label: 'Wrap up',
      updated_by: 'admin-1',
    })
    expect(typeof payload.updated_at).toBe('string')
    await waitFor(() => expect(refresh).toHaveBeenCalled())
  })

  it('saves a weekly ritual\'s weekday as a number and "none" as a null template', async () => {
    render(<RitualsHub userId="admin-1" trusted settings={settings} templates={templates} />)
    const region = card(/weekly review/i)

    fireEvent.change(region.querySelector('select[name="weekday"]')!, { target: { value: '4' } })
    fireEvent.change(region.querySelector('select[name="template"]')!, { target: { value: '' } })
    fireEvent.submit(region.querySelector('form')!)

    await waitFor(() => expect(update).toHaveBeenCalledTimes(1))
    expect(update.mock.calls[0][2]).toMatchObject({ weekday: 4, template_id: null })
    expect(region.textContent).toContain('will not show')
  })

  it('keeps a null stored weekday concrete in the select and the saved payload', async () => {
    const nullWeekdaySettings = {
      ...settings,
      weekly_review: { ...settings.weekly_review, weekday: null },
    }
    render(<RitualsHub userId="admin-1" trusted settings={nullWeekdaySettings} templates={templates} />)
    const region = card(/weekly review/i)

    expect((region.querySelector('select[name="weekday"]') as HTMLSelectElement).value).toBe('0')

    fireEvent.change(region.querySelector('input[name="title"]')!, { target: { value: 'Weekly, {name}' } })
    fireEvent.submit(region.querySelector('form')!)

    await waitFor(() => expect(update).toHaveBeenCalledTimes(1))
    expect(update.mock.calls[0][2]).toMatchObject({ weekday: 0 })
  })

  it('refuses an empty title without calling the database', async () => {
    render(<RitualsHub userId="admin-1" trusted settings={settings} templates={templates} />)
    const region = card(/weekly plan/i)

    fireEvent.change(region.querySelector('input[name="title"]')!, { target: { value: '   ' } })
    fireEvent.submit(region.querySelector('form')!)

    expect(await screen.findByText(/title, description and call to action are required/i)).toBeTruthy()
    expect(update).not.toHaveBeenCalled()
  })

  it('reports an RLS-filtered no-op as not saved, without showing "Saved" or refreshing', async () => {
    update.mockResolvedValue({ data: [], error: null })
    render(<RitualsHub userId="admin-1" trusted settings={settings} templates={templates} />)
    const region = card(/daily plan/i)

    fireEvent.change(region.querySelector('input[name="title"]')!, { target: { value: 'Morning, {name}' } })
    fireEvent.submit(region.querySelector('form')!)

    expect(await screen.findByText(/not allowed to change ritual settings/i)).toBeTruthy()
    expect(screen.queryByText(/^saved$/i)).toBeNull()
    expect(refresh).not.toHaveBeenCalled()
  })

  it('shows the database error inline when the save is rejected', async () => {
    update.mockResolvedValue({ data: null, error: { message: 'connection lost' } })
    render(<RitualsHub userId="admin-1" trusted settings={settings} templates={templates} />)
    const region = card(/daily plan/i)

    fireEvent.change(region.querySelector('input[name="title"]')!, { target: { value: 'Morning, {name}' } })
    fireEvent.submit(region.querySelector('form')!)

    expect(await screen.findByText(/connection lost/i)).toBeTruthy()
  })

  it('renders read-only for an allowlist admin', () => {
    render(<RitualsHub userId="admin-1" trusted={false} settings={settings} templates={templates} />)

    expect(screen.getByText(/read-only/i)).toBeTruthy()
    expect(screen.queryByRole('button', { name: /save/i })).toBeNull()
    expect((card(/daily plan/i).querySelector('input[name="title"]') as HTMLInputElement).disabled).toBe(true)
    expect(card(/daily plan/i).querySelector('[role="switch"]')!.getAttribute('aria-disabled') ?? card(/daily plan/i).querySelector('[role="switch"]')!.getAttribute('data-disabled')).not.toBeNull()
  })
})

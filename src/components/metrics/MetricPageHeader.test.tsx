import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MetricPageHeader } from '@/components/metrics/MetricPageHeader'
import type { Metric } from '@/lib/metrics'

const replace = vi.fn()

vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({ client: true }) }))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace }),
  usePathname: () => '/journal/metrics/metric-1',
}))

const templates = [{ id: 'tpl-1', name: 'Morning check-in', archived: false, numberFields: [] }]

const metric: Metric = {
  id: 'metric-1',
  name: 'Weight',
  unit: 'kg',
  targetValue: 80,
  targetDirection: 'at_most',
  templateId: null,
  templateName: null,
  templateArchived: false,
  sourceFieldId: null,
  createdAt: '2026-10-01T00:00:00Z',
}

beforeEach(() => {
  replace.mockReset()
})

afterEach(cleanup)

describe('MetricPageHeader', () => {
  it('links back to the dashboard from home', () => {
    render(<MetricPageHeader metric={metric} templates={templates} backHref="/dashboard" latest={null} />)

    const link = screen.getByRole('link', { name: '‹ Home' })
    expect(link.getAttribute('href')).toBe('/dashboard')
  })

  it('links back to the metrics list otherwise', () => {
    render(<MetricPageHeader metric={metric} templates={templates} backHref="/journal/metrics" latest={null} />)

    const link = screen.getByRole('link', { name: '‹ Metrics' })
    expect(link.getAttribute('href')).toBe('/journal/metrics')
  })

  it('shows the name and the target', () => {
    render(<MetricPageHeader metric={metric} templates={templates} backHref="/journal/metrics" latest={null} />)

    expect(screen.getByRole('heading', { name: 'Weight' })).toBeTruthy()
    expect(screen.getByText('at most 80 kg')).toBeTruthy()
  })

  it('words an at-least target', () => {
    render(
      <MetricPageHeader
        templates={templates}
        metric={{ ...metric, name: 'Steps', unit: null, targetValue: 8000, targetDirection: 'at_least' }}
        backHref="/journal/metrics"
        latest={null}
      />
    )

    expect(screen.getByText('at least 8000')).toBeTruthy()
  })

  it('says No target when none is set', () => {
    render(
      <MetricPageHeader
        templates={templates}
        metric={{ ...metric, targetValue: null, targetDirection: null }}
        backHref="/journal/metrics"
        latest={null}
      />
    )

    expect(screen.getByText('No target')).toBeTruthy()
  })

  describe('latest value', () => {
    function renderLatest(
      latest: { value: number; date: string } | null,
      overrides: Partial<Metric> = {}
    ) {
      render(
        <MetricPageHeader
          metric={{ ...metric, ...overrides }}
          templates={templates}
          backHref="/journal/metrics"
          latest={latest}
        />
      )
    }

    it('shows the latest value large, with its unit and day', () => {
      renderLatest({ value: 81.6, date: '2026-10-29' })

      expect(screen.getByText('81.6 kg').className).toContain('text-4xl')
      expect(screen.getByText('Oct 29')).toBeTruthy()
      expect(screen.queryByText('No value yet')).toBeNull()
    })

    it('says No value yet without a latest value, and shows no pill', () => {
      renderLatest(null)

      expect(screen.getByText('No value yet')).toBeTruthy()
      expect(screen.queryByText('On target')).toBeNull()
      expect(screen.queryByText('Off target')).toBeNull()
    })

    it('shows On target when the latest value meets the target', () => {
      renderLatest({ value: 79.5, date: '2026-10-29' })

      expect(screen.getByText('On target')).toBeTruthy()
      expect(screen.queryByText('Off target')).toBeNull()
    })

    it('counts a value equal to the target as on target', () => {
      renderLatest({ value: 80, date: '2026-10-29' })

      expect(screen.getByText('On target')).toBeTruthy()
    })

    it('shows Off target when the latest value misses the target', () => {
      renderLatest({ value: 81.6, date: '2026-10-29' })

      expect(screen.getByText('Off target')).toBeTruthy()
      expect(screen.queryByText('On target')).toBeNull()
    })

    it('shows no pill without a target', () => {
      renderLatest(
        { value: 81.6, date: '2026-10-29' },
        { targetValue: null, targetDirection: null }
      )

      expect(screen.queryByText('On target')).toBeNull()
      expect(screen.queryByText('Off target')).toBeNull()
    })
  })

  describe('archived template', () => {
    const archived: Partial<Metric> = {
      templateId: 'tpl-old',
      templateName: 'Morning check-in',
      templateArchived: true,
    }

    function renderArchived(overrides: Partial<Metric> = archived) {
      render(
        <MetricPageHeader
          metric={{ ...metric, ...overrides }}
          templates={[
            { id: 'tpl-old', name: 'Morning check-in', archived: true, numberFields: [] },
            ...templates,
          ]}
          backHref="/journal/metrics"
          latest={null}
        />
      )
    }

    it('says where the metric is asked and that the template is archived', () => {
      renderArchived()

      expect(screen.getByText('Asked in Morning check-in (archived)')).toBeTruthy()
    })

    it('shows nothing for an active or missing template', () => {
      renderArchived({ templateId: 'tpl-1', templateName: 'Morning check-in' })

      expect(screen.queryByText(/\(archived\)/)).toBeNull()
      expect(screen.queryByRole('button', { name: 'Change template' })).toBeNull()
    })

    it('opens the settings on the journal section from Change template', async () => {
      renderArchived()

      fireEvent.click(screen.getByRole('button', { name: 'Change template' }))

      expect(screen.getByRole('dialog')).toBeTruthy()
      await waitFor(() =>
        expect(document.activeElement).toBe(
          screen.getByRole('switch', { name: 'Also ask in my journal' })
        )
      )
    })
  })

  it('opens the settings dialog from the gear button', () => {
    render(<MetricPageHeader metric={metric} templates={templates} backHref="/journal/metrics" latest={null} />)

    expect(screen.queryByRole('dialog')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Metric settings' }))

    expect(screen.getByRole('dialog')).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Weight settings' })).toBeTruthy()
  })

  it('shows no created hint by default', () => {
    render(<MetricPageHeader metric={metric} templates={templates} backHref="/journal/metrics" latest={null} />)

    expect(screen.queryByText('Almost there.')).toBeNull()
  })

  describe('after creating the metric', () => {
    function renderCreated(backHref: '/dashboard' | '/journal/metrics' = '/journal/metrics') {
      render(<MetricPageHeader metric={metric} templates={templates} backHref={backHref} latest={null} created />)
    }

    it('shows the hint', () => {
      renderCreated()

      expect(screen.getByText('Almost there.')).toBeTruthy()
    })

    it('opens the settings on the target from Set a target', async () => {
      renderCreated()

      fireEvent.click(screen.getByRole('button', { name: 'Set a target' }))

      const dialog = screen.getByRole('dialog')
      expect(dialog).toBeTruthy()
      await waitFor(() =>
        expect(document.activeElement).toBe(screen.getByRole('switch', { name: 'Target' }))
      )
    })

    it('opens the settings on the journal link from Ask in journal', async () => {
      renderCreated()

      fireEvent.click(screen.getByRole('button', { name: 'Ask in journal' }))

      await waitFor(() =>
        expect(document.activeElement).toBe(
          screen.getByRole('switch', { name: 'Also ask in my journal' })
        )
      )
    })

    it('drops created from the URL and hides the hint on Later', () => {
      renderCreated()

      fireEvent.click(screen.getByRole('button', { name: 'Later' }))

      expect(replace).toHaveBeenCalledWith('/journal/metrics/metric-1')
      expect(screen.queryByText('Almost there.')).toBeNull()
    })

    it('keeps from=home in the URL on Later', () => {
      renderCreated('/dashboard')

      fireEvent.click(screen.getByRole('button', { name: 'Later' }))

      expect(replace).toHaveBeenCalledWith('/journal/metrics/metric-1?from=home')
    })
  })
})

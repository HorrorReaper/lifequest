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

const templates = [{ id: 'tpl-1', name: 'Morning check-in', archived: false }]

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
    render(<MetricPageHeader metric={metric} templates={templates} backHref="/dashboard" />)

    const link = screen.getByRole('link', { name: '‹ Home' })
    expect(link.getAttribute('href')).toBe('/dashboard')
  })

  it('links back to the metrics list otherwise', () => {
    render(<MetricPageHeader metric={metric} templates={templates} backHref="/journal/metrics" />)

    const link = screen.getByRole('link', { name: '‹ Metrics' })
    expect(link.getAttribute('href')).toBe('/journal/metrics')
  })

  it('shows the name and the target', () => {
    render(<MetricPageHeader metric={metric} templates={templates} backHref="/journal/metrics" />)

    expect(screen.getByRole('heading', { name: 'Weight' })).toBeTruthy()
    expect(screen.getByText('at most 80 kg')).toBeTruthy()
  })

  it('words an at-least target', () => {
    render(
      <MetricPageHeader
        templates={templates}
        metric={{ ...metric, name: 'Steps', unit: null, targetValue: 8000, targetDirection: 'at_least' }}
        backHref="/journal/metrics"
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
      />
    )

    expect(screen.getByText('No target')).toBeTruthy()
  })

  it('opens the settings dialog from the gear button', () => {
    render(<MetricPageHeader metric={metric} templates={templates} backHref="/journal/metrics" />)

    expect(screen.queryByRole('dialog')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Metric settings' }))

    expect(screen.getByRole('dialog')).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Weight settings' })).toBeTruthy()
  })

  it('shows no created hint by default', () => {
    render(<MetricPageHeader metric={metric} templates={templates} backHref="/journal/metrics" />)

    expect(screen.queryByText('Almost there.')).toBeNull()
  })

  describe('after creating the metric', () => {
    function renderCreated(backHref: '/dashboard' | '/journal/metrics' = '/journal/metrics') {
      render(<MetricPageHeader metric={metric} templates={templates} backHref={backHref} created />)
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

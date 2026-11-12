import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({}) }))

import { MetricCreateLauncher } from '@/components/metrics/MetricCreateLauncher'

afterEach(() => {
  cleanup()
  window.history.replaceState(null, '', '/')
})

describe('MetricCreateLauncher', () => {
  it('opens the create dialog on mount when initiallyOpen', () => {
    render(<MetricCreateLauncher userId="u-1" initiallyOpen variant="button" />)

    expect(screen.getByRole('dialog')).toBeTruthy()
    expect(screen.getByText('Create a metric')).toBeTruthy()
  })

  it('stays closed when not initiallyOpen', () => {
    render(<MetricCreateLauncher userId="u-1" initiallyOpen={false} variant="button" />)

    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('renders the "+ New" button for the button variant and opens the dialog from it', () => {
    render(<MetricCreateLauncher userId="u-1" initiallyOpen={false} variant="button" />)

    fireEvent.click(screen.getByRole('button', { name: '+ New' }))

    expect(screen.getByRole('dialog')).toBeTruthy()
  })

  it('renders the empty state for the empty variant and opens the dialog from it', () => {
    render(<MetricCreateLauncher userId="u-1" initiallyOpen={false} variant="empty" />)

    expect(screen.getByText('Track a number over time')).toBeTruthy()
    expect(screen.queryByRole('button', { name: '+ New' })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Create your first metric' }))

    expect(screen.getByRole('dialog')).toBeTruthy()
  })

  it('drops ?new=1 from the address once the dialog closes', () => {
    window.history.replaceState(null, '', '/journal/metrics?new=1')
    render(<MetricCreateLauncher userId="u-1" initiallyOpen variant="button" />)

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })

    expect(window.location.search).toBe('')
  })
})

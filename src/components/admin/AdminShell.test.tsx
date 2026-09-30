import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import { AdminShell } from './AdminShell'

vi.mock('next/navigation', () => ({ usePathname: () => '/admin/tools' }))

afterEach(() => {
  cleanup()
})

describe('AdminShell counts', () => {
  it('shows the waitlist size right next to the registered users', () => {
    render(
      <AdminShell trusted userCount={128} waitlistCount={42}>
        <p>content</p>
      </AdminShell>
    )

    const counts = screen.getByRole('group', { name: 'App counts' })
    expect(within(counts).getByText('128')).toBeTruthy()
    expect(within(counts).getByText('Registered')).toBeTruthy()
    expect(within(counts).getByText('42')).toBeTruthy()
    expect(within(counts).getByText('Waitlist')).toBeTruthy()
  })

  it('names both numbers in the compact mobile header, where only icons show', () => {
    render(
      <AdminShell trusted userCount={128} waitlistCount={42}>
        <p>content</p>
      </AdminShell>
    )

    expect(screen.getByLabelText('128 registered users')).toBeTruthy()
    expect(screen.getByLabelText('42 waitlist signups')).toBeTruthy()
  })

  it('shows a dash for a count it could not read', () => {
    render(
      <AdminShell trusted={false} userCount={null} waitlistCount={null}>
        <p>content</p>
      </AdminShell>
    )

    const counts = screen.getByRole('group', { name: 'App counts' })
    expect(within(counts).getAllByText('-')).toHaveLength(2)
  })
})

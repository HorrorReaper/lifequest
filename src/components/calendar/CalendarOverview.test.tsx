import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { CalendarOverview } from './CalendarOverview'
import type { ContactOccurrence } from '@/lib/contacts/types'

afterEach(cleanup)

const base = {
  basePath: '/admin/work/calendar',
  plannerPath: '/admin/work/plan',
  tasksPath: '/admin/work/tasks',
  date: '2026-09-23',
  today: '2026-09-23',
  view: 'week' as const,
  plans: [{ plan_date: '2026-09-23', blocks: [{ id: 'b1', title: 'Review design', start_time: '09:00', end_time: '10:00', category: 'deep_work' as const }] }],
  tasks: [{ id: 't1', title: 'Ship release', due_date: '2026-09-23', is_completed: false, project_id: null }],
}

describe('CalendarOverview', () => {
  it('shows a shared contact occasion once and retains filters through navigation', () => {
    render(<CalendarOverview {...base} sources="contacts" contacts={[{id:'event',title:'Anna & Ben anniversary',occurrence_date:base.date,kind:'anniversary',origin_year:2020,show_in_calendar:true,members:[{id:'anna',name:'Anna'},{id:'ben',name:'Ben'}]} as ContactOccurrence]} />)
    expect(screen.getAllByText(/Anna & Ben anniversary/)).toHaveLength(1)
    expect(screen.queryByText('Ship release')).toBeNull()
    expect(screen.getByRole('link',{name:'Anna'}).getAttribute('href')).toBe('/admin/contacts/anna?tab=dates')
    expect(screen.getByRole('link',{name:'Next week'}).getAttribute('href')).toContain('sources=contacts')
  })
  it('shows the same plan block and deadline in the selected day and links to the existing planner', () => {
    render(<CalendarOverview {...base} />)
    expect(screen.getAllByText(/Review design/).length).toBeGreaterThan(0)
    expect(screen.getByText('Ship release')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Edit today’s plan' }).getAttribute('href')).toBe('/admin/work/plan?step=timeline')
    expect(screen.getByRole('link', { name: /manage tasks/i }).getAttribute('href')).toBe('/admin/work/tasks')
  })

  it('does not point a future day at the today-only planner', () => {
    render(<CalendarOverview {...base} date="2026-09-24" />)
    expect(screen.queryByRole('link', { name: /plan today|edit today/i })).toBeNull()
  })
})

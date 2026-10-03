import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, it, vi } from 'vitest'
import type { WorkspaceProject } from '@/lib/projects/project-workspace'
import { ProjectDetail } from './ProjectDetail'

const mocks = vi.hoisted(() => ({ board: vi.fn(), single: vi.fn() }))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => '/admin/work/projects/project',
  useSearchParams: () => new URLSearchParams(),
}))
vi.mock('@/lib/supabase/client', () => ({ createClient: () => {
  const query = { select: () => query, eq: () => query, order: () => query, single: mocks.single }
  return { from: () => query }
} }))
vi.mock('@/lib/projects/project-data', () => ({
  loadBoard: mocks.board,
  allProjectRows: vi.fn().mockResolvedValue([]),
}))
vi.mock('./ProjectTasks', () => ({ ProjectTasks: () => <div>Task workspace ready</div> }))
afterEach(cleanup)

it('blocks mutations after a failed initial read and recovers through Reload', async () => {
  const project = { id: 'project', name: 'Project', status: 'active', priority: 'medium', color: '#abcdef', board_version: 0 } as WorkspaceProject
  mocks.single.mockResolvedValue({ data: project, error: null })
  mocks.board.mockRejectedValueOnce(new Error('Network unavailable')).mockResolvedValue({ version: 0, tasks: [] })
  render(<ProjectDetail userId="owner" initialProject={project} />)
  await waitFor(() => expect(screen.getByRole('status').textContent).toContain('Project data unavailable'))
  expect((screen.getByRole('button', { name: 'Edit project' }) as HTMLButtonElement).disabled).toBe(true)
  expect(screen.queryByText('Task workspace ready')).toBeNull()
  await userEvent.setup().click(screen.getByRole('button', { name: 'Reload' }))
  await screen.findByText('Task workspace ready')
  expect((screen.getByRole('button', { name: 'Edit project' }) as HTMLButtonElement).disabled).toBe(false)
})

import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { TaskEditorDialog } from './TaskEditorDialog'

afterEach(cleanup)

describe('TaskEditorDialog', () => {
  it('captures description, priority and a date-only due date', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn(async () => undefined)

    render(
      <TaskEditorDialog
        open
        task={null}
        saving={false}
        error={null}
        onOpenChange={() => undefined}
        onSubmit={onSubmit}
      />
    )

    await user.type(screen.getByLabelText('Task'), 'Prepare launch')
    await user.type(
      screen.getByLabelText('Description'),
      'Review the final positioning'
    )
    await user.click(screen.getByRole('button', { name: /High/ }))
    await user.type(screen.getByLabelText('Due date'), '2026-07-28')
    await user.click(screen.getByRole('button', { name: 'Create task' }))

    expect(onSubmit).toHaveBeenCalledWith({
      title: 'Prepare launch',
      description: 'Review the final positioning',
      due_date: '2026-07-28',
      priority: 'high',
    })
  })

  it('keeps a visible mutation error inside the editor', () => {
    render(
      <TaskEditorDialog
        open
        task={null}
        saving={false}
        error="The task could not be created."
        onOpenChange={() => undefined}
        onSubmit={async () => undefined}
      />
    )

    expect(screen.getByRole('alert').textContent).toContain(
      'The task could not be created.'
    )
  })
})

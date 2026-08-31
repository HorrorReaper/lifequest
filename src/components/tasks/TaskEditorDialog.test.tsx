import { cleanup, fireEvent, render, screen } from '@testing-library/react'
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

describe('TaskEditorDialog due date', () => {
  it('opens the calendar when the field itself is clicked', () => {
    const showPicker = vi.fn()
    render(
      <TaskEditorDialog
        open
        task={null}
        saving={false}
        error={null}
        onOpenChange={() => undefined}
        onSubmit={async () => undefined}
      />
    )

    const field = screen.getByLabelText(/due date/i) as HTMLInputElement
    field.showPicker = showPicker
    fireEvent.click(field)

    expect(showPicker).toHaveBeenCalled()
  })

  it('still lets a date be typed where showPicker is unsupported', () => {
    render(
      <TaskEditorDialog
        open
        task={null}
        saving={false}
        error={null}
        onOpenChange={() => undefined}
        onSubmit={async () => undefined}
      />
    )

    const field = screen.getByLabelText(/due date/i) as HTMLInputElement
    // jsdom has no showPicker; the click handler must swallow that rather
    // than throwing and blocking manual entry.
    field.showPicker = () => {
      throw new Error('unsupported')
    }
    fireEvent.click(field)
    fireEvent.change(field, { target: { value: '2026-09-15' } })

    expect(field.value).toBe('2026-09-15')
  })
})

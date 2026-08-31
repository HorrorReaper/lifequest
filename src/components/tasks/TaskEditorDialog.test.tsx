import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
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
  function renderDialog() {
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
  }

  it('keeps a native date field, which is the better control on a phone', () => {
    renderDialog()

    const field = screen.getByLabelText(/due date/i) as HTMLInputElement
    expect(field.type).toBe('date')
  })

  it('also offers a themed calendar for pointer devices', () => {
    renderDialog()

    expect(screen.getByRole('button', { name: /pick a date/i })).toBeTruthy()
  })

  it('shows a chosen date on the calendar trigger too', () => {
    render(
      <TaskEditorDialog
        open
        task={{
          id: 't1',
          user_id: 'u1',
          title: 'Report',
          description: null,
          due_date: '2026-09-15',
          priority: 'medium',
          is_completed: false,
          created_at: '2026-09-01T00:00:00.000Z',
          updated_at: '2026-09-01T00:00:00.000Z',
        }}
        saving={false}
        error={null}
        onOpenChange={() => undefined}
        onSubmit={async () => undefined}
      />
    )

    // Both controls read from the same date key, so neither can drift.
    expect((screen.getByLabelText(/due date/i) as HTMLInputElement).value).toBe('2026-09-15')
    expect(screen.getByRole('button', { name: /September 15th, 2026/i })).toBeTruthy()
  })

  it('opens the calendar on click and picks a day without closing the dialog', async () => {
    // The picker lives inside a dialog and portals its popover out of it,
    // which is where this kind of thing usually breaks: the click either does
    // nothing, or the dialog treats it as an outside click and closes.
    const onOpenChange = vi.fn()
    render(
      <TaskEditorDialog
        open
        task={null}
        saving={false}
        error={null}
        onOpenChange={onOpenChange}
        onSubmit={async () => undefined}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: /pick a date/i }))
    await waitFor(() => expect(screen.getByRole('grid')).toBeTruthy())

    const day = screen.getAllByRole('button').find((button) => button.textContent === '15')
    fireEvent.click(day as HTMLElement)

    await waitFor(() =>
      expect((screen.getByLabelText(/due date/i) as HTMLInputElement).value).not.toBe('')
    )
    expect(onOpenChange).not.toHaveBeenCalledWith(false)
  })

  it('opens the native picker from the field itself, not just its icon', () => {
    // The small-screen branch also renders in a narrow desktop window, where
    // a native date input still only opens from the calendar icon at its edge.
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

  it('still accepts a typed date where showPicker is unsupported', () => {
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
    field.showPicker = () => {
      throw new Error('unsupported')
    }
    fireEvent.click(field)
    fireEvent.change(field, { target: { value: '2026-09-15' } })

    expect(field.value).toBe('2026-09-15')
  })
})

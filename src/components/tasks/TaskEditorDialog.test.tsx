import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { TaskEditorDialog } from './TaskEditorDialog'

afterEach(cleanup)

const TODAY = '2026-10-25'

function renderNew(overrides: Partial<Parameters<typeof TaskEditorDialog>[0]> = {}) {
  const onSubmit = vi.fn(async () => undefined)
  render(
    <TaskEditorDialog
      open
      task={null}
      today={TODAY}
      saving={false}
      error={null}
      onOpenChange={() => undefined}
      onSubmit={onSubmit}
      {...overrides}
    />
  )
  return { onSubmit }
}

const existingTask = {
  id: 't1',
  user_id: 'u1',
  title: 'Report',
  description: null,
  due_date: '2026-09-15',
  priority: 'medium' as const,
  is_completed: false,
  created_at: '2026-09-01T00:00:00.000Z',
  updated_at: '2026-09-01T00:00:00.000Z',
}

describe('TaskEditorDialog', () => {
  it('needs only a title; the description sits under optional details', async () => {
    const user = userEvent.setup()
    const { onSubmit } = renderNew()

    expect(screen.queryByLabelText('Description')).toBeNull()
    await user.type(screen.getByLabelText('Task'), 'Prepare launch')
    await user.click(screen.getByRole('button', { name: 'Create task' }))

    expect(onSubmit).toHaveBeenCalledWith({
      title: 'Prepare launch',
      description: '',
      due_date: null,
      priority: 'medium',
    })
  })

  it('captures description, priority and a chosen date', async () => {
    const user = userEvent.setup()
    const { onSubmit } = renderNew()

    await user.type(screen.getByLabelText('Task'), 'Prepare launch')
    await user.click(screen.getByRole('button', { name: /details/i }))
    await user.type(screen.getByLabelText('Description'), 'Review the final positioning')
    await user.click(screen.getByRole('button', { name: /High/ }))
    await user.click(screen.getByRole('button', { name: 'Choose date' }))
    fireEvent.change(screen.getByLabelText(/due date/i, { selector: 'input' }), {
      target: { value: '2026-07-28' },
    })
    await user.click(screen.getByRole('button', { name: 'Create task' }))

    expect(onSubmit).toHaveBeenCalledWith({
      title: 'Prepare launch',
      description: 'Review the final positioning',
      due_date: '2026-07-28',
      priority: 'high',
    })
  })

  it('offers Today, Tomorrow and No date as one tap each, from the profile day', async () => {
    const user = userEvent.setup()
    const { onSubmit } = renderNew()
    await user.type(screen.getByLabelText('Task'), 'Call the bank')

    await user.click(screen.getByRole('button', { name: 'Today' }))
    expect(screen.getByRole('button', { name: 'Today' }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByText(/Due today\./)).toBeTruthy()

    await user.click(screen.getByRole('button', { name: 'Tomorrow' }))
    expect(screen.getByText(/Due tomorrow\./)).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Create task' }))
    expect(onSubmit).toHaveBeenLastCalledWith(
      expect.objectContaining({ due_date: '2026-10-26' })
    )
  })

  it('clears the date with No date', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn(async () => undefined)
    render(
      <TaskEditorDialog
        open
        task={existingTask}
        today={TODAY}
        saving={false}
        error={null}
        onOpenChange={() => undefined}
        onSubmit={onSubmit}
      />
    )

    expect(screen.getByRole('button', { name: 'Choose date' }).getAttribute('aria-pressed')).toBe(
      'true'
    )
    await user.click(screen.getByRole('button', { name: 'No date' }))
    expect(screen.getByText(/No due date/)).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Save changes' }))
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ due_date: null }))
  })

  it('opens the calendar from Choose date even when the task is due today', async () => {
    // Found in the browser: the button snapped back to "Today" and the
    // calendar never appeared, so a task due today could not be moved to
    // another specific day.
    const user = userEvent.setup()
    render(
      <TaskEditorDialog
        open
        task={{ ...existingTask, due_date: TODAY }}
        today={TODAY}
        saving={false}
        error={null}
        onOpenChange={() => undefined}
        onSubmit={async () => undefined}
      />
    )

    expect(screen.getByRole('button', { name: 'Today' }).getAttribute('aria-pressed')).toBe('true')
    await user.click(screen.getByRole('button', { name: 'Choose date' }))
    expect(screen.getByRole('button', { name: 'Choose date' }).getAttribute('aria-pressed')).toBe(
      'true'
    )
    expect(screen.getByRole('button', { name: /October 25th, 2026/i })).toBeTruthy()
  })

  it('sends one task however fast the save button is pressed twice', async () => {
    let finish: () => void = () => undefined
    const onSubmit = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve
        })
    )
    renderNew({ onSubmit })
    fireEvent.change(screen.getByLabelText('Task'), { target: { value: 'Once only' } })

    const form = screen.getByLabelText('Task').closest('form') as HTMLFormElement
    fireEvent.submit(form)
    fireEvent.submit(form)
    expect(onSubmit).toHaveBeenCalledTimes(1)
    finish()
  })

  it('keeps a visible mutation error and the typed title inside the editor', () => {
    renderNew({ error: 'The task could not be created.' })
    fireEvent.change(screen.getByLabelText('Task'), { target: { value: 'Keep me' } })

    expect(screen.getByRole('alert').textContent).toContain('The task could not be created.')
    expect((screen.getByLabelText('Task') as HTMLInputElement).value).toBe('Keep me')
    expect(screen.getByRole('button', { name: 'Retry save' })).toBeTruthy()
  })
})

describe('TaskEditorDialog chosen date', () => {
  async function openChooser() {
    renderNew()
    fireEvent.click(screen.getByRole('button', { name: 'Choose date' }))
  }

  it('keeps a native date field, which is the better control on a phone', async () => {
    await openChooser()
    const field = screen.getByLabelText(/due date/i, { selector: 'input' }) as HTMLInputElement
    expect(field.type).toBe('date')
  })

  it('also offers a themed calendar for pointer devices', async () => {
    await openChooser()
    expect(screen.getByRole('button', { name: /pick a date/i })).toBeTruthy()
  })

  it('shows a saved date on the calendar trigger too', () => {
    render(
      <TaskEditorDialog
        open
        task={existingTask}
        today={TODAY}
        saving={false}
        error={null}
        onOpenChange={() => undefined}
        onSubmit={async () => undefined}
      />
    )

    expect(
      (screen.getByLabelText(/due date/i, { selector: 'input' }) as HTMLInputElement).value
    ).toBe('2026-09-15')
    expect(screen.getByRole('button', { name: /September 15th, 2026/i })).toBeTruthy()
  })

  it('opens the calendar on click and picks a day without closing the dialog', async () => {
    // The picker lives inside a dialog and portals its popover out of it,
    // which is where this kind of thing usually breaks: the click either does
    // nothing, or the dialog treats it as an outside click and closes.
    const onOpenChange = vi.fn()
    renderNew({ onOpenChange })
    fireEvent.click(screen.getByRole('button', { name: 'Choose date' }))

    fireEvent.click(screen.getByRole('button', { name: /pick a date/i }))
    await waitFor(() => expect(screen.getByRole('grid')).toBeTruthy())

    const day = screen.getAllByRole('button').find((button) => button.textContent === '15')
    fireEvent.click(day as HTMLElement)

    await waitFor(() =>
      expect(
        (screen.getByLabelText(/due date/i, { selector: 'input' }) as HTMLInputElement).value
      ).not.toBe('')
    )
    expect(onOpenChange).not.toHaveBeenCalledWith(false)
  })

  it('puts the calendar layer above the dialog, on the positioned wrapper', async () => {
    // Regression for the calendar that opened behind the task dialog: the
    // layer was on the inner popup, while its absolutely positioned wrapper
    // sat at the page's base layer under the dialog (z-50).
    await openChooser()
    fireEvent.click(screen.getByRole('button', { name: /pick a date/i }))
    const grid = await screen.findByRole('grid')

    let node: HTMLElement | null = grid
    let positioned: HTMLElement | null = null
    while (node && node !== document.body) {
      if (node.className.includes('z-[90]')) positioned = node
      node = node.parentElement
    }
    expect(positioned).not.toBeNull()
    // The outermost element carrying the layer is the portal's direct child,
    // i.e. the positioner, not something nested inside it.
    expect(positioned?.parentElement?.closest('[role="dialog"]')).toBeNull()
  })

  it('opens the native picker from the field itself, not just its icon', async () => {
    // The small-screen branch also renders in a narrow desktop window, where
    // a native date input still only opens from the calendar icon at its edge.
    await openChooser()
    const showPicker = vi.fn()
    const field = screen.getByLabelText(/due date/i, { selector: 'input' }) as HTMLInputElement
    field.showPicker = showPicker
    fireEvent.click(field)

    expect(showPicker).toHaveBeenCalled()
  })

  it('still accepts a typed date where showPicker is unsupported', async () => {
    await openChooser()
    const field = screen.getByLabelText(/due date/i, { selector: 'input' }) as HTMLInputElement
    field.showPicker = () => {
      throw new Error('unsupported')
    }
    fireEvent.click(field)
    fireEvent.change(field, { target: { value: '2026-09-15' } })

    expect(field.value).toBe('2026-09-15')
  })
})

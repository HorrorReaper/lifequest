'use client'

import { useState } from 'react'
import { CalendarDays, Flag, ListTodo } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { DatePicker } from '@/components/ui/date-picker'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import type {
  ManagedTask,
  TaskPriority,
} from '@/lib/tasks'

interface TaskEditorDialogProps {
  open: boolean
  task: ManagedTask | null
  saving: boolean
  error: string | null
  onOpenChange: (open: boolean) => void
  onSubmit: (draft: TaskEditorDraft) => Promise<void>
}

export interface TaskEditorDraft {
  title: string
  description: string
  due_date: string | null
  priority: TaskPriority
}

const priorities: Array<{
  value: TaskPriority
  label: string
  description: string
  activeClass: string
}> = [
  {
    value: 'high',
    label: 'High',
    description: 'Needs attention first',
    activeClass:
      'border-red-500/60 bg-red-500/10 text-red-700 dark:text-red-300',
  },
  {
    value: 'medium',
    label: 'Medium',
    description: 'Normal priority',
    activeClass:
      'border-amber-500/60 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  },
  {
    value: 'low',
    label: 'Low',
    description: 'Can wait',
    activeClass:
      'border-blue-500/60 bg-blue-500/10 text-blue-700 dark:text-blue-300',
  },
]

function initialDraft(task: ManagedTask | null): TaskEditorDraft {
  return {
    title: task?.title ?? '',
    description: task?.description ?? '',
    due_date: task?.due_date ?? '',
    priority: task?.priority ?? 'medium',
  }
}

export function TaskEditorDialog({
  open,
  task,
  saving,
  error,
  onOpenChange,
  onSubmit,
}: TaskEditorDialogProps) {
  const [draft, setDraft] = useState<TaskEditorDraft>(() =>
    initialDraft(task)
  )
  const [titleError, setTitleError] = useState<string | null>(null)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!draft.title.trim()) {
      setTitleError('Give this task a clear title.')
      return
    }

    setTitleError(null)
    await onSubmit({
      ...draft,
      title: draft.title.trim(),
      description: draft.description.trim(),
      due_date: draft.due_date || null,
    })
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !saving && onOpenChange(nextOpen)}>
      <DialogContent
        className="inset-x-0 top-0 left-0 flex h-[100svh] max-h-none max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-none p-0 sm:top-1/2 sm:left-1/2 sm:h-auto sm:max-h-[88svh] sm:max-w-xl sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl"
        showCloseButton={!saving}
      >
        <DialogHeader className="border-b px-5 py-5 pr-14 sm:px-6">
          <div className="flex items-center gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <ListTodo className="size-5" />
            </span>
            <div className="min-w-0">
              <DialogTitle className="text-xl">
                {task ? 'Edit task' : 'Create a task'}
              </DialogTitle>
              <DialogDescription className="mt-1">
                Capture the outcome, urgency, and the day it belongs to.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form
          id="task-editor-form"
          onSubmit={handleSubmit}
          className="min-h-0 flex-1 overflow-y-auto"
        >
          <div className="space-y-6 px-5 py-6 pb-28 sm:px-6 sm:pb-6">
            <div className="space-y-2">
              <Label htmlFor="task-title">Task</Label>
              <Input
                id="task-title"
                value={draft.title}
                onChange={(event) => {
                  setDraft((current) => ({
                    ...current,
                    title: event.target.value,
                  }))
                  if (titleError) setTitleError(null)
                }}
                placeholder="What needs to be done?"
                autoFocus
                disabled={saving}
                aria-invalid={Boolean(titleError)}
                aria-describedby={titleError ? 'task-title-error' : undefined}
                className="h-12 text-base sm:h-10"
              />
              {titleError && (
                <p id="task-title-error" className="text-sm text-destructive">
                  {titleError}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="task-description">Description</Label>
              <Textarea
                id="task-description"
                value={draft.description}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
                placeholder="Add context, a next step, or a definition of done…"
                rows={5}
                disabled={saving}
                className="min-h-28 resize-y"
              />
            </div>

            <fieldset className="space-y-3">
              <legend className="flex items-center gap-2 text-sm font-medium">
                <Flag className="size-4 text-muted-foreground" />
                Priority
              </legend>
              <div className="grid gap-2 sm:grid-cols-3">
                {priorities.map((priority) => (
                  <button
                    key={priority.value}
                    type="button"
                    onClick={() =>
                      setDraft((current) => ({
                        ...current,
                        priority: priority.value,
                      }))
                    }
                    disabled={saving}
                    aria-pressed={draft.priority === priority.value}
                    className={cn(
                      'min-h-16 rounded-2xl border bg-background px-3 py-2 text-left transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50',
                      draft.priority === priority.value &&
                        priority.activeClass
                    )}
                  >
                    <span className="block text-sm font-semibold">
                      {priority.label}
                    </span>
                    <span className="mt-0.5 block text-xs opacity-75">
                      {priority.description}
                    </span>
                  </button>
                ))}
              </div>
            </fieldset>

            <div className="space-y-2">
              <Label
                htmlFor="task-due-date"
                className="flex items-center gap-2"
              >
                <CalendarDays className="size-4 text-muted-foreground" />
                Due date
              </Label>
              <DatePicker
                id="task-due-date"
                value={draft.due_date || null}
                onChange={(due_date) =>
                  setDraft((current) => ({ ...current, due_date: due_date ?? '' }))
                }
                disabled={saving}
              />
              <p className="text-xs text-muted-foreground">
                Leave this empty to keep it in No Date.
              </p>
            </div>

            {error && (
              <div
                role="alert"
                className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
              >
                {error}
              </div>
            )}
          </div>
        </form>

        <DialogFooter className="fixed inset-x-0 bottom-0 z-10 mx-0 mb-0 rounded-none border-t bg-background/95 px-5 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))] backdrop-blur sm:static sm:mx-0 sm:mb-0 sm:rounded-none sm:px-6 sm:pb-4">
          <Button
            type="button"
            variant="outline"
            className="h-12 sm:h-10"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            form="task-editor-form"
            className="h-12 sm:h-10"
            disabled={saving || !draft.title.trim()}
          >
            {saving
              ? 'Saving…'
              : error
                ? 'Retry save'
                : task
                  ? 'Save changes'
                  : 'Create task'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

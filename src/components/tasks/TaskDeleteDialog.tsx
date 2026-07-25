'use client'

import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { ManagedTask } from '@/lib/tasks'

interface TaskDeleteDialogProps {
  task: ManagedTask | null
  deleting: boolean
  onCancel: () => void
  onConfirm: () => void
}

export function TaskDeleteDialog({
  task,
  deleting,
  onCancel,
  onConfirm,
}: TaskDeleteDialogProps) {
  return (
    <Dialog open={Boolean(task)} onOpenChange={(open) => !open && !deleting && onCancel()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <span className="mb-2 flex size-11 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
            <AlertTriangle className="size-5" />
          </span>
          <DialogTitle>Delete this task?</DialogTitle>
          <DialogDescription>
            {task ? (
              <>
                <span className="font-medium text-foreground">{task.title}</span>{' '}
                will be permanently removed.
              </>
            ) : (
              'This task will be permanently removed.'
            )}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={deleting}>
            Keep task
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={deleting}>
            {deleting ? 'Deleting…' : 'Delete'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

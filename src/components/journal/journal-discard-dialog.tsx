'use client'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface JournalDiscardDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onDiscard: () => void
}

export function JournalDiscardDialog({
  open,
  onOpenChange,
  onDiscard,
}: JournalDiscardDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Keep this reflection?</DialogTitle>
          <DialogDescription>
            Your answers are saved in this tab. Continue writing or discard the draft and
            leave.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="destructive" onClick={onDiscard}>
            Discard draft
          </Button>
          <Button type="button" onClick={() => onOpenChange(false)}>
            Continue reflection
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

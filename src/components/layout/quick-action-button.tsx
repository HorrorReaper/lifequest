'use client'

import Link from 'next/link'
import { useState } from 'react'
import { CalendarClock, Flame, ListTodo, NotebookPen, Plus, Sparkles, Target } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

const QUICK_ACTIONS = [
  {
    href: '/journal',
    title: 'Journal',
    description: 'Start a reflection or daily check-in.',
    icon: NotebookPen,
  },
  {
    href: '/dashboard?quick=task',
    title: 'Task',
    description: 'Capture something that needs doing.',
    icon: ListTodo,
  },
  {
    href: '/dashboard?quick=plan',
    title: 'Plan Block',
    description: 'Add structure to today.',
    icon: CalendarClock,
  },
  {
    href: '/dashboard?quick=habit',
    title: 'Habit',
    description: 'Add a small action to repeat.',
    icon: Flame,
  },
  {
    href: '/dashboard?quick=routine',
    title: 'Routine',
    description: 'Run a guided chain of habits.',
    icon: Sparkles,
  },
  {
    href: '/dashboard?quick=goal',
    title: 'Goal',
    description: 'Set a direction for your quests.',
    icon: Target,
  },
]

export function QuickActionButton() {
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            aria-label="Open quick actions"
            className="relative -top-5 mx-auto flex size-14 rounded-full border-4 border-background p-0 shadow-[0_16px_40px_rgba(0,0,0,0.22)] hover:scale-105 sm:size-14 sm:p-0 white-mode:shadow-[0_12px_30px_rgba(68,64,60,0.14)]"
          />
        }
      >
        <Plus className="size-7" />
      </DialogTrigger>

      <DialogContent className="bottom-0 top-auto max-w-none translate-y-0 rounded-b-none rounded-t-3xl p-5 pb-[calc(1.25rem+var(--safe-area-bottom))] sm:bottom-auto sm:top-1/2 sm:max-w-sm sm:-translate-y-1/2 sm:rounded-xl sm:pb-5">
        <DialogHeader>
          <DialogTitle>Quick actions</DialogTitle>
          <DialogDescription>
            Capture what you need without breaking flow.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-2">
          {QUICK_ACTIONS.map((action) => {
            const Icon = action.icon

            return (
              <Link
                key={action.href}
                href={action.href}
                onClick={() => setOpen(false)}
                className={cn(
                  'flex items-center gap-3 rounded-xl border bg-background p-3 text-left transition-colors',
                  'hover:border-primary/40 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50'
                )}
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Icon className="size-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold">{action.title}</span>
                  <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
                    {action.description}
                  </span>
                </span>
              </Link>
            )
          })}
        </div>
      </DialogContent>
    </Dialog>
  )
}

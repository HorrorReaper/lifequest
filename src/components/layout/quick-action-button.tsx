'use client'

import Link from 'next/link'
import { useState } from 'react'
import { BookOpen, CalendarClock, Flame, ListTodo, NotebookPen, Plus, Sparkles, Trophy, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogPortal,
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
    href: '/learn',
    title: 'Learn',
    description: 'Open lessons, habits, and ideas.',
    icon: BookOpen,
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
    href: '/quests',
    title: 'Quests',
    description: 'Open active quests and challenges.',
    icon: Trophy,
  },
]

export function QuickActionButton({ isAdmin = false }: { isAdmin?: boolean }) {
  const [open, setOpen] = useState(false)
  const TriggerIcon = open ? X : Plus
  const visibleActions = QUICK_ACTIONS.filter(
    (action) => action.href !== '/dashboard?quick=routine' || isAdmin
  )

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            aria-label={open ? 'Close quick actions' : 'Open quick actions'}
            aria-expanded={open}
            className="relative -top-5 mx-auto flex size-14 rounded-full border-4 border-background p-0 shadow-[0_16px_40px_rgba(0,0,0,0.22)] transition-transform hover:scale-105 sm:size-14 sm:p-0 white-mode:shadow-[0_12px_30px_rgba(68,64,60,0.14)]"
          />
        }
      >
        <TriggerIcon className="size-7" />
      </DialogTrigger>

      <DialogContent
        showCloseButton={false}
        className="bottom-[calc(var(--bottom-nav-height)+var(--safe-area-bottom)+0.85rem)] top-auto max-h-[72svh] max-w-[calc(100%-2rem)] translate-y-0 overflow-y-auto rounded-2xl p-4 shadow-[0_20px_70px_rgba(0,0,0,0.22)] sm:bottom-[calc(var(--bottom-nav-height)+1rem)] sm:max-w-sm sm:rounded-2xl white-mode:shadow-[0_18px_48px_rgba(68,64,60,0.16)]"
      >
        <DialogHeader className="gap-1">
          <DialogTitle>Quick actions</DialogTitle>
          <DialogDescription className="text-xs">
            Capture what you need without breaking flow.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-2">
          {visibleActions.map((action) => {
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

      {open && (
        <DialogPortal>
          <DialogClose
            render={
              <Button
                aria-label="Close quick actions"
                className="fixed bottom-[calc(var(--safe-area-bottom)+1.75rem)] left-1/2 z-[70] flex size-14 -translate-x-1/2 rounded-full border-4 border-background p-0 shadow-[0_16px_40px_rgba(0,0,0,0.22)] transition-transform hover:scale-105 sm:size-14 sm:p-0 white-mode:shadow-[0_12px_30px_rgba(68,64,60,0.14)]"
              />
            }
          >
            <X className="size-7" />
          </DialogClose>
        </DialogPortal>
      )}
    </Dialog>
  )
}

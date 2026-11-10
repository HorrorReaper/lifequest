'use client'

import { useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { Check, Loader2, MessageSquare } from 'lucide-react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import {
  FEEDBACK_CATEGORIES,
  FEEDBACK_MAX_LENGTH,
  sendFeedback,
  type FeedbackCategory,
} from '@/lib/feedback'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

interface FeedbackDialogProps {
  /** How the trigger looks; the dialog is the same everywhere. */
  variant?: 'button' | 'link'
  className?: string
}

/**
 * "Send feedback": a short message to the team, from wherever the user is.
 *
 * Kept deliberately small -- a kind and a sentence or two -- so reporting a
 * problem costs less than giving up on it. The text stays in the form if
 * sending fails, and the button is locked while a send is running.
 */
export function FeedbackDialog({ variant = 'button', className }: FeedbackDialogProps) {
  const pathname = usePathname()
  const [supabase] = useState(() => createClient())
  const [open, setOpen] = useState(false)
  const [category, setCategory] = useState<FeedbackCategory>('problem')
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const busy = useRef(false)

  function reset() {
    setCategory('problem')
    setMessage('')
    setSent(false)
    setError(null)
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!message.trim()) {
      setError('Write a short message first.')
      return
    }
    if (busy.current) return
    busy.current = true
    setSending(true)
    setError(null)
    try {
      await sendFeedback(supabase as unknown as SupabaseClient, {
        category,
        message,
        pagePath: pathname,
      })
      setSent(true)
      setMessage('')
    } catch {
      setError('Your feedback was not sent. Your text is still here; try again in a moment.')
    } finally {
      busy.current = false
      setSending(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (sending) return
        setOpen(next)
        if (!next) reset()
      }}
    >
      <DialogTrigger
        render={
          variant === 'link' ? (
            <button
              type="button"
              className={cn(
                'inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-primary underline underline-offset-4',
                className
              )}
            />
          ) : (
            <Button variant="outline" className={cn('h-11', className)} />
          )
        }
      >
        <MessageSquare className="size-4" />
        Send feedback
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Send feedback</DialogTitle>
          <DialogDescription>
            What got in your way, or what would help? Only the LifeQuest team reads this.
          </DialogDescription>
        </DialogHeader>

        {sent ? (
          <div role="status" className="flex items-start gap-3 rounded-xl bg-primary/10 p-4">
            <Check className="mt-0.5 size-5 shrink-0 text-primary" />
            <p className="text-base">Thank you. Your feedback was sent.</p>
          </div>
        ) : (
          <form id="feedback-form" onSubmit={submit} className="space-y-4">
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">What is it about?</legend>
              <div className="grid gap-2">
                {FEEDBACK_CATEGORIES.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={category === option.value}
                    onClick={() => setCategory(option.value)}
                    className={cn(
                      'min-h-11 rounded-xl border px-3 text-left text-base transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
                      category === option.value
                        ? 'border-primary bg-primary/10 font-medium ring-1 ring-primary/30'
                        : 'hover:bg-muted/60'
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </fieldset>
            <div className="space-y-2">
              <Label htmlFor="feedback-message">Your message</Label>
              <Textarea
                id="feedback-message"
                value={message}
                onChange={(event) => {
                  setMessage(event.target.value)
                  if (error) setError(null)
                }}
                rows={5}
                maxLength={FEEDBACK_MAX_LENGTH}
                placeholder="For example: I could not find where to change my plan."
                aria-invalid={Boolean(error) || undefined}
                aria-describedby={error ? 'feedback-error' : undefined}
                className="text-base"
              />
              {error && (
                <p id="feedback-error" role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              )}
            </div>
          </form>
        )}

        <DialogFooter>
          {sent ? (
            <Button type="button" onClick={() => setOpen(false)} className="h-11">
              Close
            </Button>
          ) : (
            <Button
              type="submit"
              form="feedback-form"
              disabled={sending || !message.trim()}
              className="h-11"
            >
              {sending && <Loader2 className="size-4 animate-spin" />}
              {sending ? 'Sending…' : 'Send feedback'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

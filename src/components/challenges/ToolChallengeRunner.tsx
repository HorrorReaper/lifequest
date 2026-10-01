'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowRight, Check, Flame, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { syncChallengeProgress } from '@/lib/challenge-programs'
import { getToolManifest } from '@/lib/tools/registry'
import type { ToolEntry } from '@/lib/tools/storage'

/** The parts of ChallengeContext this needs; a plain object, so it crosses to the client. */
export interface ToolChallengeContext {
  templateId: string
  enrollmentId: string
  title: string
  dayNumber: number
  totalDays: number
}

type Status = 'idle' | 'checking' | 'completed' | 'saved'

/**
 * A toolbox tool opened from a challenge day. Says which step it belongs to
 * and, once the tool saves, runs the challenge sync right away so the user
 * learns the day is done and has a way back, instead of being left in the
 * toolbox.
 */
export function ToolChallengeRunner({
  toolId,
  userId,
  initialEntries,
  challenge,
}: {
  toolId: string
  userId: string
  initialEntries: ToolEntry[]
  challenge: ToolChallengeContext
}) {
  const [status, setStatus] = useState<Status>('idle')
  const manifest = getToolManifest(toolId)
  if (!manifest) return null
  const Tool = manifest.Component
  const backHref = `/challenges/${challenge.templateId}`

  async function handleUsed() {
    setStatus('checking')
    const rows = await syncChallengeProgress(createClient())
    const row = rows.find((item) => item.enrollment_id === challenge.enrollmentId)
    setStatus(row?.completed_now ? 'completed' : 'saved')
  }

  return (
    <div className="space-y-5">
      <div
        className="flex flex-wrap items-center gap-3 rounded-2xl border border-primary/30 bg-primary/5 p-4"
        role="status"
        aria-live="polite"
      >
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
          {status === 'completed' ? <Check className="size-4" /> : status === 'checking' ? <Loader2 className="size-4 animate-spin" /> : <Flame className="size-4" />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted-foreground">
            {challenge.title} · Day {challenge.dayNumber} of {challenge.totalDays}
          </p>
          <p className="text-sm font-medium">
            {status === 'completed'
              ? `Day ${challenge.dayNumber} is done.`
              : status === 'saved'
                ? 'Saved.'
                : status === 'checking'
                  ? 'Saving…'
                  : 'Save here to complete today’s step.'}
          </p>
        </div>
        {(status === 'completed' || status === 'saved') && (
          <Button asChild size="sm">
            <Link href={backHref}>
              Back to the challenge
              <ArrowRight />
            </Link>
          </Button>
        )}
      </div>

      <Tool userId={userId} initialEntries={initialEntries} onUsed={() => void handleUsed()} />
    </div>
  )
}

'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Compass, Loader2, RefreshCw, Sparkles, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { createClient } from '@/lib/supabase/client'
import { supabaseUpdateWhere } from '@/lib/supabase/helpers'
import { useUserStore } from '@/lib/stores/user-store'

interface AdminTestingToolsProps {
  userId: string
  /** Current onboarding_complete value on this admin's own profile row. */
  onboardingComplete: boolean
}

function OnboardingSimulation({ userId, onboardingComplete }: AdminTestingToolsProps) {
  const router = useRouter()
  const supabase = createClient()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function setOnboardingComplete(value: boolean) {
    setBusy(true)
    setError(null)

    const { error: updateError } = await supabaseUpdateWhere(
      supabase,
      'profiles',
      { onboarding_complete: value, updated_at: new Date().toISOString() },
      'id',
      userId
    )

    setBusy(false)

    if (updateError) {
      setError('Could not update your profile. Please try again.')
      return
    }

    if (!value) {
      router.push('/onboarding')
    } else {
      setConfirmOpen(false)
      router.push('/dashboard')
      router.refresh()
    }
  }

  return (
    <section className="rounded-2xl border bg-card p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Compass className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold">Onboarding simulation</h2>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            Walk through the real first-run flow on your own account. This temporarily clears your
            profile&apos;s onboarding status, so every authenticated route redirects to /onboarding
            until you finish it or restore your status below.
          </p>
        </div>
      </div>

      {onboardingComplete ? (
        <Button type="button" className="mt-4" onClick={() => setConfirmOpen(true)}>
          <Compass className="size-4" />
          Simulate onboarding
        </Button>
      ) : (
        <div className="mt-4 space-y-3">
          <p className="rounded-xl bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
            Your account is currently mid-simulation: onboarding_complete is false. Finish the flow
            normally, or restore your status here without completing it.
          </p>
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => void setOnboardingComplete(true)}
          >
            {busy && <Loader2 className="size-4 animate-spin" />}
            Restore completed status
          </Button>
        </div>
      )}

      {error && <p className="mt-3 text-xs text-destructive">{error}</p>}

      <Dialog open={confirmOpen} onOpenChange={(open) => !busy && setConfirmOpen(open)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Simulate the onboarding flow?</DialogTitle>
            <DialogDescription>
              This sets <code>onboarding_complete</code> to false on your own profile and sends you
              to /onboarding right now. Until you complete it (or come back here to restore your
              status), every other page in the app will redirect you back to onboarding.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setConfirmOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void setOnboardingComplete(false)} disabled={busy}>
              {busy && <Loader2 className="size-4 animate-spin" />}
              Start simulation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}

export function AdminTestingTools({ userId, onboardingComplete }: AdminTestingToolsProps) {
  const router = useRouter()
  const addXp = useUserStore((state) => state.addXp)
  const notifyLevelUp = useUserStore((state) => state.notifyLevelUp)
  const clearLevelUp = useUserStore((state) => state.clearLevelUp)
  const totalXp = useUserStore((state) => state.totalXp)
  const level = useUserStore((state) => state.level)

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border bg-card p-4 shadow-sm">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Sparkles className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold">Animation and store tests</h2>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              These controls only affect the current browser session unless the underlying feature saves data.
            </p>
          </div>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <Button type="button" onClick={() => addXp(250)}>
            <Zap className="size-4" />
            Add 250 local XP
          </Button>
          <Button type="button" variant="outline" onClick={() => addXp(10000)}>
            Trigger XP level-up
          </Button>
          <Button type="button" variant="outline" onClick={() => notifyLevelUp(level + 1)}>
            Show next-level overlay
          </Button>
          <Button type="button" variant="outline" onClick={() => notifyLevelUp(10)}>
            Show level 10 overlay
          </Button>
          <Button type="button" variant="secondary" onClick={clearLevelUp}>
            Clear overlay state
          </Button>
          <Button type="button" variant="secondary" onClick={() => router.refresh()}>
            <RefreshCw className="size-4" />
            Refresh server data
          </Button>
        </div>

        <p className="mt-4 rounded-xl bg-muted px-3 py-2 text-xs text-muted-foreground">
          Current client store: level {level}, {totalXp} XP.
        </p>
      </section>

      <OnboardingSimulation userId={userId} onboardingComplete={onboardingComplete} />

      <section className="rounded-2xl border bg-card p-4 shadow-sm">
        <h2 className="text-base font-semibold">QA shortcuts</h2>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
          Fast jumps to flows that are useful during MVP testing.
        </p>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <Button asChild variant="outline">
            <Link href="/dashboard">Dashboard</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/journal">Journal</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/settings">Settings and routines</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/learn">Learn</Link>
          </Button>
        </div>
      </section>
    </div>
  )
}

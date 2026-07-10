'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { RefreshCw, Sparkles, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useUserStore } from '@/lib/stores/user-store'

export function AdminTestingTools() {
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
            <Link href="/onboarding">Onboarding route</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/learn">Learn</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/city">City</Link>
          </Button>
        </div>
      </section>
    </div>
  )
}

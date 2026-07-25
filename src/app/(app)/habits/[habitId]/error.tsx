'use client'

import Link from 'next/link'
import { AlertCircle, ArrowLeft, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function HabitAnalyticsError({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <main className="grid min-h-svh place-items-center bg-background p-4 pb-24">
      <div className="w-full max-w-md rounded-2xl border bg-card p-6 text-center">
        <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-destructive/10 text-destructive">
          <AlertCircle className="size-5" />
        </span>
        <h1 className="mt-4 font-heading text-xl font-semibold">
          Analytics could not load
        </h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Your habit data is unchanged. Retry the request or return to your habits.
        </p>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          <Button variant="outline" className="flex-1" asChild>
            <Link href="/habits">
              <ArrowLeft className="size-3.5" />
              Habits
            </Link>
          </Button>
          <Button className="flex-1" onClick={reset}>
            <RefreshCw className="size-3.5" />
            Try again
          </Button>
        </div>
      </div>
    </main>
  )
}

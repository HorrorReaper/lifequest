'use client'

import Link from 'next/link'
import { AlertTriangle, Home, RefreshCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function AppError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="flex min-h-[70svh] items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md rounded-3xl border bg-card p-6 text-center shadow-sm sm:p-8">
        <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
          <AlertTriangle className="size-6" />
        </span>
        <h1 className="mt-5 text-2xl font-semibold tracking-tight">This page could not load</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Your data was not changed. Try loading the page again, or return to the dashboard.
        </p>
        <div className="mt-6 grid gap-2 sm:grid-cols-2">
          <Button onClick={reset}>
            <RefreshCcw className="size-4" />
            Try again
          </Button>
          <Button asChild variant="outline">
            <Link href="/dashboard">
              <Home className="size-4" />
              Dashboard
            </Link>
          </Button>
        </div>
      </div>
    </main>
  )
}

'use client'

import { TrendingUp } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface MetricEmptyStateProps {
  onCreate: () => void
}

/** Shown where metrics would be listed while the user has none. */
export function MetricEmptyState({ onCreate }: MetricEmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed p-8 text-center">
      <span className="grid size-12 place-items-center rounded-xl bg-primary/10 text-primary">
        <TrendingUp className="size-6" />
      </span>
      <div className="space-y-1.5">
        <h3 className="text-lg font-semibold">Track a number over time</h3>
        <p className="mx-auto max-w-sm text-sm text-muted-foreground">
          Weight, steps, sleep, revenue — anything you can count. Log it in a tap, see the trend,
          set a target.
        </p>
      </div>
      <Button type="button" onClick={onCreate}>
        Create your first metric
      </Button>
    </div>
  )
}

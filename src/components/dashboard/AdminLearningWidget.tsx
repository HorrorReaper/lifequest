'use client'

import Link from 'next/link'
import { useState } from 'react'
import { ArrowUpRight, BookOpenCheck, RefreshCw, Star } from 'lucide-react'
import type { DashboardLearning } from '@/lib/dashboard-learnings'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

interface AdminLearningWidgetProps {
  learnings: DashboardLearning[]
  dailyKey: string
}

function stableHash(value: string) {
  let hash = 0

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) | 0
  }

  return Math.abs(hash)
}

function orderLearnings(learnings: DashboardLearning[], dailyKey: string) {
  return [...learnings].sort((first, second) => {
    if (first.isFavorite !== second.isFavorite) return first.isFavorite ? -1 : 1

    return (
      stableHash(`${dailyKey}:${first.id}`) -
      stableHash(`${dailyKey}:${second.id}`)
    )
  })
}

function formatEntryDate(date: string) {
  return new Date(`${date.slice(0, 10)}T12:00:00`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function AdminLearningWidget({
  learnings,
  dailyKey,
}: AdminLearningWidgetProps) {
  const orderedLearnings = orderLearnings(learnings, dailyKey)
  const [activeIndex, setActiveIndex] = useState(0)
  const learning = orderedLearnings[activeIndex % Math.max(orderedLearnings.length, 1)]

  if (!learning) {
    return (
      <Card className="bg-card">
        <CardContent className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
            <BookOpenCheck className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">A learning for today</p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              Mark an answer as a learning during your next reflection and it will resurface here.
            </p>
            <Button asChild variant="outline" size="sm" className="mt-3">
              <Link href="/journal">Open journal</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="relative bg-card">
      <div className="pointer-events-none absolute -right-8 -top-10 size-32 rounded-full bg-primary/8 blur-3xl" />
      <CardContent className="relative space-y-4" aria-live="polite">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
              <BookOpenCheck className="size-4" />
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Learning resurfaced
              </p>
              <p className="mt-0.5 text-sm font-semibold">Worth remembering today</p>
            </div>
          </div>
          {learning.isFavorite && (
            <span
              className="grid size-8 shrink-0 place-items-center rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-300"
              aria-label="Favorite learning"
            >
              <Star className="size-3.5 fill-current" />
            </span>
          )}
        </div>

        <blockquote className="line-clamp-5 text-balance font-heading text-lg font-medium leading-7 tracking-tight">
          &ldquo;{learning.answer}&rdquo;
        </blockquote>

        {learning.prompt && (
          <p className="text-xs leading-5 text-muted-foreground">
            From: {learning.prompt}
          </p>
        )}

        {learning.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {learning.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-muted px-2.5 py-1 text-[0.7rem] font-medium text-muted-foreground"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-3">
          <p className="text-xs text-muted-foreground">
            {learning.templateIcon && <>{learning.templateIcon} </>}
            {learning.templateName ?? 'Journal'} &middot;{' '}
            {formatEntryDate(learning.entryDate)}
          </p>
          <div className="flex gap-2">
            {orderedLearnings.length > 1 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setActiveIndex((current) => current + 1)}
              >
                <RefreshCw className="size-3.5" />
                Another
              </Button>
            )}
            <Button asChild variant="outline" size="sm">
              <Link href={`/journal/${learning.entryId}`}>
                Open reflection
                <ArrowUpRight className="size-3.5" />
              </Link>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { Card, CardContent } from '@/components/ui/card'
import { JournalEntry, JournalResponse } from '@/lib/types'
import { ArrowRight, BookOpenText } from 'lucide-react'

interface EntryTimelineProps {
  entries: JournalEntry[]
}

function valueJsonPreview(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null

  const candidate = value as {
    title?: unknown
    note?: unknown
    action_text?: unknown
  }
  const parts = [candidate.title, candidate.note, candidate.action_text]
    .filter((part): part is string => typeof part === 'string' && part.trim().length > 0)
    .map((part) => part.trim())

  return parts[0] ?? null
}

function responsePreview(response: JournalResponse) {
  if (response.value_text?.trim()) return response.value_text.trim()
  return valueJsonPreview(response.value_json)
}

function entryPreview(entry: JournalEntry) {
  return [...(entry.journal_responses ?? [])]
    .sort((a, b) => (a.template_fields?.sort_order ?? 0) - (b.template_fields?.sort_order ?? 0))
    .map(responsePreview)
    .find((preview): preview is string => Boolean(preview))
}

export function EntryTimeline({ entries }: EntryTimelineProps) {
  if (entries.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border/60 bg-card/50 p-8 text-center">
        <BookOpenText className="mx-auto mb-3 size-8 text-muted-foreground" />
        <p className="text-sm font-medium">No reflections saved yet</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Start with today&apos;s reflection and this space will become your memory trail.
        </p>
      </div>
    )
  }

  return (
    <div className="grid gap-3">
      {entries.map((entry, index) => {
        const template = entry.journal_templates
        const date = new Date(entry.entry_date)
        const preview = entryPreview(entry)

        return (
          <motion.div
            key={entry.id}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.03 }}
          >
            <Link
              href={`/journal/${entry.id}`}
              className="block rounded-xl focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <Card className="border-border/60 bg-card/80 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/25 hover:bg-card">
                <CardContent className="flex items-start gap-3 p-4">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-muted text-xl">
                  {template?.icon ?? '📓'}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-semibold">
                      {template?.name ?? 'Journal Entry'}
                    </p>
                    {entry.xp_earned > 0 && (
                      <span className="rounded-full bg-primary/8 px-2 py-0.5 text-[10px] font-medium text-primary">
                        +{entry.xp_earned} XP
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {date.toLocaleDateString('en-US', {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </p>
                  <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted-foreground">
                    {preview ?? 'A quiet reflection saved for this day.'}
                  </p>
                </div>
                <ArrowRight className="mt-1 size-4 shrink-0 text-muted-foreground" />
                </CardContent>
              </Card>
            </Link>
          </motion.div>
        )
      })}
    </div>
  )
}

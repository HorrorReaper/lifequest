'use client'

import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Card, CardContent } from '@/components/ui/card'
import { JournalEntry } from '@/lib/types'

interface EntryTimelineProps {
  entries: JournalEntry[]
}

export function EntryTimeline({ entries }: EntryTimelineProps) {
  const router = useRouter()

  if (entries.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border/50 p-8 text-center">
        <p className="text-3xl mb-2">📝</p>
        <p className="text-sm text-muted-foreground">
          No entries yet. Pick a template above to start!
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {entries.map((entry, index) => {
        const template = entry.journal_templates
        const date = new Date(entry.entry_date)

        return (
          <motion.div
            key={entry.id}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.03 }}
          >
            <Card
              className="cursor-pointer border-border/50 transition-all hover:border-primary/30 hover:bg-muted/30"
              onClick={() => router.push(`/journal/${entry.id}`)}
            >
              <CardContent className="flex items-center gap-3 p-3">
                <span className="text-xl">{template?.icon ?? '📓'}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {template?.name ?? 'Journal Entry'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {date.toLocaleDateString('en-US', {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </p>
                </div>
                {entry.xp_earned > 0 && (
                  <span className="text-xs font-medium text-primary">
                    +{entry.xp_earned} XP
                  </span>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )
      })}
    </div>
  )
}

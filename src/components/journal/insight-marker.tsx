'use client'

import { useState } from 'react'
import {
  BookmarkPlus,
  BookOpenCheck,
  CheckCircle2,
  CircleAlert,
  Lightbulb,
  Tag,
} from 'lucide-react'
import type { InsightType } from '@/lib/types'
import { INSIGHT_TYPES, insightTypeLabel, normalizeInsightTags } from '@/lib/insights'
import { Badge } from '@/components/ui/badge'
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
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

const TYPE_ICONS = {
  learning: BookOpenCheck,
  problem: CircleAlert,
  idea: Lightbulb,
  decision: CheckCircle2,
} satisfies Record<InsightType, typeof BookOpenCheck>

const TYPE_STYLES = {
  learning: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  problem: 'border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  idea: 'border-sky-500/25 bg-sky-500/10 text-sky-700 dark:text-sky-300',
  decision: 'border-primary/25 bg-primary/10 text-primary',
} satisfies Record<InsightType, string>

interface InsightMarkerProps {
  insightType: InsightType | null
  topicTags: string[]
  markedAt: string | null
  suggestedTags?: string[]
  disabled?: boolean
  onChange: (value: {
    insightType: InsightType | null
    topicTags: string[]
    markedAt: string | null
  }) => void
}

export function InsightMarker({
  insightType,
  topicTags,
  markedAt,
  suggestedTags = [],
  disabled = false,
  onChange,
}: InsightMarkerProps) {
  const [open, setOpen] = useState(false)
  const [draftType, setDraftType] = useState<InsightType | null>(insightType)
  const [draftTags, setDraftTags] = useState(topicTags.join(', '))

  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen) {
      setDraftType(insightType)
      setDraftTags(topicTags.join(', '))
    }
    setOpen(nextOpen)
  }

  function addSuggestedTag(tag: string) {
    const nextTags = normalizeInsightTags([...normalizeInsightTags(draftTags), tag])
    setDraftTags(nextTags.join(', '))
  }

  function save() {
    if (!draftType) return
    onChange({
      insightType: draftType,
      topicTags: normalizeInsightTags(draftTags),
      markedAt: insightType === draftType && markedAt ? markedAt : new Date().toISOString(),
    })
    setOpen(false)
  }

  function remove() {
    onChange({
      insightType: null,
      topicTags: [],
      markedAt: null,
    })
    setOpen(false)
  }

  const availableSuggestions = suggestedTags
    .filter((tag) => !normalizeInsightTags(draftTags).includes(tag))
    .slice(0, 6)

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <div className="flex flex-wrap items-center gap-2 border-t border-border/50 pt-3">
        <DialogTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={disabled}
              className={cn(
                'h-9 rounded-full px-3 text-xs',
                insightType && TYPE_STYLES[insightType]
              )}
            />
          }
        >
          {insightType ? (
            <>
              {(() => {
                const Icon = TYPE_ICONS[insightType]
                return <Icon className="size-3.5" />
              })()}
              {insightTypeLabel(insightType)}
            </>
          ) : (
            <>
              <BookmarkPlus className="size-3.5" />
              Mark answer
            </>
          )}
        </DialogTrigger>

        {topicTags.map((tag) => (
          <Badge key={tag} variant="secondary" className="font-normal">
            {tag}
          </Badge>
        ))}
      </div>

      <DialogContent className="bottom-0 top-auto max-h-[88svh] max-w-none translate-y-0 overflow-y-auto rounded-b-none rounded-t-3xl p-5 sm:bottom-auto sm:top-1/2 sm:max-w-md sm:-translate-y-1/2 sm:rounded-xl">
        <DialogHeader>
          <DialogTitle>Mark this answer</DialogTitle>
          <DialogDescription>
            Save what this answer represents so you can find it again later.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-2">
          {INSIGHT_TYPES.map((type) => {
            const Icon = TYPE_ICONS[type.value]
            const selected = draftType === type.value

            return (
              <button
                key={type.value}
                type="button"
                aria-pressed={selected}
                onClick={() => setDraftType(type.value)}
                className={cn(
                  'flex min-h-16 items-center gap-3 rounded-2xl border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
                  selected
                    ? TYPE_STYLES[type.value]
                    : 'border-border/60 bg-background hover:border-primary/25 hover:bg-muted/35'
                )}
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-background/80">
                  <Icon className="size-4" />
                </span>
                <span>
                  <span className="block text-sm font-semibold">{type.label}</span>
                  <span className="mt-0.5 block text-xs leading-5 opacity-75">
                    {type.description}
                  </span>
                </span>
              </button>
            )
          })}
        </div>

        <div className="space-y-2">
          <label htmlFor="insight-topic-tags" className="flex items-center gap-1.5 text-sm font-medium">
            <Tag className="size-3.5 text-muted-foreground" />
            Optional topics
          </label>
          <Input
            id="insight-topic-tags"
            value={draftTags}
            onChange={(event) => setDraftTags(event.target.value)}
            placeholder="startup, fitness, relationships"
          />
          <p className="text-xs leading-5 text-muted-foreground">
            Add up to five comma-separated topics.
          </p>
          {availableSuggestions.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {availableSuggestions.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => addSuggestedTag(tag)}
                  className="rounded-full border bg-muted/35 px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:border-primary/25 hover:text-foreground"
                >
                  + {tag}
                </button>
              ))}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          {insightType ? (
            <Button type="button" variant="ghost" onClick={remove} className="text-destructive hover:text-destructive">
              Remove mark
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={save} disabled={!draftType}>
              Save mark
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

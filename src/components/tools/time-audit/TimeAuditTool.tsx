'use client'

import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Eraser, Loader2, Settings2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import {
  createToolEntry,
  fetchToolEntries,
  updateToolEntry,
  type ToolEntry,
} from '@/lib/tools/storage'
import type { ToolProps } from '@/lib/tools/registry'
import { AuditSummary } from './AuditSummary'
import { CategoryEditor } from './CategoryEditor'
import { DayGrid } from './DayGrid'
import {
  addCategory,
  BLOCKS_PER_DAY,
  categoryColor,
  paintRange,
  removeCategory,
  seedCategories,
  shiftDate,
  TIME_AUDIT_TOOL_ID,
  toAuditDays,
  todayDate,
  type CategoryValue,
  type TimeAuditCategory,
  type TimeAuditPayload,
} from './time-audit'

function emptyBlocks(): (string | null)[] {
  return Array.from({ length: BLOCKS_PER_DAY }, () => null)
}

function formatDay(date: string) {
  return new Date(`${date}T12:00:00`).toLocaleDateString('en-US', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
}

/**
 * Builds the day to edit: the stored one if that date was logged before,
 * otherwise a blank day seeded with the most recent palette so a fresh day
 * does not drop back to the defaults and lose the user's own categories.
 */
function draftFor(date: string, days: ToolEntry<TimeAuditPayload>[]): TimeAuditPayload {
  const stored = days.find((entry) => entry.payload.date === date)
  if (stored) return stored.payload

  const newest = [...days].sort((a, b) => b.payload.date.localeCompare(a.payload.date))[0]
  return {
    kind: 'time-audit-day',
    date,
    blocks: emptyBlocks(),
    categories: newest ? newest.payload.categories : seedCategories(),
  }
}

export function TimeAuditTool({ userId, initialEntries, onUsed }: ToolProps) {
  const supabase = useMemo(() => createClient(), [])
  const [days, setDays] = useState(() => toAuditDays(initialEntries))
  const [date, setDate] = useState(() => todayDate())
  const [draft, setDraft] = useState(() => draftFor(todayDate(), toAuditDays(initialEntries)))
  const [brush, setBrush] = useState<string | null | undefined>(() => draft.categories[0]?.id)
  const [editingCategories, setEditingCategories] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function goTo(nextDate: string) {
    setDate(nextDate)
    const next = draftFor(nextDate, days)
    setDraft(next)
    setBrush(next.categories[0]?.id)
    setDirty(false)
    setError(null)
  }

  function paint(from: number, to: number) {
    setDraft((current) => ({ ...current, blocks: paintRange(current.blocks, from, to, brush ?? null) }))
    setDirty(true)
  }

  function updateCategory(id: string, patch: Partial<TimeAuditCategory>) {
    setDraft((current) => ({
      ...current,
      categories: current.categories.map((category) =>
        category.id === id ? { ...category, ...patch } : category
      ),
    }))
    setDirty(true)
  }

  function createCategory(label: string, color: string, value: CategoryValue) {
    setDraft((current) => ({ ...current, categories: addCategory(current.categories, label, color, value) }))
    setDirty(true)
  }

  function dropCategory(id: string) {
    setDraft((current) => removeCategory(current, id))
    if (brush === id) setBrush(undefined)
    setDirty(true)
  }

  async function save() {
    if (saving) return
    setSaving(true)
    setError(null)

    try {
      // tool_entries has no unique constraint on the date — the table is
      // deliberately schema-less — so re-logging a day is resolved here or
      // the day would quietly exist twice.
      const existing = days.find((entry) => entry.payload.date === draft.date)
      if (existing) {
        await updateToolEntry<TimeAuditPayload>(supabase, existing.id, draft)
      } else {
        await createToolEntry<TimeAuditPayload>(supabase, userId, TIME_AUDIT_TOOL_ID, draft)
      }

      const entries = await fetchToolEntries(supabase, userId, TIME_AUDIT_TOOL_ID)
      setDays(toAuditDays(entries))
      setDirty(false)
      onUsed?.()
    } catch {
      // The draft is deliberately left alone: losing an evening of entry to
      // a dropped connection would be the worst thing this tool could do.
      setError('That day could not be saved. Your entries are still here — try again.')
    }

    setSaving(false)
  }

  const painted = draft.blocks.filter(Boolean).length
  const isToday = date === todayDate()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-2">
        <Button type="button" variant="outline" size="icon" aria-label="Previous day" onClick={() => goTo(shiftDate(date, -1))}>
          <ChevronLeft className="size-4" />
        </Button>
        <div className="text-center">
          <p className="text-sm font-semibold">{isToday ? 'Today' : formatDay(date)}</p>
          <p className="text-xs text-muted-foreground">
            {painted} of {BLOCKS_PER_DAY} blocks logged
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label="Next day"
          disabled={isToday}
          onClick={() => goTo(shiftDate(date, 1))}
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>

      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Category brush">
        {draft.categories.map((category) => (
          <button
            key={category.id}
            type="button"
            aria-label={`Brush ${category.label}`}
            aria-pressed={brush === category.id}
            onClick={() => setBrush(category.id)}
            className={cn(
              'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
              brush === category.id ? 'bg-foreground text-background' : 'bg-muted hover:bg-muted-foreground/20'
            )}
          >
            <span className={cn('size-2 rounded-full', categoryColor(category.color).swatch)} />
            {category.label}
          </button>
        ))}
        <button
          type="button"
          aria-label="Brush eraser"
          aria-pressed={brush === null}
          onClick={() => setBrush(null)}
          className={cn(
            'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
            brush === null ? 'bg-foreground text-background' : 'bg-muted hover:bg-muted-foreground/20'
          )}
        >
          <Eraser className="size-3" />
          Erase
        </button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-expanded={editingCategories}
          onClick={() => setEditingCategories((open) => !open)}
        >
          <Settings2 className="size-3.5" />
          Categories
        </Button>
      </div>

      {editingCategories && (
        <div className="rounded-2xl border bg-card p-4">
          <CategoryEditor
            categories={draft.categories}
            onAdd={createCategory}
            onUpdate={updateCategory}
            onRemove={dropCategory}
          />
        </div>
      )}

      <DayGrid blocks={draft.blocks} categories={draft.categories} brush={brush} onPaint={paint} />

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="sticky bottom-4 flex items-center justify-between gap-3 rounded-2xl border bg-background/95 p-3 backdrop-blur">
        <span className="text-xs text-muted-foreground">
          {dirty ? 'Unsaved changes' : 'Everything saved'}
        </span>
        <Button type="button" onClick={() => void save()} disabled={!dirty || saving}>
          {saving && <Loader2 className="size-4 animate-spin" />}
          Save day
        </Button>
      </div>

      <AuditSummary days={days.map((entry) => entry.payload)} today={todayDate()} />
    </div>
  )
}

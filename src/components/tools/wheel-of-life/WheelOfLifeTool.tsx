'use client'

import { useMemo, useState } from 'react'
import { Loader2, PieChart } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { createToolEntry, fetchToolEntries } from '@/lib/tools/storage'
import type { ToolProps } from '@/lib/tools/registry'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import {
  LIFE_AREAS,
  MAX_RATING,
  WHEEL_OF_LIFE_TOOL_ID,
  averageRating,
  compareToBaseline,
  defaultRatings,
  formatDelta,
  lowestArea,
  toWheelSnapshots,
  type LifeAreaId,
  type WheelOfLifePayload,
} from './wheel-of-life'

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

const RATINGS = Array.from({ length: MAX_RATING }, (_, index) => index + 1)

export function WheelOfLifeTool({ userId, initialEntries, onUsed }: ToolProps) {
  const supabase = useMemo(() => createClient(), [])
  const [snapshots, setSnapshots] = useState(() => toWheelSnapshots(initialEntries))
  const [rating, setRating] = useState(false)
  const [ratings, setRatings] = useState<Record<LifeAreaId, number>>(defaultRatings)
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const latest = snapshots[0] ?? null
  const comparison = compareToBaseline(snapshots)
  const focus = lowestArea(comparison)
  const first = snapshots.length > 1 ? snapshots[snapshots.length - 1] : null

  function startRating() {
    setRatings(latest ? { ...latest.payload.ratings } : defaultRatings())
    setNote('')
    setRating(true)
    setError(null)
  }

  async function save() {
    if (saving) return
    setSaving(true)
    setError(null)
    try {
      // A new row per check-in: the history is the point of the tool.
      await createToolEntry<WheelOfLifePayload>(supabase, userId, WHEEL_OF_LIFE_TOOL_ID, {
        ratings,
        note: note.trim(),
      })
      const entries = await fetchToolEntries(supabase, userId, WHEEL_OF_LIFE_TOOL_ID)
      setSnapshots(toWheelSnapshots(entries))
      setRating(false)
      onUsed?.()
    } catch {
      setError('Your ratings could not be saved. Please try again.')
    }
    setSaving(false)
  }

  return (
    <div className="space-y-5">
      {rating ? (
        <div className="space-y-5 rounded-2xl border bg-card p-4">
          <p className="text-sm text-muted-foreground">
            Rate each area as it is today, not as it should be. 1 is “this is hurting”, 10 is “nothing to change”.
          </p>
          {LIFE_AREAS.map((area) => (
            <fieldset key={area.id} className="space-y-2">
              <legend className="text-sm font-semibold">
                {area.label} <span className="font-normal text-muted-foreground">· {area.hint}</span>
              </legend>
              <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={`${area.label} rating`}>
                {RATINGS.map((value) => (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={ratings[area.id] === value}
                    aria-label={`${area.label}: ${value}`}
                    onClick={() => setRatings((current) => ({ ...current, [area.id]: value }))}
                    disabled={saving}
                    className={cn(
                      'grid size-9 place-items-center rounded-lg border text-sm transition-colors',
                      ratings[area.id] === value ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-muted'
                    )}
                  >
                    {value}
                  </button>
                ))}
              </div>
            </fieldset>
          ))}
          <div className="space-y-2">
            <label htmlFor="wheel-note" className="text-sm font-semibold">
              What stands out? <span className="font-normal text-muted-foreground">(optional)</span>
            </label>
            <Textarea
              id="wheel-note"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              maxLength={1000}
              disabled={saving}
              placeholder="The area that would change the most if it moved one point..."
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setRating(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="button" onClick={save} disabled={saving}>
              {saving && <Loader2 className="size-4 animate-spin" />}
              Save ratings
            </Button>
          </div>
        </div>
      ) : latest ? (
        <div className="space-y-4 rounded-2xl border bg-card p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Latest · {formatDate(latest.createdAt)}
              </p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">
                {averageRating(latest.payload.ratings)}
                <span className="text-sm font-normal text-muted-foreground"> / {MAX_RATING} average</span>
              </p>
              {first && (
                <p className="text-xs text-muted-foreground">Compared with your first rating on {formatDate(first.createdAt)}</p>
              )}
            </div>
            <Button type="button" variant="outline" size="sm" onClick={startRating}>
              Rate again
            </Button>
          </div>

          <ul className="space-y-3">
            {comparison.map((area) => (
              <li key={area.id} title={area.baseline === null ? `${area.label}: ${area.current}` : `${area.label}: ${area.current} (was ${area.baseline})`}>
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span>{area.label}</span>
                  <span className="tabular-nums">
                    <span className="font-semibold">{area.current}</span>
                    {area.delta !== null && <span className="ml-2 text-xs text-muted-foreground">{formatDelta(area.delta)}</span>}
                  </span>
                </div>
                <div className="relative mt-1.5 h-2 rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${(area.current / MAX_RATING) * 100}%` }}
                  />
                  {area.baseline !== null && (
                    <span
                      aria-hidden
                      className="absolute -top-0.5 h-3 w-0.5 rounded-full bg-foreground/60"
                      style={{ left: `calc(${(area.baseline / MAX_RATING) * 100}% - 1px)` }}
                    />
                  )}
                </div>
              </li>
            ))}
          </ul>
          {first && <p className="text-xs text-muted-foreground">The thin mark shows where each area started.</p>}
          {focus && (
            <p className="rounded-xl bg-muted/50 p-3 text-sm">
              Most room to grow: <span className="font-semibold">{focus.label}</span>. One small step there is likely to move the most.
            </p>
          )}
          {latest.payload.note && (
            <p className="whitespace-pre-wrap text-sm text-muted-foreground">“{latest.payload.note}”</p>
          )}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed px-5 py-9 text-center">
          <PieChart className="mx-auto size-8 text-muted-foreground/60" />
          <p className="mt-3 text-sm font-medium">No ratings yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Rate five areas of your life from 1 to 10. It takes two minutes and shows where to start.
          </p>
          <Button type="button" className="mt-4" onClick={startRating}>
            Rate your life areas
          </Button>
        </div>
      )}

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      {snapshots.length > 1 && !rating && (
        <details className="rounded-xl border bg-muted/30 p-3">
          <summary className="cursor-pointer text-xs font-medium text-muted-foreground">
            All {snapshots.length} ratings
          </summary>
          <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
            {snapshots.map((snapshot) => (
              <li key={snapshot.id} className="flex justify-between gap-3 tabular-nums">
                <span>{formatDate(snapshot.createdAt)}</span>
                <span>{averageRating(snapshot.payload.ratings)} average</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  )
}

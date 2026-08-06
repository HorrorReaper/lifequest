'use client'

import { useMemo, useState } from 'react'
import { Compass, History, Loader2, PencilLine } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import {
  createToolEntry,
  fetchToolEntries,
  type ToolEntry,
} from '@/lib/tools/storage'
import type { ToolProps } from '@/lib/tools/registry'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

export const VISION_TOOL_ID = 'vision'
const MAX_LENGTH = 2000

export interface VisionPayload {
  statement: string
}

export function isVisionPayload(value: unknown): value is VisionPayload {
  return (
    Boolean(value) &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    typeof (value as VisionPayload).statement === 'string'
  )
}

/**
 * tool_entries is deliberately schema-less so a new tool needs no migration,
 * which means each tool is responsible for validating its own payload shape.
 */
export function toVisionRevisions(entries: ToolEntry[]): ToolEntry<VisionPayload>[] {
  return entries.filter(
    (entry): entry is ToolEntry<VisionPayload> => isVisionPayload(entry.payload)
  )
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export function VisionTool({ userId, initialEntries }: ToolProps) {
  const supabase = useMemo(() => createClient(), [])
  const [revisions, setRevisions] = useState(() => toVisionRevisions(initialEntries))
  const [draft, setDraft] = useState('')
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const current = revisions[0] ?? null
  const previous = revisions.slice(1)

  async function save() {
    const statement = draft.trim()
    if (!statement || saving) return

    setSaving(true)
    setError(null)

    try {
      // Each save inserts a new row instead of updating the old one: seeing
      // how a vision shifted over months is the point of the tool.
      await createToolEntry<VisionPayload>(supabase, userId, VISION_TOOL_ID, { statement })
      const entries = await fetchToolEntries(supabase, userId, VISION_TOOL_ID)
      setRevisions(toVisionRevisions(entries))
      setEditing(false)
      setDraft('')
    } catch {
      setError('Your vision could not be saved. Please try again.')
    }

    setSaving(false)
  }

  function startEditing() {
    setDraft(current?.payload.statement ?? '')
    setEditing(true)
    setError(null)
  }

  return (
    <div className="space-y-5">
      {editing ? (
        <div className="space-y-3 rounded-2xl border bg-card p-4">
          <label htmlFor="vision-statement" className="text-sm font-semibold">
            Where are you headed?
          </label>
          <p className="text-xs text-muted-foreground">
            Write it in the present tense, as if it were already true. You can revise it
            whenever it stops fitting.
          </p>
          <Textarea
            id="vision-statement"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            maxLength={MAX_LENGTH}
            disabled={saving}
            autoFocus
            placeholder="In three years I..."
            className="min-h-40 text-base"
          />
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-muted-foreground">
              {draft.length}/{MAX_LENGTH}
            </span>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditing(false)}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button type="button" onClick={save} disabled={saving || !draft.trim()}>
                {saving && <Loader2 className="size-4 animate-spin" />}
                {current ? 'Save revision' : 'Save vision'}
              </Button>
            </div>
          </div>
        </div>
      ) : current ? (
        <div className="rounded-2xl border bg-card p-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Current vision · {formatDate(current.createdAt)}
            </span>
            <Button type="button" variant="ghost" size="sm" onClick={startEditing}>
              <PencilLine className="size-3.5" />
              Revise
            </Button>
          </div>
          <p className="whitespace-pre-wrap text-base leading-7">
            {current.payload.statement}
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed px-5 py-9 text-center">
          <Compass className="mx-auto size-8 text-muted-foreground/60" />
          <p className="mt-3 text-sm font-medium">No vision yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Describe where you are headed. It does not have to be right — it has to be
            written down.
          </p>
          <Button type="button" className="mt-4" onClick={startEditing}>
            Write your vision
          </Button>
        </div>
      )}

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      {previous.length > 0 && (
        <section className="space-y-3">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground">
            <History className="size-3.5" />
            Earlier versions
          </h2>
          <div className="space-y-2">
            {previous.map((revision) => (
              <details key={revision.id} className="rounded-xl border bg-muted/30 p-3">
                <summary className="cursor-pointer text-xs font-medium text-muted-foreground">
                  {formatDate(revision.createdAt)}
                </summary>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-foreground/90">
                  {revision.payload.statement}
                </p>
              </details>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

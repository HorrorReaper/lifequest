'use client'

import { useMemo, useState } from 'react'
import { Loader2, Pencil, Trash2, Unlock } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import {
  createToolEntry,
  deleteToolEntry,
  fetchToolEntries,
  updateToolEntry,
  type ToolEntry,
} from '@/lib/tools/storage'
import type { ToolProps } from '@/lib/tools/registry'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

export const LIMITING_BELIEFS_TOOL_ID = 'limiting-beliefs'
const MAX_LENGTH = 400

export interface LimitingBeliefPayload {
  belief: string
  evidenceAgainst: string
  reframe: string
}

export function isLimitingBeliefPayload(value: unknown): value is LimitingBeliefPayload {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const candidate = value as Partial<LimitingBeliefPayload>
  return (
    typeof candidate.belief === 'string' &&
    typeof candidate.evidenceAgainst === 'string' &&
    typeof candidate.reframe === 'string'
  )
}

/**
 * tool_entries is deliberately schema-less so a new tool needs no migration,
 * which means each tool is responsible for validating its own payload shape.
 */
export function toLimitingBeliefEntries(
  entries: ToolEntry[]
): ToolEntry<LimitingBeliefPayload>[] {
  return entries.filter(
    (entry): entry is ToolEntry<LimitingBeliefPayload> => isLimitingBeliefPayload(entry.payload)
  )
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

const EMPTY_DRAFT: LimitingBeliefPayload = { belief: '', evidenceAgainst: '', reframe: '' }

export function LimitingBeliefsTool({ userId, initialEntries, onUsed }: ToolProps) {
  const supabase = useMemo(() => createClient(), [])
  const [beliefs, setBeliefs] = useState(() => toLimitingBeliefEntries(initialEntries))
  const [draft, setDraft] = useState<LimitingBeliefPayload>(EMPTY_DRAFT)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const formOpen = creating || editingId !== null

  function startCreating() {
    setDraft(EMPTY_DRAFT)
    setCreating(true)
    setEditingId(null)
    setError(null)
  }

  function startEditing(entry: ToolEntry<LimitingBeliefPayload>) {
    setDraft(entry.payload)
    setEditingId(entry.id)
    setCreating(false)
    setError(null)
  }

  function cancelForm() {
    setCreating(false)
    setEditingId(null)
    setError(null)
  }

  const canSave =
    draft.belief.trim().length > 0 &&
    draft.evidenceAgainst.trim().length > 0 &&
    draft.reframe.trim().length > 0

  async function save() {
    if (!canSave || saving) return

    const payload: LimitingBeliefPayload = {
      belief: draft.belief.trim(),
      evidenceAgainst: draft.evidenceAgainst.trim(),
      reframe: draft.reframe.trim(),
    }

    setSaving(true)
    setError(null)

    try {
      if (editingId) {
        await updateToolEntry<LimitingBeliefPayload>(supabase, editingId, payload)
      } else {
        await createToolEntry<LimitingBeliefPayload>(supabase, userId, LIMITING_BELIEFS_TOOL_ID, payload)
      }
      const entries = await fetchToolEntries(supabase, userId, LIMITING_BELIEFS_TOOL_ID)
      setBeliefs(toLimitingBeliefEntries(entries))
      setCreating(false)
      setEditingId(null)
      setDraft(EMPTY_DRAFT)
      onUsed?.()
    } catch {
      setError('This could not be saved. Please try again.')
    }

    setSaving(false)
  }

  async function remove(entryId: string) {
    setError(null)
    try {
      await deleteToolEntry(supabase, entryId)
      setBeliefs((current) => current.filter((entry) => entry.id !== entryId))
    } catch {
      setError('This could not be removed. Please try again.')
    }
  }

  return (
    <div className="space-y-5">
      {formOpen && (
        <div className="space-y-4 rounded-2xl border bg-card p-4">
          <div className="space-y-2">
            <label htmlFor="belief-statement" className="text-sm font-semibold">
              What is the limiting belief?
            </label>
            <p className="text-xs text-muted-foreground">
              Write it as you actually hear it in your head, not the polished version.
            </p>
            <Textarea
              id="belief-statement"
              value={draft.belief}
              onChange={(event) => setDraft((current) => ({ ...current, belief: event.target.value }))}
              maxLength={MAX_LENGTH}
              disabled={saving}
              autoFocus
              placeholder="I am not good enough to..."
              className="min-h-20 text-base"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="belief-evidence" className="text-sm font-semibold">
              What evidence goes against it?
            </label>
            <p className="text-xs text-muted-foreground">
              Specific moments or facts, not general reassurance.
            </p>
            <Textarea
              id="belief-evidence"
              value={draft.evidenceAgainst}
              onChange={(event) =>
                setDraft((current) => ({ ...current, evidenceAgainst: event.target.value }))
              }
              maxLength={MAX_LENGTH}
              disabled={saving}
              placeholder="Times this belief did not hold up..."
              className="min-h-20 text-base"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="belief-reframe" className="text-sm font-semibold">
              What is a more realistic belief?
            </label>
            <p className="text-xs text-muted-foreground">
              Something you can actually believe, not just a nicer-sounding sentence.
            </p>
            <Textarea
              id="belief-reframe"
              value={draft.reframe}
              onChange={(event) => setDraft((current) => ({ ...current, reframe: event.target.value }))}
              maxLength={MAX_LENGTH}
              disabled={saving}
              placeholder="A belief that fits the evidence better..."
              className="min-h-20 text-base"
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={cancelForm} disabled={saving}>
              Cancel
            </Button>
            <Button type="button" onClick={save} disabled={saving || !canSave}>
              {saving && <Loader2 className="size-4 animate-spin" />}
              {editingId ? 'Save changes' : 'Save belief'}
            </Button>
          </div>
        </div>
      )}

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      {beliefs.length === 0 && !formOpen ? (
        <div className="rounded-2xl border border-dashed px-5 py-9 text-center">
          <Unlock className="mx-auto size-8 text-muted-foreground/60" />
          <p className="mt-3 text-sm font-medium">No limiting beliefs yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Name one that has been holding you back, then challenge it.
          </p>
          <Button type="button" className="mt-4" onClick={startCreating}>
            Name a limiting belief
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {beliefs.map((entry) => (
            <div key={entry.id} className="rounded-2xl border bg-card p-4">
              <div className="mb-2 flex items-center justify-between gap-3">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {formatDate(entry.createdAt)}
                </span>
                <div className="flex gap-1">
                  <Button type="button" variant="ghost" size="icon-sm" onClick={() => startEditing(entry)} aria-label="Edit belief">
                    <Pencil className="size-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => void remove(entry.id)}
                    aria-label="Delete belief"
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </div>
              <p className="whitespace-pre-wrap text-sm font-medium leading-6">
                {entry.payload.belief}
              </p>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
                <span className="font-semibold text-foreground">Reframe: </span>
                {entry.payload.reframe}
              </p>
            </div>
          ))}
          {!formOpen && (
            <Button type="button" variant="outline" className="w-full" onClick={startCreating}>
              Add another belief
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

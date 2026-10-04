'use client'

import { useMemo, useState } from 'react'
import { Check, Leaf, Loader2, Plus, Trash2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { createToolEntry, deleteToolEntry, fetchToolEntries, updateToolEntry, type ToolEntry } from '@/lib/tools/storage'
import type { ToolProps } from '@/lib/tools/registry'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import {
  ENVIRONMENT_AREAS,
  ENVIRONMENT_AUDIT_TOOL_ID,
  MAX_ITEM_LENGTH,
  countDone,
  groupByArea,
  toEnvironmentItems,
  type EnvironmentAreaId,
  type EnvironmentItemPayload,
} from './environment-audit'

const selectClass = 'h-9 w-full rounded-md border bg-background px-3 text-sm'

export function EnvironmentAuditTool({ userId, initialEntries, onUsed }: ToolProps) {
  const supabase = useMemo(() => createClient(), [])
  const [items, setItems] = useState(() => toEnvironmentItems(initialEntries))
  const [area, setArea] = useState<EnvironmentAreaId>('space')
  const [item, setItem] = useState('')
  const [change, setChange] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const groups = groupByArea(items)
  const done = countDone(items)

  async function reload() {
    const entries = await fetchToolEntries(supabase, userId, ENVIRONMENT_AUDIT_TOOL_ID)
    setItems(toEnvironmentItems(entries))
  }

  async function add() {
    if (!item.trim() || saving) return
    setSaving(true)
    setError(null)
    try {
      await createToolEntry<EnvironmentItemPayload>(supabase, userId, ENVIRONMENT_AUDIT_TOOL_ID, {
        area,
        item: item.trim(),
        change: change.trim(),
        done: false,
      })
      await reload()
      setItem('')
      setChange('')
      onUsed?.()
    } catch {
      setError('This could not be saved. Please try again.')
    }
    setSaving(false)
  }

  async function toggleDone(entry: ToolEntry<EnvironmentItemPayload>) {
    setError(null)
    const next = { ...entry.payload, done: !entry.payload.done }
    try {
      await updateToolEntry<EnvironmentItemPayload>(supabase, entry.id, next)
      setItems((current) => current.map((candidate) => (candidate.id === entry.id ? { ...candidate, payload: next } : candidate)))
      if (next.done) onUsed?.()
    } catch {
      setError('This could not be updated. Please try again.')
    }
  }

  async function remove(entryId: string) {
    setError(null)
    try {
      await deleteToolEntry(supabase, entryId)
      setItems((current) => current.filter((entry) => entry.id !== entryId))
    } catch {
      setError('This could not be removed. Please try again.')
    }
  }

  return (
    <div className="space-y-5">
      <form
        className="space-y-3 rounded-2xl border bg-card p-4"
        onSubmit={(event) => {
          event.preventDefault()
          void add()
        }}
      >
        <div className="space-y-1">
          <p className="text-sm font-semibold">What around you is holding you back?</p>
          <p className="text-xs text-muted-foreground">
            Walk through each area. Your environment wins against willpower, so change the environment.
          </p>
        </div>
        <label className="block space-y-1 text-xs text-muted-foreground">
          <span>Area</span>
          <select className={selectClass} value={area} onChange={(event) => setArea(event.target.value as EnvironmentAreaId)} disabled={saving}>
            {ENVIRONMENT_AREAS.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label} · {option.hint}
              </option>
            ))}
          </select>
        </label>
        <Input
          aria-label="What is holding you back"
          value={item}
          onChange={(event) => setItem(event.target.value)}
          maxLength={MAX_ITEM_LENGTH}
          disabled={saving}
          placeholder="Phone on the nightstand"
        />
        <Input
          aria-label="What you will change"
          value={change}
          onChange={(event) => setChange(event.target.value)}
          maxLength={MAX_ITEM_LENGTH}
          disabled={saving}
          placeholder="What you will remove or change: charge it in the kitchen"
        />
        <div className="flex justify-end">
          <Button type="submit" disabled={saving || !item.trim()}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
            Add
          </Button>
        </div>
      </form>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed px-5 py-9 text-center">
          <Leaf className="mx-auto size-8 text-muted-foreground/60" />
          <p className="mt-3 text-sm font-medium">Nothing listed yet</p>
          <p className="mt-1 text-sm text-muted-foreground">List at least three things, then remove one of them today.</p>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {done} of {items.length} removed or changed
          </p>
          {groups.map((group) => (
            <section key={group.id} className="space-y-2">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{group.label}</h2>
              {group.items.map((entry) => (
                <div key={entry.id} className={cn('flex items-start gap-3 rounded-xl border bg-card p-3', entry.payload.done && 'opacity-70')}>
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={entry.payload.done}
                    aria-label={`Mark “${entry.payload.item}” as ${entry.payload.done ? 'not done' : 'removed or changed'}`}
                    onClick={() => void toggleDone(entry)}
                    className={cn(
                      'mt-0.5 grid size-5 shrink-0 place-items-center rounded-md border',
                      entry.payload.done && 'border-primary bg-primary text-primary-foreground'
                    )}
                  >
                    {entry.payload.done && <Check className="size-3.5" />}
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className={cn('text-sm font-medium', entry.payload.done && 'line-through')}>{entry.payload.item}</p>
                    {entry.payload.change && <p className="text-xs text-muted-foreground">→ {entry.payload.change}</p>}
                  </div>
                  <Button type="button" variant="ghost" size="icon-sm" onClick={() => void remove(entry.id)} aria-label="Delete item">
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              ))}
            </section>
          ))}
        </div>
      )}
    </div>
  )
}

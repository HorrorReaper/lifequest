'use client'

import { useMemo, useState } from 'react'
import { History, Loader2, PencilLine, Plus, UserRound, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { createToolEntry, fetchToolEntries } from '@/lib/tools/storage'
import type { ToolProps } from '@/lib/tools/registry'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  IDENTITY_TOOL_ID,
  MAX_IDENTITY_STATEMENTS,
  MAX_PROOF_LENGTH,
  MAX_STATEMENT_LENGTH,
  cleanIdentity,
  toIdentityRevisions,
  type IdentityPayload,
} from './identity'

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

export function IdentityTool({ userId, initialEntries, onUsed }: ToolProps) {
  const supabase = useMemo(() => createClient(), [])
  const [revisions, setRevisions] = useState(() => toIdentityRevisions(initialEntries))
  const [editing, setEditing] = useState(false)
  const [statements, setStatements] = useState<string[]>(['', '', ''])
  const [dailyProof, setDailyProof] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const current = revisions[0] ?? null
  const previous = revisions.slice(1)
  const payload = cleanIdentity(statements, dailyProof)

  function startEditing() {
    const existing = current?.payload.statements ?? []
    setStatements(existing.length > 0 ? [...existing] : ['', '', ''])
    setDailyProof(current?.payload.dailyProof ?? '')
    setEditing(true)
    setError(null)
  }

  function updateStatement(index: number, value: string) {
    setStatements((list) => list.map((item, itemIndex) => (itemIndex === index ? value : item)))
  }

  async function save() {
    if (!payload || saving) return
    setSaving(true)
    setError(null)
    try {
      await createToolEntry<IdentityPayload>(supabase, userId, IDENTITY_TOOL_ID, payload)
      const entries = await fetchToolEntries(supabase, userId, IDENTITY_TOOL_ID)
      setRevisions(toIdentityRevisions(entries))
      setEditing(false)
      onUsed?.()
    } catch {
      setError('Your identity could not be saved. Please try again.')
    }
    setSaving(false)
  }

  return (
    <div className="space-y-5">
      {editing ? (
        <div className="space-y-4 rounded-2xl border bg-card p-4">
          <div className="space-y-1">
            <p className="text-sm font-semibold">Who do you need to be to reach your goals?</p>
            <p className="text-xs text-muted-foreground">
              Describe the person, not the result. “I am someone who trains four times a week”, not “I am fit”.
            </p>
          </div>
          <div className="space-y-2">
            {statements.map((statement, index) => (
              <div key={index} className="flex items-center gap-2">
                <span className="shrink-0 text-sm text-muted-foreground">I am someone who</span>
                <Input
                  aria-label={`Identity statement ${index + 1}`}
                  value={statement}
                  onChange={(event) => updateStatement(index, event.target.value)}
                  maxLength={MAX_STATEMENT_LENGTH}
                  disabled={saving}
                  placeholder={index === 0 ? 'keeps promises to myself' : '...'}
                />
                {statements.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setStatements((list) => list.filter((_, itemIndex) => itemIndex !== index))}
                    aria-label={`Remove statement ${index + 1}`}
                    disabled={saving}
                  >
                    <X className="size-3.5" />
                  </Button>
                )}
              </div>
            ))}
            {statements.length < MAX_IDENTITY_STATEMENTS && (
              <Button type="button" variant="ghost" size="sm" onClick={() => setStatements((list) => [...list, ''])} disabled={saving}>
                <Plus className="size-3.5" />
                Add a line
              </Button>
            )}
          </div>
          <div className="space-y-2">
            <label htmlFor="identity-proof" className="text-sm font-semibold">
              What would that person do today?
            </label>
            <p className="text-xs text-muted-foreground">One small action that proves it. Identity is built by evidence.</p>
            <Textarea
              id="identity-proof"
              value={dailyProof}
              onChange={(event) => setDailyProof(event.target.value)}
              maxLength={MAX_PROOF_LENGTH}
              disabled={saving}
              placeholder="Go for a 20-minute walk before checking my phone."
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setEditing(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="button" onClick={save} disabled={saving || !payload}>
              {saving && <Loader2 className="size-4 animate-spin" />}
              {current ? 'Save revision' : 'Save identity'}
            </Button>
          </div>
        </div>
      ) : current ? (
        <div className="rounded-2xl border bg-card p-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Who I am becoming · {formatDate(current.createdAt)}
            </span>
            <Button type="button" variant="ghost" size="sm" onClick={startEditing}>
              <PencilLine className="size-3.5" />
              Revise
            </Button>
          </div>
          <ul className="space-y-1.5">
            {current.payload.statements.map((statement, index) => (
              <li key={index} className="text-base leading-7">
                <span className="text-muted-foreground">I am someone who </span>
                {statement}
              </li>
            ))}
          </ul>
          {current.payload.dailyProof && (
            <p className="mt-4 rounded-xl bg-muted/50 p-3 text-sm">
              <span className="font-semibold">Today’s proof: </span>
              {current.payload.dailyProof}
            </p>
          )}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed px-5 py-9 text-center">
          <UserRound className="mx-auto size-8 text-muted-foreground/60" />
          <p className="mt-3 text-sm font-medium">No identity yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Goals say what you want. Identity says who you are while you get there.
          </p>
          <Button type="button" className="mt-4" onClick={startEditing}>
            Describe who you are becoming
          </Button>
        </div>
      )}

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      {previous.length > 0 && !editing && (
        <section className="space-y-3">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground">
            <History className="size-3.5" />
            Earlier versions
          </h2>
          {previous.map((revision) => (
            <details key={revision.id} className="rounded-xl border bg-muted/30 p-3">
              <summary className="cursor-pointer text-xs font-medium text-muted-foreground">{formatDate(revision.createdAt)}</summary>
              <ul className="mt-2 space-y-1 text-sm">
                {revision.payload.statements.map((statement, index) => (
                  <li key={index}>I am someone who {statement}</li>
                ))}
              </ul>
            </details>
          ))}
        </section>
      )}
    </div>
  )
}

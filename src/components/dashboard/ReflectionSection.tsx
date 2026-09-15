'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { PenLine, RefreshCw, Sparkles } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { saveReflectionEntry } from '@/lib/reflection-entry'
import { useUserStore } from '@/lib/stores/user-store'
import { dateInTimezone } from '@/lib/dates'
import {
  findReflectionPrompt,
  randomReflectionPrompt,
  reflectionPromptStorageKey,
  type ReflectionPrompt,
} from '@/lib/daily-reflection'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

interface ReflectionSectionProps {
  prompt: ReflectionPrompt
  /** True once a reflection has been written for today. */
  writtenToday: boolean
  /** The id of today's reflection entry, so a second visit edits it. */
  entryId: string | null
  timezone: string
  userId: string
}

/**
 * The day's question, answered in place.
 *
 * "Write about it" expands into a plain textarea and a Save button right
 * here; saving writes a new journal entry through `saveReflectionEntry`,
 * which is the save path this template needs — the same entry/XP/streak
 * pipeline the full entry form runs, without the general form's field-type
 * machinery this single-textarea template never touches.
 *
 * The "new question" button swaps in a different prompt and remembers that
 * choice in localStorage for the rest of the day, so reloading the page
 * shows the same question back — only the button, or the day changing,
 * moves it on. Which prompt an entry answers is derived from its date, not
 * stored with it (see reflectionPromptForDate), so this override is purely
 * a display preference and has nothing else to keep in sync.
 */
export function ReflectionSection({
  prompt,
  writtenToday,
  entryId,
  timezone,
  userId,
}: ReflectionSectionProps) {
  const router = useRouter()
  const { addXp, updateStreak } = useUserStore()
  const today = useMemo(() => dateInTimezone(new Date(), timezone), [timezone])
  const promptStorageKey = useMemo(
    () => reflectionPromptStorageKey(userId, today),
    [userId, today]
  )
  const [currentPrompt, setCurrentPrompt] = useState(prompt)
  // Gates the "persist on change" effect below until the "restore from
  // storage" effect has had its turn, so a stored pick is not immediately
  // overwritten by the server's default before it is even read.
  const [promptHydrated, setPromptHydrated] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [text, setText] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Local override so the section can flip to "answered" the moment a save
  // resolves, without waiting on the server component above it to re-render.
  const [justSaved, setJustSaved] = useState<{ entryId: string } | null>(null)

  const answered = writtenToday || justSaved !== null
  const answeredEntryId = justSaved?.entryId ?? entryId

  useEffect(() => {
    try {
      const storedId = window.localStorage.getItem(promptStorageKey)
      const stored = storedId ? findReflectionPrompt(storedId) : null
      if (stored) setCurrentPrompt(stored)
    } catch {
      // Storage can be unavailable in hardened/private browser contexts.
    } finally {
      setPromptHydrated(true)
    }
  }, [promptStorageKey])

  useEffect(() => {
    if (!promptHydrated) return
    try {
      window.localStorage.setItem(promptStorageKey, currentPrompt.id)
    } catch {
      // Best-effort; the chosen question still shows for this render.
    }
  }, [currentPrompt, promptHydrated, promptStorageKey])

  async function handleSave() {
    const answer = text.trim()
    if (!answer || saving) return

    setSaving(true)
    setError(null)

    try {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const result = await saveReflectionEntry(supabase, { userId: user.id, timezone, text: answer })
      addXp(result.xpEarned, result.totalXp - result.xpEarned)
      updateStreak(result.streak)
      setJustSaved({ entryId: result.entryId })
      setExpanded(false)
      router.refresh()
    } catch (err) {
      console.error('Failed to save reflection:', err)
      setError('Something went wrong. Your answer is still here — try saving again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="rounded-2xl border bg-card p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Sparkles className="size-4" />
          </span>
          <h2 className="text-lg font-semibold sm:text-base">Daily Reflection</h2>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
            {currentPrompt.theme}
          </span>
          {!answered && (
            <button
              type="button"
              aria-label="Get a new question"
              onClick={() => setCurrentPrompt((current) => randomReflectionPrompt(current.id))}
              className="flex size-6 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <RefreshCw className="size-3.5" />
            </button>
          )}
        </div>
      </div>

      <p className="mt-4 text-balance text-base leading-7 sm:text-[0.95rem] sm:leading-6">
        {currentPrompt.text}
      </p>

      {expanded && !answered ? (
        <div className="mt-4 space-y-3">
          <Textarea
            autoFocus
            rows={4}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Whatever comes to mind. No one else reads this."
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setExpanded(false)
                setError(null)
              }}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleSave}
              disabled={!text.trim() || saving}
            >
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-4 flex items-center justify-between gap-3 border-t pt-3">
          {answered ? (
            <Link
              href={`/journal/${answeredEntryId}`}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-primary transition-opacity hover:opacity-80"
            >
              <PenLine className="size-4" />
              Read what you wrote
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => setExpanded(true)}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-primary transition-opacity hover:opacity-80"
            >
              <PenLine className="size-4" />
              Write about it
            </button>
          )}
          {answered && (
            <span className="text-sm text-muted-foreground sm:text-xs">
              Answered today
            </span>
          )}
        </div>
      )}
    </section>
  )
}

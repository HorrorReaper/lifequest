'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Coins, Loader2, Plus, X, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { createClient } from '@/lib/supabase/client'
import { createPersonalChallenge } from '@/lib/challenge-programs'
import {
  PERSONAL_CHALLENGE_DAY_PRESETS,
  blankPersonalChallenge,
  personalChallengeReward,
  validatePersonalChallenge,
  type PersonalChallengeInput,
} from '@/lib/personal-challenge'
import { cn } from '@/lib/utils'

/** "X days of Y": a challenge the user sets up for themselves, started today. */
export function CreateChallengeForm() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState<PersonalChallengeInput>(blankPersonalChallenge)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const reward = personalChallengeReward(input.days)

  function update(patch: Partial<PersonalChallengeInput>) {
    setInput((current) => ({ ...current, ...patch }))
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    const problem = validatePersonalChallenge(input)
    if (problem) {
      setError(problem)
      return
    }
    setSaving(true)
    setError(null)
    try {
      const templateId = await createPersonalChallenge(createClient(), input)
      router.push(`/challenges/${templateId}`)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create this challenge.')
      setSaving(false)
    }
  }

  if (!open) {
    return (
      <Button variant="outline" className="w-full justify-center" onClick={() => setOpen(true)}>
        <Plus />
        Create your own challenge
      </Button>
    )
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-[1.5rem] border bg-card p-5" aria-label="Create your own challenge">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Your own challenge</h2>
          <p className="text-sm text-muted-foreground">One action, every day, for as long as you choose. Only you can see it.</p>
        </div>
        <Button type="button" variant="ghost" size="icon" onClick={() => setOpen(false)} aria-label="Close">
          <X />
        </Button>
      </div>

      <div className="space-y-2">
        <Label htmlFor="personal-title">Title</Label>
        <Input
          id="personal-title"
          value={input.title}
          onChange={(event) => update({ title: event.target.value })}
          placeholder="30 days of cold showers"
          maxLength={120}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="personal-task">Every day I will…</Label>
        <Input
          id="personal-task"
          value={input.task}
          onChange={(event) => update({ task: event.target.value })}
          placeholder="Take a cold shower"
          maxLength={120}
        />
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">How many days?</legend>
        <div className="flex flex-wrap gap-2">
          {PERSONAL_CHALLENGE_DAY_PRESETS.map((days) => (
            <button
              key={days}
              type="button"
              onClick={() => update({ days })}
              aria-pressed={input.days === days}
              className={cn(
                'rounded-full border px-3 py-1.5 text-sm transition-colors',
                input.days === days ? 'border-primary bg-primary/10 text-primary' : 'hover:bg-muted'
              )}
            >
              {days}
            </button>
          ))}
          <Input
            aria-label="Number of days"
            type="number"
            min={1}
            max={365}
            className="h-9 w-24"
            value={Number.isFinite(input.days) ? input.days : ''}
            onChange={(event) => update({ days: event.target.valueAsNumber })}
          />
        </div>
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">If I miss a day</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {(
            [
              ['sequential', 'Keep going', 'The next day simply waits for you.'],
              ['strict', 'Start over', 'Every calendar day counts. A gap means a restart.'],
            ] as const
          ).map(([mode, label, hint]) => (
            <label
              key={mode}
              className={cn(
                'cursor-pointer rounded-xl border p-3 text-sm transition-colors',
                input.scheduleMode === mode ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
              )}
            >
              <input
                type="radio"
                name="personal-mode"
                value={mode}
                checked={input.scheduleMode === mode}
                onChange={() => update({ scheduleMode: mode })}
                className="sr-only"
              />
              <span className="block font-medium">{label}</span>
              <span className="block text-xs text-muted-foreground">{hint}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="space-y-2">
        <Label htmlFor="personal-description">Why (optional)</Label>
        <Textarea
          id="personal-description"
          value={input.description}
          onChange={(event) => update({ description: event.target.value })}
          placeholder="What do you want to feel at the end of it?"
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="flex items-center gap-3 text-xs text-muted-foreground">
          Finishing earns
          <span className="flex items-center gap-1 text-blue-600 dark:text-blue-400">
            <Zap className="size-3.5" />
            {reward.xp} XP
          </span>
          <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
            <Coins className="size-3.5" />
            {reward.coins}
          </span>
        </p>
        <Button type="submit" disabled={saving}>
          {saving ? <Loader2 className="animate-spin" /> : <Plus />}
          Start today
        </Button>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </form>
  )
}

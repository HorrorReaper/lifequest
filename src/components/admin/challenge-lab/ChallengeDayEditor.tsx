'use client'

import { ArrowDown, ArrowUp, Sparkles, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { CHALLENGE_RULES, getChallengeRule, resolveDayAction } from '@/lib/challenge-rules'
import type { DayDraft } from '@/lib/challenge-draft'
import type { ChallengeCompletionType } from '@/lib/supabase/database.types'
import { cn } from '@/lib/utils'

export interface RuleParamOption {
  value: string
  label: string
}

const selectClass = 'h-9 w-full rounded-md border bg-background px-3 text-sm'

/** One day of the admin editor: content, how it completes, and its button. */
export function ChallengeDayEditor({
  day,
  index,
  total,
  lengthLocked = false,
  journalTemplates,
  tools,
  onChange,
  onMove,
  onRemove,
}: {
  day: DayDraft
  index: number
  total: number
  /** People have joined: days can be edited but not removed. */
  lengthLocked?: boolean
  journalTemplates: RuleParamOption[]
  tools: RuleParamOption[]
  onChange: (patch: Partial<DayDraft>) => void
  onMove: (direction: -1 | 1) => void
  onRemove: () => void
}) {
  const rule = getChallengeRule(day.completion_type)
  const automatic = rule.kind !== 'manual'
  const fallbackAction = resolveDayAction({
    completion_type: day.completion_type,
    completion_param: day.completion_param || null,
    action_href: null,
    action_label: null,
  })
  const n = index + 1

  return (
    <article className={cn('rounded-2xl bg-muted/35 p-4 ring-1 ring-border', automatic && 'ring-primary/30')}>
      <div className="flex items-center gap-2">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-background font-mono text-xs">
          {String(n).padStart(2, '0')}
        </span>
        <Input
          aria-label={`Day ${n} title`}
          value={day.title}
          onChange={(event) => onChange({ title: event.target.value })}
          placeholder="Today’s action"
        />
        <Button size="icon" variant="ghost" onClick={() => onMove(-1)} disabled={index === 0} aria-label={`Move day ${n} up`}>
          <ArrowUp />
        </Button>
        <Button size="icon" variant="ghost" onClick={() => onMove(1)} disabled={index === total - 1} aria-label={`Move day ${n} down`}>
          <ArrowDown />
        </Button>
        <Button size="icon" variant="ghost" onClick={onRemove} disabled={total === 1 || lengthLocked} aria-label={`Delete day ${n}`}>
          <Trash2 />
        </Button>
      </div>

      <Textarea
        className="mt-3 min-h-24"
        aria-label={`Day ${n} instructions`}
        value={day.instructions}
        onChange={(event) => onChange({ instructions: event.target.value })}
        placeholder="What exactly should the user do today, and why?"
      />

      <div className="mt-3 grid gap-3 rounded-xl bg-background/70 p-3 md:grid-cols-[minmax(0,1.4fr)_minmax(0,0.5fr)_minmax(0,1fr)]">
        <label className="space-y-1 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            {automatic && <Sparkles className="size-3 text-primary" />}
            Completed when
          </span>
          <select
            aria-label={`Day ${n} completion rule`}
            className={selectClass}
            value={day.completion_type}
            onChange={(event) =>
              onChange({ completion_type: event.target.value as ChallengeCompletionType, completion_param: '' })
            }
          >
            {CHALLENGE_RULES.map((item) => (
              <option key={item.id} value={item.id}>
                {item.adminLabel}
              </option>
            ))}
          </select>
        </label>
        {automatic ? (
          <label className="space-y-1 text-xs text-muted-foreground">
            <span>N</span>
            <Input
              aria-label={`Day ${n} target`}
              type="number"
              min={1}
              max={100}
              className="h-9"
              value={day.completion_target}
              onChange={(event) => onChange({ completion_target: Number(event.target.value) })}
            />
          </label>
        ) : (
          <div />
        )}
        {rule.param === 'journal_template' ? (
          <label className="space-y-1 text-xs text-muted-foreground">
            <span>Journal template</span>
            <select
              aria-label={`Day ${n} journal template`}
              className={selectClass}
              value={day.completion_param}
              onChange={(event) => onChange({ completion_param: event.target.value })}
            >
              <option value="">Any journal entry</option>
              {journalTemplates.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        ) : rule.param === 'tool' ? (
          <label className="space-y-1 text-xs text-muted-foreground">
            <span>Tool</span>
            <select
              aria-label={`Day ${n} tool`}
              className={selectClass}
              value={day.completion_param}
              onChange={(event) => onChange({ completion_param: event.target.value })}
            >
              <option value="">Pick a tool…</option>
              {tools.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <p className="self-end pb-2 text-xs text-muted-foreground">
            {rule.kind === 'state'
              ? 'Checks what the user has right now.'
              : rule.kind === 'activity'
                ? 'Counts from the day this step unlocks.'
                : 'The user ticks the day off, with an optional note.'}
          </p>
        )}
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <Input
          aria-label={`Day ${n} button link`}
          value={day.action_href}
          onChange={(event) => onChange({ action_href: event.target.value })}
          placeholder={fallbackAction ? `Button link (default ${fallbackAction.href})` : 'Button link, e.g. /habits (optional)'}
        />
        <Input
          aria-label={`Day ${n} button label`}
          value={day.action_label}
          onChange={(event) => onChange({ action_label: event.target.value })}
          placeholder={fallbackAction ? `Button label (default “${fallbackAction.label}”)` : 'Button label (optional)'}
        />
      </div>

      {!automatic && (
        <Input
          className="mt-3"
          aria-label={`Day ${n} reflection prompt`}
          value={day.reflection_prompt}
          onChange={(event) => onChange({ reflection_prompt: event.target.value })}
          placeholder="Optional reflection prompt shown with the note field"
        />
      )}
    </article>
  )
}

'use client'

import { BookOpenCheck } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { normalizeLearningTags, type LearningFieldValue } from '@/lib/learnings'

interface LearningInputProps {
  value: LearningFieldValue | null
  onChange: (value: LearningFieldValue) => void
  disabled?: boolean
  config?: {
    defaultTags?: string[]
    showAction?: boolean
  }
}

const emptyLearning: LearningFieldValue = {
  title: '',
  note: '',
  tags: [],
  action_text: null,
}

export function LearningInput({
  value,
  onChange,
  disabled = false,
  config,
}: LearningInputProps) {
  const current = value ?? {
    ...emptyLearning,
    tags: normalizeLearningTags(config?.defaultTags ?? []),
  }
  const showAction = config?.showAction ?? true

  return (
    <div className="space-y-3 rounded-2xl border border-primary/15 bg-primary/5 p-4">
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <BookOpenCheck className="size-4" />
        </span>
        <div>
          <p className="text-sm font-semibold text-primary">Save a reusable learning</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Capture the lesson future-you should not have to relearn.
          </p>
        </div>
      </div>

      <Input
        value={current.title}
        onChange={(event) => onChange({ ...current, title: event.target.value })}
        placeholder="Learning title, e.g. Planning protects my focus"
        maxLength={120}
        disabled={disabled}
        className="h-11 rounded-xl bg-background/80"
      />

      <Textarea
        value={current.note}
        onChange={(event) => onChange({ ...current, note: event.target.value })}
        placeholder="What did you learn, and when should future-you remember this?"
        maxLength={1200}
        rows={5}
        disabled={disabled}
        className="min-h-32 resize-none rounded-xl bg-background/80 leading-6"
      />

      <Input
        value={current.tags.join(', ')}
        onChange={(event) =>
          onChange({ ...current, tags: normalizeLearningTags(event.target.value) })
        }
        placeholder="Tags: focus, fitness, startup"
        disabled={disabled}
        className="h-11 rounded-xl bg-background/80"
      />

      {showAction && (
        <Input
          value={current.action_text ?? ''}
          onChange={(event) =>
            onChange({ ...current, action_text: event.target.value || null })
          }
          placeholder="Optional next action"
          maxLength={500}
          disabled={disabled}
          className="h-11 rounded-xl bg-background/80"
        />
      )}
    </div>
  )
}

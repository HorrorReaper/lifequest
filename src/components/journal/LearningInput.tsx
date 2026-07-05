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
    <div className="space-y-3 rounded-xl border border-primary/15 bg-primary/5 p-3">
      <div className="flex items-center gap-2 text-sm font-medium text-primary">
        <BookOpenCheck className="size-4" />
        Capture a reusable lesson from today
      </div>

      <Input
        value={current.title}
        onChange={(event) => onChange({ ...current, title: event.target.value })}
        placeholder="Learning title, e.g. Planning protects my focus"
        maxLength={120}
        disabled={disabled}
      />

      <Textarea
        value={current.note}
        onChange={(event) => onChange({ ...current, note: event.target.value })}
        placeholder="What did you learn, and when should future-you remember this?"
        maxLength={1200}
        rows={4}
        disabled={disabled}
        className="resize-none"
      />

      <Input
        value={current.tags.join(', ')}
        onChange={(event) =>
          onChange({ ...current, tags: normalizeLearningTags(event.target.value) })
        }
        placeholder="Tags: focus, fitness, startup"
        disabled={disabled}
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
        />
      )}
    </div>
  )
}


'use client'

import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { MoodSelector } from '@/components/journal/mood-selector'
import { StarRating } from '@/components/journal/star-rating'
import { SliderInput } from '@/components/journal/slider-input'
import { ChecklistInput } from '@/components/journal/checklist-input'
import { PromptDisplay } from '@/components/journal/prompt-display'
import { TemplateField, FieldValue, MoodOption, ChecklistItem, DayPlanBlock } from '@/lib/types'
import { DraftTask, TasksInput } from './TasksInput'
import { DayPlannerInput } from './DayPlannerInput'
import { HabitTrackerInput } from './HabitTrackerInput'
import { LearningInput } from './LearningInput'
import type { LearningFieldValue } from '@/lib/learnings'
import { cn } from '@/lib/utils'

interface FieldRendererProps {
  field: TemplateField
  value: FieldValue
  onChange: (value: FieldValue) => void
  disabled?: boolean
}

export function FieldRenderer({
  field,
  value,
  onChange,
  disabled = false,
}: FieldRendererProps) {
  const config = field.config as Record<string, unknown>

  // Display-only fields
  if (field.field_type === 'divider') {
    return <Separator className="my-5 bg-border/60" />
  }

  if (field.field_type === 'heading') {
    const level = (config?.level as number) ?? 2
    const Tag = level === 1 ? 'h2' : 'h3'
    return (
      <Tag
        className={
          level === 1
            ? 'font-heading text-2xl font-semibold tracking-tight'
            : 'font-heading text-xl font-semibold tracking-tight'
        }
      >
        {field.label}
      </Tag>
    )
  }

  if (field.field_type === 'prompt') {
    return (
      <div className="rounded-[1.5rem] border bg-card/85 p-4 shadow-sm sm:p-5">
        <PromptDisplay category={config?.category as string} />
      </div>
    )
  }

  // Interactive fields — wrap in label container
  return (
    <div className="space-y-3 rounded-[1.5rem] border bg-card/85 p-4 shadow-sm sm:p-5">
      <div className="space-y-1.5">
        <label className="text-sm font-semibold leading-none">
          {field.label}
          {field.is_required && (
            <span className="ml-1 text-destructive">*</span>
          )}
        </label>

        {field.description && (
          <p className="max-w-2xl text-xs leading-5 text-muted-foreground">{field.description}</p>
        )}
      </div>

      {/* Text */}
      {field.field_type === 'text' && (
        <Input
          placeholder={field.placeholder ?? ''}
          value={value.value_text ?? ''}
          onChange={(e) =>
            onChange({ ...value, value_text: e.target.value })
          }
          disabled={disabled}
          className="h-11 rounded-xl bg-background/80"
        />
      )}

      {/* Textarea */}
      {field.field_type === 'textarea' && (
        <Textarea
          placeholder={field.placeholder ?? ''}
          value={value.value_text ?? ''}
          onChange={(e) =>
            onChange({ ...value, value_text: e.target.value })
          }
          disabled={disabled}
          rows={(config?.rows as number) ?? 7}
          maxLength={(config?.maxLength as number) ?? undefined}
          className="min-h-40 resize-none rounded-xl bg-background/80 leading-6"
        />
      )}

      {/* Number */}
      {field.field_type === 'number' && (
        <Input
          type="number"
          min={(config?.min as number) ?? undefined}
          max={(config?.max as number) ?? undefined}
          step={(config?.step as number) ?? 1}
          value={value.value_number ?? ''}
          onChange={(e) =>
            onChange({
              ...value,
              value_number: e.target.value ? Number(e.target.value) : null,
            })
          }
          disabled={disabled}
          className="h-11 rounded-xl bg-background/80"
        />
      )}

      {/* Slider */}
      {field.field_type === 'slider' && (
        <SliderInput
          min={(config?.min as number) ?? 1}
          max={(config?.max as number) ?? 10}
          step={(config?.step as number) ?? 1}
          labels={config?.labels as string[] | undefined}
          value={value.value_number ?? null}
          onChange={(val) => onChange({ ...value, value_number: val })}
          disabled={disabled}
        />
      )}

      {/* Select */}
      {field.field_type === 'select' && (
        <div className="flex flex-wrap gap-2">
          {((config?.options as string[]) ?? []).map((option) => (
            <button
              key={option}
              type="button"
              disabled={disabled}
              onClick={() => onChange({ ...value, value_text: option })}
              className={cn(
                'rounded-full border px-3 py-2 text-sm transition-colors',
                value.value_text === option
                  ? 'border-primary/30 bg-primary/10 text-primary'
                  : 'border-border/60 bg-background/70 hover:border-primary/25',
                disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
              )}
            >
              {option}
            </button>
          ))}
        </div>
      )}

      {/* Mood */}
      {field.field_type === 'mood' && (
        <MoodSelector
          options={(config?.options as MoodOption[]) ?? []}
          value={value.value_text ?? null}
          onChange={(val) => onChange({ ...value, value_text: val })}
          disabled={disabled}
        />
      )}

      {/* Rating */}
      {field.field_type === 'rating' && (
        <StarRating
          max={(config?.max as number) ?? 5}
          value={value.value_number ?? null}
          onChange={(val) => onChange({ ...value, value_number: val })}
          disabled={disabled}
        />
      )}

      {/* Checkbox */}
      {field.field_type === 'checkbox' && (
        <div className="flex items-center gap-3 rounded-xl border bg-background/70 p-3">
          <Switch
            checked={value.value_boolean ?? false}
            onCheckedChange={(checked) =>
              onChange({ ...value, value_boolean: checked })
            }
            disabled={disabled}
          />
          <span className="text-sm text-muted-foreground">
            {value.value_boolean ? 'Yes' : 'No'}
          </span>
        </div>
      )}

      {/* Checklist */}
      {field.field_type === 'checklist' && (
        <ChecklistInput
          items={
            (value.value_json as ChecklistItem[]) ??
            ((config?.items as string[]) ?? []).map((label) => ({
              label,
              checked: false,
            }))
          }
          onChange={(items) => onChange({ ...value, value_json: items })}
          disabled={disabled}
        />
      )}

      {/* Tasks */}
      {field.field_type === 'tasks' && (
        <TasksInput
          value={value.value_json as DraftTask[] ?? []}
          onChange={(tasks) => onChange({ ...value, value_json: tasks })}
          config={config}
        />
      )}
      {/* Day Planner */}
      {field.field_type === 'day_planner' && (
        <DayPlannerInput
          value={(value.value_json as { plan_date: string; blocks: DayPlanBlock[] }) ?? null}
          onChange={(v) => onChange({ ...value, value_json: v })}
          config={field.config as { defaultDate?: "tomorrow" | "today"; startHour?: number }}
        />
      )}
      {/* Habit Tracker */}
      {field.field_type === 'habit_tracker' && (
        <HabitTrackerInput
          value={value.value_json as string[] ?? []}
          onChange={(ids) => onChange({ ...value, value_json: ids })}
          config={field.config as { selectedHabitIds?: string[]; showAll?: boolean }}
        />
      )}
      {/* Learning */}
      {field.field_type === 'learning' && (
        <LearningInput
          value={(value.value_json as LearningFieldValue | null) ?? null}
          onChange={(learning) => onChange({ ...value, value_json: learning })}
          disabled={disabled}
          config={field.config as { defaultTags?: string[]; showAction?: boolean }}
        />
      )}
    </div>
  )
}


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
    //Basically ist er dazu da, damit die Felder in der Journal Entry Seite gerendert werden können. Er nimmt die Informationen über das Feld und den aktuellen Wert und rendert das entsprechende Eingabefeld oder Anzeigeelement basierend auf dem Feldtyp.
  const config = field.config as Record<string, unknown>

  // Display-only fields
  if (field.field_type === 'divider') {
    return <Separator className="my-2" />
  }

  if (field.field_type === 'heading') {
    const level = (config?.level as number) ?? 2
    const Tag = level === 1 ? 'h2' : 'h3'
    return (
      <Tag
        className={
          level === 1
            ? 'text-xl font-bold tracking-tight'
            : 'text-lg font-semibold'
        }
      >
        {field.label}
      </Tag>
    )
  }

  if (field.field_type === 'prompt') {
    return <PromptDisplay category={config?.category as string} />
  }

  // Interactive fields — wrap in label container
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium leading-none">
        {field.label}
        {field.is_required && (
          <span className="ml-1 text-destructive">*</span>
        )}
      </label>

      {field.description && (
        <p className="text-xs text-muted-foreground">{field.description}</p>
      )}

      {/* Text */}
      {field.field_type === 'text' && (
        <Input
          placeholder={field.placeholder ?? ''}
          value={value.value_text ?? ''}
          onChange={(e) =>
            onChange({ ...value, value_text: e.target.value })
          }
          disabled={disabled}
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
          rows={4}
          maxLength={(config?.maxLength as number) ?? undefined}
          className="resize-none"
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
              className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                value.value_text === option
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border/50 hover:border-primary/30'
              } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
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
        <div className="flex items-center gap-3">
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

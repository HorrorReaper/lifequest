'use client'

import { useState } from 'react'
import { FieldRenderer } from '@/components/journal/field-renderer'
import { getFieldDefinition } from '@/lib/field-registry'
import { cn } from '@/lib/utils'
import type { FieldValue, TemplateField } from '@/lib/types'
import type { BuilderField } from '@/components/template-builder/sortable-field-item'

interface TemplatePreviewProps {
  icon: string
  name: string
  description: string
  fields: BuilderField[]
  /** Off inside the sheet, whose own dialog title already says "Preview". */
  showLabel?: boolean
}

/**
 * A draft field as the entry form will receive it.
 *
 * The label falls back to the type's readable name rather than the raw enum,
 * which is what the entry form would otherwise end up showing for a field
 * nobody got around to naming.
 */
function asTemplateField(field: BuilderField): TemplateField {
  return {
    id: field.id,
    template_id: 'preview',
    field_type: field.field_type,
    label: field.label || getFieldDefinition(field.field_type).label,
    description: field.description,
    placeholder: field.placeholder,
    is_required: field.is_required,
    sort_order: field.sort_order,
    config: field.config,
    created_at: '',
    xp_rules: field.xp_rules ?? [],
  }
}

/**
 * The template as an entry, rendered through the very component the journal
 * uses -- so what the builder promises and what the entry page delivers cannot
 * drift apart.
 *
 * It stays interactive on purpose: a greyed-out slider says little about how
 * the field will feel. Nothing here writes, and the values are thrown away
 * with the component.
 */
export function TemplatePreview({
  icon,
  name,
  description,
  fields,
  showLabel = true,
}: TemplatePreviewProps) {
  const [values, setValues] = useState<Record<string, FieldValue>>({})

  return (
    <div className="rounded-2xl border bg-card p-5">
      {showLabel && (
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Preview
        </p>
      )}

      <div className={cn('flex items-start gap-3 border-b pb-4', showLabel && 'mt-4')}>
        <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-muted text-2xl">
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-lg font-semibold">{name.trim() || 'Untitled template'}</h3>
          {description.trim() && (
            <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{description}</p>
          )}
        </div>
      </div>

      {fields.length === 0 ? (
        <p className="mt-6 text-center text-sm leading-relaxed text-muted-foreground">
          Add a field and it appears here exactly as it will in the journal.
        </p>
      ) : (
        <div className="mt-5 space-y-5">
          {fields.map((field) => {
            const templateField = asTemplateField(field)

            return (
              <FieldRenderer
                key={field.id}
                field={templateField}
                value={values[field.id] ?? { field_id: field.id }}
                onChange={(value) =>
                  setValues((current) => ({ ...current, [field.id]: value }))
                }
              />
            )
          })}
        </div>
      )}
    </div>
  )
}

'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { getFieldDefinition } from '@/lib/field-registry'
import { FieldType } from '@/lib/types'
// Diese Komponente repräsentiert ein einzelnes Feld in der Template Builder UI, das sortierbar ist. Sie zeigt die Feldinformationen an und bietet Aktionen zum Bearbeiten und Löschen des Feldes.

export interface BuilderField {
  id: string
  field_type: FieldType
  label: string
  description: string | null
  placeholder: string | null
  is_required: boolean
  sort_order: number
  config: Record<string, unknown>
}

interface SortableFieldItemProps {
  field: BuilderField
  onEdit: (field: BuilderField) => void
  onDelete: (id: string) => void
}

export function SortableFieldItem({
  field,
  onEdit,
  onDelete,
}: SortableFieldItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: field.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const definition = getFieldDefinition(field.field_type)

  return (
    <div ref={setNodeRef} style={style}>
      <Card
        className={`border-border/50 transition-shadow ${
          isDragging ? 'shadow-lg ring-2 ring-primary/20' : ''
        }`}
      >
        <CardContent className="flex items-center gap-3 p-3">
          {/* Drag handle */}
          <button
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing touch-none text-muted-foreground hover:text-foreground p-1"
            aria-label="Drag to reorder"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="currentColor"
            >
              <circle cx="5" cy="3" r="1.5" />
              <circle cx="11" cy="3" r="1.5" />
              <circle cx="5" cy="8" r="1.5" />
              <circle cx="11" cy="8" r="1.5" />
              <circle cx="5" cy="13" r="1.5" />
              <circle cx="11" cy="13" r="1.5" />
            </svg>
          </button>

          {/* Field icon + type */}
          <span className="text-lg">{definition.icon}</span>

          {/* Field info */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">
              {field.label || definition.label}
            </p>
            <p className="text-xs text-muted-foreground">
              {definition.label}
              {field.is_required && (
                <span className="ml-1 text-destructive">• Required</span>
              )}
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onEdit(field)}
              className="h-8 w-8 p-0"
            >
              ✏️
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDelete(field.id)}
              className="h-8 w-8 p-0 hover:text-destructive"
            >
              🗑️
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

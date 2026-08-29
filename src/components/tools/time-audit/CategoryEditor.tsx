'use client'

import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  CATEGORY_COLOR_KEYS,
  categoryColor,
  type CategoryValue,
  type TimeAuditCategory,
} from './time-audit'

export interface CategoryEditorProps {
  categories: TimeAuditCategory[]
  onAdd: (label: string, color: string, value: CategoryValue) => void
  onUpdate: (id: string, patch: Partial<TimeAuditCategory>) => void
  onRemove: (id: string) => void
}

const VALUE_OPTIONS: { value: CategoryValue; label: string }[] = [
  { value: 'worth_it', label: 'Worth it' },
  { value: 'neutral', label: 'Neutral' },
  { value: 'wasted', label: 'Wasted' },
]

const selectClass =
  'rounded-lg border bg-background px-2 py-1.5 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

export function CategoryEditor({ categories, onAdd, onUpdate, onRemove }: CategoryEditorProps) {
  const [label, setLabel] = useState('')
  const [color, setColor] = useState(CATEGORY_COLOR_KEYS[0])
  const [value, setValue] = useState<CategoryValue>('neutral')

  function add() {
    const trimmed = label.trim()
    if (!trimmed) return
    onAdd(trimmed, color, value)
    setLabel('')
  }

  return (
    <div className="space-y-3">
      <ul className="space-y-2">
        {categories.map((category) => (
          <li key={category.id} className="flex items-center gap-2">
            <select
              aria-label={`Colour of ${category.label}`}
              value={category.color}
              onChange={(event) => onUpdate(category.id, { color: event.target.value })}
              className={cn(selectClass, 'w-10 shrink-0')}
            >
              {CATEGORY_COLOR_KEYS.map((key) => (
                <option key={key} value={key}>
                  {key}
                </option>
              ))}
            </select>
            <span
              aria-hidden
              className={cn('size-3 shrink-0 rounded-full', categoryColor(category.color).swatch)}
            />
            <Input
              aria-label={`Name of ${category.label}`}
              value={category.label}
              onChange={(event) => onUpdate(category.id, { label: event.target.value })}
              className="h-9 min-w-0 flex-1"
            />
            <select
              aria-label={`Value of ${category.label}`}
              value={category.value}
              onChange={(event) =>
                onUpdate(category.id, { value: event.target.value as CategoryValue })
              }
              className={cn(selectClass, 'shrink-0')}
            >
              {VALUE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={`Remove ${category.label}`}
              onClick={() => onRemove(category.id)}
            >
              <Trash2 className="size-4" />
            </Button>
          </li>
        ))}
      </ul>

      <div className="flex items-center gap-2 border-t pt-3">
        <select
          aria-label="Colour of the new category"
          value={color}
          onChange={(event) => setColor(event.target.value)}
          className={cn(selectClass, 'w-10 shrink-0')}
        >
          {CATEGORY_COLOR_KEYS.map((key) => (
            <option key={key} value={key}>
              {key}
            </option>
          ))}
        </select>
        <Input
          aria-label="New category"
          placeholder="Add a category…"
          value={label}
          onChange={(event) => setLabel(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              add()
            }
          }}
          className="h-9 min-w-0 flex-1"
        />
        <select
          aria-label="Value of the new category"
          value={value}
          onChange={(event) => setValue(event.target.value as CategoryValue)}
          className={cn(selectClass, 'shrink-0')}
        >
          {VALUE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <Button type="button" onClick={add} disabled={!label.trim()}>
          Add
        </Button>
      </div>
    </div>
  )
}

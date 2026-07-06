// src/components/journal/checklist-input.tsx

'use client'

import { Checkbox } from '@/components/ui/checkbox'
import { ChecklistItem } from '@/lib/types'

interface ChecklistInputProps {
  items: ChecklistItem[]
  onChange: (items: ChecklistItem[]) => void
  disabled?: boolean
}

export function ChecklistInput({
  items,
  onChange,
  disabled = false,
}: ChecklistInputProps) {
  function toggleItem(index: number) {
    const updated = items.map((item, i) =>
      i === index ? { ...item, checked: !item.checked } : item
    )
    onChange(updated)
  }

  return (
    <div className="space-y-2">
      {items.map((item, index) => (
        <label
          key={index}
          className={`flex items-center gap-3 rounded-xl border border-border/60 bg-background/70 px-3 py-3 transition-colors ${
            disabled
              ? 'opacity-50 cursor-not-allowed'
              : 'cursor-pointer hover:bg-muted/50'
          } ${item.checked ? 'bg-primary/5 border-primary/20' : ''}`}
        >
          <Checkbox
            checked={item.checked}
            onCheckedChange={() => !disabled && toggleItem(index)}
            disabled={disabled}
          />
          <span
            className={`text-sm ${
              item.checked ? 'line-through text-muted-foreground' : ''
            }`}
          >
            {item.label}
          </span>
        </label>
      ))}
    </div>
  )
}

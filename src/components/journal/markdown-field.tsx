'use client'

import { useId, useRef, useState } from 'react'
import { Bold, Heading2, ImageIcon, Italic, Link2, List, type LucideIcon } from 'lucide-react'
import { Textarea } from '@/components/ui/textarea'
import { MarkdownView } from '@/components/ui/markdown-view'
import { applyMarkdownAction, type MarkdownAction } from '@/lib/markdown-text'
import { cn } from '@/lib/utils'

const ACTIONS: Array<{ action: MarkdownAction; label: string; icon: LucideIcon }> = [
  { action: 'bold', label: 'Bold', icon: Bold },
  { action: 'italic', label: 'Italic', icon: Italic },
  { action: 'heading', label: 'Heading', icon: Heading2 },
  { action: 'list', label: 'List', icon: List },
  { action: 'link', label: 'Link', icon: Link2 },
  { action: 'image', label: 'Image from a link', icon: ImageIcon },
]

interface MarkdownFieldProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  maxLength?: number
  rows?: number
  disabled?: boolean
}

/**
 * The `markdown` journal field: a writing area with a small formatting bar
 * and Write / Preview. The toolbar only inserts Markdown around the
 * selection; Preview shows it as `MarkdownView` will on the diary page.
 */
export function MarkdownField({
  value,
  onChange,
  placeholder,
  maxLength,
  rows = 12,
  disabled = false,
}: MarkdownFieldProps) {
  const [mode, setMode] = useState<'write' | 'preview'>('write')
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const id = useId()

  function apply(action: MarkdownAction) {
    const element = textareaRef.current
    const start = element?.selectionStart ?? value.length
    const end = element?.selectionEnd ?? value.length
    const next = applyMarkdownAction(value, start, end, action)
    if (maxLength && next.text.length > maxLength) return
    onChange(next.text)
    requestAnimationFrame(() => {
      element?.focus()
      element?.setSelectionRange(next.selectionStart, next.selectionEnd)
    })
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div role="toolbar" aria-label="Formatting" className="flex flex-wrap gap-1">
          {ACTIONS.map(({ action, label, icon: Icon }) => (
            <button
              key={action}
              type="button"
              aria-label={label}
              title={label}
              onClick={() => apply(action)}
              disabled={disabled || mode === 'preview'}
              className="flex size-10 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-40"
            >
              <Icon className="size-4" aria-hidden="true" />
            </button>
          ))}
        </div>
        <div role="tablist" aria-label="Editor mode" className="flex rounded-xl bg-muted p-1">
          {(['write', 'preview'] as const).map((item) => (
            <button
              key={item}
              type="button"
              role="tab"
              aria-selected={mode === item}
              aria-controls={`${id}-${item}`}
              onClick={() => setMode(item)}
              className={cn(
                'min-h-9 rounded-lg px-3 text-sm font-medium capitalize transition-colors',
                'focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
                mode === item ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'
              )}
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      {mode === 'write' ? (
        <Textarea
          id={`${id}-write`}
          ref={textareaRef}
          placeholder={placeholder}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled}
          rows={rows}
          maxLength={maxLength}
          className="min-h-64 resize-y rounded-xl bg-background/80 leading-7"
        />
      ) : (
        <div
          id={`${id}-preview`}
          role="tabpanel"
          className="min-h-64 rounded-xl border bg-background/80 px-4 py-2"
        >
          {value.trim() ? (
            <MarkdownView content={value} />
          ) : (
            <p className="py-3 text-sm text-muted-foreground">Nothing to preview yet.</p>
          )}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Markdown works: **bold**, _italic_, ## headings, - lists, [links](https://…). Images come from links that start
        with https: ![description](https://…).
      </p>
    </div>
  )
}

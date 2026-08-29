'use client'

import { useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import {
  BLOCKS_PER_DAY,
  BLOCKS_PER_HOUR,
  blockLabel,
  blockRangeLabel,
  categoryColor,
  type TimeAuditCategory,
} from './time-audit'

export interface DayGridProps {
  blocks: (string | null)[]
  categories: TimeAuditCategory[]
  /** Category id to paint, null to erase, undefined when nothing is selected. */
  brush: string | null | undefined
  onPaint: (from: number, to: number) => void
}

function withinPreview(index: number, preview: [number, number] | null) {
  if (!preview) return false
  return index >= Math.min(...preview) && index <= Math.max(...preview)
}

export function DayGrid({ blocks, categories, brush, onPaint }: DayGridProps) {
  const byId = new Map(categories.map((category) => [category.id, category]))
  const anchor = useRef<number | null>(null)
  const head = useRef<number | null>(null)
  const lastPainted = useRef<number | null>(null)
  const [preview, setPreview] = useState<[number, number] | null>(null)

  function begin(index: number) {
    if (brush === undefined) return
    anchor.current = index
    head.current = index
    setPreview([index, index])
    // Listening on the window rather than the grid so a drag that ends
    // outside the grid still commits instead of hanging mid-paint.
    window.addEventListener('pointerup', finish, { once: true })
  }

  function extend(index: number) {
    if (anchor.current === null) return
    head.current = index
    setPreview([anchor.current, index])
  }

  function finish() {
    const from = anchor.current
    const to = head.current
    anchor.current = null
    head.current = null
    setPreview(null)
    if (from === null || to === null) return
    onPaint(from, to)
    lastPainted.current = to
  }

  function activate(index: number, shiftKey: boolean) {
    if (brush === undefined) return
    const from = shiftKey && lastPainted.current !== null ? lastPainted.current : index
    onPaint(from, index)
    lastPainted.current = index
  }

  return (
    <div
      // Without this a touch drag scrolls the page instead of painting.
      className="touch-none select-none space-y-px"
      role="group"
      aria-label="Day in 15-minute blocks"
    >
      {Array.from({ length: BLOCKS_PER_DAY / BLOCKS_PER_HOUR }, (_, hour) => (
        <div key={hour} className="flex items-center gap-2">
          <span className="w-10 shrink-0 text-right font-mono text-[10px] tabular-nums text-muted-foreground">
            {blockLabel(hour * BLOCKS_PER_HOUR)}
          </span>
          <div className="flex flex-1 gap-px">
            {Array.from({ length: BLOCKS_PER_HOUR }, (_, offset) => {
              const index = hour * BLOCKS_PER_HOUR + offset
              const category = blocks[index] ? byId.get(blocks[index]!) : undefined

              return (
                <button
                  key={index}
                  type="button"
                  aria-label={`${blockRangeLabel(index, index)}, ${category?.label ?? 'unlogged'}`}
                  onPointerDown={() => begin(index)}
                  onPointerEnter={() => extend(index)}
                  // A real pointer click is already handled by the drag pair
                  // above; detail 0 means the button was activated from the
                  // keyboard, which is the only case left to serve here.
                  onClick={(event) => {
                    if (event.detail === 0) activate(index, event.shiftKey)
                  }}
                  className={cn(
                    'h-7 flex-1 rounded-[3px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    category
                      ? categoryColor(category.color).block
                      : 'bg-muted hover:bg-muted-foreground/30',
                    withinPreview(index, preview) && 'ring-2 ring-foreground/60'
                  )}
                />
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

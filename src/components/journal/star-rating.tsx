
'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

interface StarRatingProps {
  max: number
  value: number | null
  onChange: (value: number) => void
  disabled?: boolean
}

export function StarRating({
  max = 5,
  value,
  onChange,
  disabled = false,
}: StarRatingProps) {
  const [hovered, setHovered] = useState<number | null>(null)

  const displayValue = hovered ?? value ?? 0

  return (
    <div className="flex flex-wrap items-center gap-2">
      {Array.from({ length: max }, (_, i) => i + 1).map((star) => (
        <motion.button
          key={star}
          type="button"
          disabled={disabled}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.98 }}
          onMouseEnter={() => !disabled && setHovered(star)}
          onMouseLeave={() => setHovered(null)}
          onClick={() => onChange(star)}
          className={cn(
            'flex size-10 items-center justify-center rounded-full border text-lg transition-colors',
            star <= displayValue
              ? 'border-primary/30 bg-primary/10 text-primary'
              : 'border-border/60 bg-background/70 text-muted-foreground',
            disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:border-primary/25'
          )}
        >
          ★
        </motion.button>
      ))}
      {value && (
        <span className="ml-1 self-center text-sm text-muted-foreground">
          {value}/{max}
        </span>
      )}
    </div>
  )
}

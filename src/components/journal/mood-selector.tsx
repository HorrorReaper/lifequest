
'use client'

import { motion } from 'framer-motion'
import { MoodOption } from '@/lib/types'
import { cn } from '@/lib/utils'

interface MoodSelectorProps {
  options: MoodOption[]
  value: string | null
  onChange: (value: string) => void
  disabled?: boolean
}

export function MoodSelector({
  options,
  value,
  onChange,
  disabled = false,
}: MoodSelectorProps) {
  return (
    <div className="flex gap-2 flex-wrap">
      {options.map((option) => (
        <motion.button
          key={option.value}
          type="button"
          disabled={disabled}
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => onChange(option.value)}
          className={cn(
            'flex min-w-20 flex-col items-center gap-1 rounded-2xl border px-3 py-3 text-sm transition-colors',
            value === option.value
              ? 'border-primary/35 bg-primary/10 text-primary ring-2 ring-primary/10'
              : 'border-border/60 bg-background/70 hover:border-primary/25',
            disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
          )}
        >
          <span className="text-2xl">{option.emoji}</span>
          <span className="text-xs capitalize text-muted-foreground">
            {option.value}
          </span>
        </motion.button>
      ))}
    </div>
  )
}

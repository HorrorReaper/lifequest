
'use client'

import { motion } from 'framer-motion'
import { MoodOption } from '@/lib/types'

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
    // es wird über alle Optionen gemappt und diese Optionen dann angezeigt
  return (
    <div className="flex gap-2 flex-wrap">
      {options.map((option) => (
        <motion.button
          key={option.value}
          type="button"
          disabled={disabled}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => onChange(option.value)}
          className={`flex flex-col items-center gap-1 rounded-xl px-3 py-2 text-sm transition-colors border ${
            value === option.value
              ? 'border-primary bg-primary/10 ring-2 ring-primary/20'
              : 'border-border/50 hover:border-primary/30 bg-card'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
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

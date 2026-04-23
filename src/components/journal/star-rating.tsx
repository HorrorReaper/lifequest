
'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'

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
    <div className="flex gap-1">
      {Array.from({ length: max }, (_, i) => i + 1).map((star) => (
        <motion.button
          key={star}
          type="button"
          disabled={disabled}
          whileHover={{ scale: 1.2 }}
          whileTap={{ scale: 0.9 }}
          onMouseEnter={() => !disabled && setHovered(star)}
          onMouseLeave={() => setHovered(null)}
          onClick={() => onChange(star)}
          className={`text-2xl transition-colors ${
            disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
          }`}
        >
          {star <= displayValue ? '⭐' : '☆'}
        </motion.button>
      ))}
      {value && (
        <span className="ml-2 text-sm text-muted-foreground self-center">
          {value}/{max}
        </span>
      )}
    </div>
  )
}

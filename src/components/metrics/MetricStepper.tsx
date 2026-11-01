'use client'

import { Minus, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { isDecimalDraft, parseDecimal } from '@/lib/decimal'
import { applyStep } from '@/lib/metrics'
import { cn } from '@/lib/utils'

interface MetricStepperProps {
  /** What is typed, as text: "81,2" stays "81,2" until a step rewrites it. */
  value: string
  onChange: (value: string) => void
  step: number
  unit: string | null
  /** Names the field and its buttons: "Decrease {label}" / "Increase {label}". */
  label: string
  disabled?: boolean
}

/**
 * A number field with a minus and a plus button, so a value that moves a
 * little each day is logged in a tap instead of being typed.
 *
 * A text field with the decimal keyboard rather than type="number", for the
 * reason given in src/lib/decimal.ts. An empty field steps from 0.
 */
export function MetricStepper({
  value,
  onChange,
  step,
  unit,
  label,
  disabled = false,
}: MetricStepperProps) {
  function move(sign: 1 | -1) {
    onChange(String(applyStep(parseDecimal(value) ?? 0, step, sign)))
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        variant="outline"
        size="icon-lg"
        aria-label={`Decrease ${label}`}
        onClick={() => move(-1)}
        disabled={disabled}
      >
        <Minus />
      </Button>

      <div className="relative min-w-0 flex-1">
        <Input
          type="text"
          inputMode="decimal"
          autoComplete="off"
          aria-label={label}
          value={value}
          onChange={(event) => {
            if (isDecimalDraft(event.target.value)) onChange(event.target.value)
          }}
          disabled={disabled}
          className={cn('h-12 text-center text-xl font-semibold', unit && 'pr-14')}
        />
        {unit && (
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground">
            {unit}
          </span>
        )}
      </div>

      <Button
        type="button"
        variant="outline"
        size="icon-lg"
        aria-label={`Increase ${label}`}
        onClick={() => move(1)}
        disabled={disabled}
      >
        <Plus />
      </Button>
    </div>
  )
}

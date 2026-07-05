'use client'

import { Slider } from '@/components/ui/slider'

interface SliderInputProps {
  min: number
  max: number
  step?: number
  labels?: string[]
  value: number | null
  onChange: (value: number) => void
  disabled?: boolean
}

export function SliderInput({
  min = 1,
  max = 10,
  step = 1,
  labels,
  value,
  onChange,
  disabled = false,
}: SliderInputProps) {
  const currentValue = value ?? min

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-4 rounded-xl border bg-background/70 p-3">
        <Slider
          min={min}
          max={max}
          step={step}
          value={[currentValue]}
          onValueChange={(val) => onChange(Array.isArray(val) ? val[0] : val)}
          disabled={disabled}
          className="flex-1"
        />
        <span className="min-w-[2.5rem] text-center text-lg font-semibold text-primary">
          {currentValue}
        </span>
      </div>
      {labels && labels.length >= 2 && (
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{labels[0]}</span>
          <span>{labels[1]}</span>
        </div>
      )}
    </div>
  )
}

'use client'

import { useState, type ComponentProps } from 'react'
import { Input } from '@/components/ui/input'
import { isDecimalDraft, parseDecimal } from '@/lib/decimal'

type DecimalInputProps = Omit<ComponentProps<typeof Input>, 'value' | 'onChange' | 'type' | 'inputMode'> & {
  value: number | null
  onValueChange: (value: number | null) => void
}

/**
 * A number field that takes decimals with a comma or a point ("72,5") and
 * shows the phone's decimal keyboard. See src/lib/decimal.ts for why it is a
 * text field rather than type="number".
 *
 * Keeps what is being typed ("72," on the way to "72,5") as text and reports
 * the parsed number (or null) on every change. A value set from outside, such
 * as a restored draft, replaces the text only when it is a different number.
 */
export function DecimalInput({ value, onValueChange, ...props }: DecimalInputProps) {
  const [text, setText] = useState(value === null ? '' : String(value))
  const [previousValue, setPreviousValue] = useState(value)

  // Only a change of the prop itself is news from outside. The parent
  // echoing back what was just typed ("72," -> 72) matches the text and
  // leaves it alone.
  if (value !== previousValue) {
    setPreviousValue(value)
    if (value !== parseDecimal(text)) setText(value === null ? '' : String(value))
  }

  return (
    <Input
      {...props}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      value={text}
      onChange={(event) => {
        const next = event.target.value
        if (!isDecimalDraft(next)) return
        setText(next)
        onValueChange(parseDecimal(next))
      }}
    />
  )
}

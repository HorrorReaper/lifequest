"use client"

import { Check, Loader2 } from "lucide-react"

import { cn } from "@/lib/utils"

interface CompletionToggleProps {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  /** The item's own name; the label becomes "Complete …" or "Reopen …". */
  itemLabel: string
  disabled?: boolean
  busy?: boolean
  className?: string
}

/**
 * The one control that marks an item done or not done.
 *
 * A plain button with role="checkbox" rather than the Checkbox primitive,
 * which pairs its visible box with a hidden native input. That pair showed up
 * in accessibility tooling as two checkboxes per task, one of them unnamed.
 * Here there is exactly one element, it has a name that says what pressing it
 * does, and the hit area is 44px even though the circle is smaller.
 */
export function CompletionToggle({
  checked,
  onCheckedChange,
  itemLabel,
  disabled = false,
  busy = false,
  className,
}: CompletionToggleProps) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={checked ? `Reopen ${itemLabel}` : `Complete ${itemLabel}`}
      aria-busy={busy || undefined}
      disabled={disabled || busy}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "group/toggle -m-2 flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full outline-none disabled:cursor-not-allowed",
        className
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "flex size-7 items-center justify-center rounded-full border-2 transition-colors",
          "group-focus-visible/toggle:ring-3 group-focus-visible/toggle:ring-ring/50 group-disabled/toggle:opacity-50",
          checked
            ? "border-primary bg-primary text-primary-foreground"
            : "border-muted-foreground/45 bg-background group-hover/toggle:border-primary"
        )}
      >
        {busy ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          checked && <Check className="size-4" strokeWidth={3} />
        )}
      </span>
    </button>
  )
}

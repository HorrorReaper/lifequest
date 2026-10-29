import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

interface ProgressRingProps {
  /** How full the ring is, from 0 to 1. Values outside are clamped. */
  value: number
  /** Outer size in pixels. */
  size?: number
  strokeWidth?: number
  /** Shown in the middle, e.g. "3/14". */
  children?: ReactNode
  /**
   * Colours the filled arc through `currentColor`, e.g. "text-primary".
   * The track always uses the theme's muted colour.
   */
  className?: string
}

/**
 * A flat progress ring with an optional label in its centre.
 *
 * Decorative on its own (`aria-hidden`): whatever it shows has to be said in
 * the text next to it, which is where a screen reader looks.
 */
export function ProgressRing({
  value,
  size = 56,
  strokeWidth = 6,
  children,
  className,
}: ProgressRingProps) {
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const clamped = Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0))

  return (
    <span
      aria-hidden="true"
      data-slot="progress-ring"
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center text-primary",
        className
      )}
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--muted)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - clamped)}
        />
      </svg>
      {children !== undefined && (
        <span className="absolute inset-0 flex items-center justify-center text-xs font-semibold text-foreground tabular-nums">
          {children}
        </span>
      )}
    </span>
  )
}

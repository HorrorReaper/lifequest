import * as React from "react"

import { cn } from "@/lib/utils"

interface PageHeaderProps {
  title: React.ReactNode
  /** A short line above the title, e.g. today's date. */
  eyebrow?: React.ReactNode
  description?: React.ReactNode
  /**
   * The page's main action, e.g. "Add habit". It sits in the header so it is
   * reachable at the top of the page on every width -- never at the bottom,
   * where the fixed navigation covers it on a phone.
   */
  actions?: React.ReactNode
  className?: string
}

/**
 * The title block every main page starts with.
 *
 * One size for page titles (28px, 32px from sm), one for the supporting line
 * (16px), and the action aligned to the title on wide screens and stacked
 * under it on narrow ones, so pages stop choosing their own.
 */
export function PageHeader({
  title,
  eyebrow,
  description,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <header
      className={cn(
        "flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between",
        className
      )}
    >
      <div className="min-w-0">
        {eyebrow && (
          <p className="text-sm font-medium text-muted-foreground">{eyebrow}</p>
        )}
        <h1 className="font-heading text-[1.75rem] leading-tight font-semibold tracking-tight sm:text-[2rem]">
          {title}
        </h1>
        {description && (
          <p className="mt-1 max-w-[42rem] text-base leading-relaxed text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      {actions && (
        <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
      )}
    </header>
  )
}

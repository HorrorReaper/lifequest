"use client"

import * as React from "react"
import { Popover as PopoverPrimitive } from "@base-ui/react/popover"

import { cn } from "@/lib/utils"

function Popover(props: React.ComponentProps<typeof PopoverPrimitive.Root>) {
  return <PopoverPrimitive.Root {...props} />
}

function PopoverTrigger(
  props: React.ComponentProps<typeof PopoverPrimitive.Trigger>
) {
  return <PopoverPrimitive.Trigger {...props} />
}

function PopoverContent({
  className,
  sideOffset = 8,
  align = "start",
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Popup> & {
  sideOffset?: number
  align?: "start" | "center" | "end"
}) {
  return (
    <PopoverPrimitive.Portal>
      {/* The layer goes on the positioner, not the popup. The positioner is
          the absolutely positioned box the popup lives in, so a z-index on
          the popup alone only orders it inside that box -- the box itself
          stayed at the page's base layer and a dialog (z-50) covered it,
          calendar and all, while clicks fell through to the dialog. Above
          z-50 on purpose: a popover is usually opened from inside a dialog.
          collisionPadding keeps it on screen in a short window, where it
          flips above its trigger instead of running off the bottom. */}
      <PopoverPrimitive.Positioner
        sideOffset={sideOffset}
        align={align}
        collisionPadding={12}
        className="isolate z-[90]"
      >
        <PopoverPrimitive.Popup
          className={cn(
            // Capped to the room the positioner measured, scrolling inside
            // it: in a short window (200 % zoom) neither side of the trigger
            // fits a calendar, and it used to flip up and run off the top.
            "max-h-(--available-height) overflow-y-auto rounded-xl border bg-popover p-3 text-popover-foreground shadow-lg outline-none",
            "origin-[var(--transform-origin)] transition-[transform,opacity] data-[ending-style]:opacity-0 data-[starting-style]:opacity-0",
            className
          )}
          {...props}
        />
      </PopoverPrimitive.Positioner>
    </PopoverPrimitive.Portal>
  )
}

export { Popover, PopoverTrigger, PopoverContent }

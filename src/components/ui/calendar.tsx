"use client"

import * as React from "react"
import { DayPicker } from "react-day-picker"
import { ChevronLeft, ChevronRight } from "lucide-react"

import { cn } from "@/lib/utils"

// Deliberately does NOT import react-day-picker/dist/style.css.
//
// That stylesheet is why the previous picker looked foreign: it paints its own
// blues and greys, which sit wrong on the cream Trail card and on Dark. Every
// class below is one of the app's own tokens instead, so the calendar follows
// whichever of the five themes is active.

export type CalendarProps = React.ComponentProps<typeof DayPicker>

export function Calendar({ className, classNames, ...props }: CalendarProps) {
  return (
    <DayPicker
      className={cn("w-fit select-none", className)}
      classNames={{
        months: "flex flex-col gap-4",
        month: "flex flex-col gap-3",
        month_caption: "flex h-8 items-center justify-center",
        caption_label: "text-sm font-medium",
        nav: "flex items-center justify-between absolute inset-x-0 top-0 h-8",
        button_previous:
          "flex size-8 items-center justify-center rounded-lg border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40",
        button_next:
          "flex size-8 items-center justify-center rounded-lg border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40",
        month_grid: "w-full border-collapse",
        weekdays: "flex",
        weekday:
          "w-9 text-[0.7rem] font-medium uppercase tracking-wide text-muted-foreground",
        week: "mt-1 flex w-full",
        day: "p-0",
        day_button: cn(
          "flex size-9 items-center justify-center rounded-lg text-sm tabular-nums transition-colors",
          "hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        ),
        today: "font-semibold text-primary",
        selected:
          "[&>button]:bg-primary [&>button]:text-primary-foreground [&>button]:hover:bg-primary",
        // Days spilling in from the neighbouring months read as context, not
        // as something you meant to pick.
        outside: "[&>button]:text-muted-foreground/50",
        disabled: "opacity-40",
        hidden: "invisible",
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation, ...chevronProps }) =>
          orientation === "left" ? (
            <ChevronLeft className="size-4" {...chevronProps} />
          ) : (
            <ChevronRight className="size-4" {...chevronProps} />
          ),
      }}
      {...props}
    />
  )
}

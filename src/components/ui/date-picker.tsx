"use client"

import * as React from "react"
import { CalendarDays } from "lucide-react"
import { format } from "date-fns"

import { localDateKey, parseLocalDate } from "@/lib/dates"
import { cn } from "@/lib/utils"
import { Calendar } from "@/components/ui/calendar"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

export interface DatePickerProps {
  /** A `YYYY-MM-DD` date key, or null when unset. */
  value: string | null
  onChange: (value: string | null) => void
  id?: string
  placeholder?: string
  disabled?: boolean
  className?: string
}

/**
 * A due-date field that shows a themed calendar on pointer devices and the
 * platform's own date control on phones.
 *
 * The split is deliberate rather than a shortcut. A native `<input type="date">`
 * is the weaker control on desktop -- it only opens from a small icon and it
 * cannot be themed -- but on a phone it opens the OS wheel, which is faster
 * than any calendar grid and already familiar. This app is mobile-first, so
 * neither control wins everywhere and each is used where it is better.
 *
 * Both branches speak the same `YYYY-MM-DD` date key, and both go through
 * `localDateKey`/`parseLocalDate` so a timezone offset can never shift the
 * chosen day -- the bug this file used to have when it serialised with
 * `toISOString()`.
 */
export function DatePicker({
  value,
  onChange,
  id,
  placeholder = "Pick a date",
  disabled = false,
  className,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false)
  const selected = value ? parseLocalDate(value) ?? undefined : undefined

  return (
    <>
      {/* Phones: the platform control, which opens on tap by itself. */}
      <Input
        id={id}
        type="date"
        value={value ?? ""}
        onChange={(event) => onChange(event.target.value || null)}
        disabled={disabled}
        className={cn("h-12 sm:hidden", className)}
      />

      {/* Pointer devices: the themed calendar. */}
      <div className={cn("hidden sm:block", className)}>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger
            type="button"
            disabled={disabled}
            className={cn(
              "flex h-10 w-full items-center gap-2 rounded-md border border-input bg-background px-3 text-left text-sm transition-colors",
              "hover:border-foreground/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50",
              !selected && "text-muted-foreground"
            )}
          >
            <CalendarDays className="size-4 shrink-0 text-muted-foreground" />
            {selected ? format(selected, "PPP") : placeholder}
          </PopoverTrigger>

          <PopoverContent>
            <Calendar
              mode="single"
              autoFocus
              selected={selected}
              defaultMonth={selected}
              onSelect={(date) => {
                onChange(date ? localDateKey(date) : null)
                setOpen(false)
              }}
            />
            {value && (
              <button
                type="button"
                onClick={() => {
                  onChange(null)
                  setOpen(false)
                }}
                className="mt-2 w-full rounded-lg border py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                Clear date
              </button>
            )}
          </PopoverContent>
        </Popover>
      </div>
    </>
  )
}

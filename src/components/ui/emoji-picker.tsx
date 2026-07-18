"use client"

import { useMemo, useState } from "react"
import { Search, SmilePlus, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

interface EmojiPickerProps {
  value: string
  onChange: (emoji: string) => void
  label?: string
  className?: string
  disabled?: boolean
}

interface EmojiCategory {
  id: string
  label: string
  emojis: string[]
}

const EMOJI_CATEGORIES: EmojiCategory[] = [
  {
    id: "popular",
    label: "Popular",
    emojis: ["✅", "🔥", "💪", "🧘", "💧", "📖", "🏃", "🥗", "😴", "🎯", "🧠", "🙏", "☕", "💻", "🎵", "🌅", "⭐", "⚡"],
  },
  {
    id: "smileys",
    label: "Smileys",
    emojis: ["😀", "😄", "😊", "🙂", "😌", "😍", "🤩", "😎", "🥳", "😇", "🤗", "🤔", "😤", "😭", "😴", "🤯", "🥶", "😮‍💨"],
  },
  {
    id: "people",
    label: "People",
    emojis: ["🙏", "👏", "🙌", "🤝", "👍", "👊", "✌️", "🤞", "🫶", "👀", "🗣️", "👥", "🧑‍💻", "🧑‍🎓", "🧑‍🍳", "🧑‍🔬", "🧑‍🎨", "🦸"],
  },
  {
    id: "body",
    label: "Body",
    emojis: ["💪", "🏋️", "🏃", "🚶", "🚴", "🏊", "🤸", "🧘", "🥊", "⚽", "🏀", "🎾", "🥾", "🫀", "🫁", "🦵", "🦶", "🧊"],
  },
  {
    id: "health",
    label: "Health",
    emojis: ["🥗", "🍎", "🍌", "🥑", "🥦", "🥕", "🍳", "🍚", "🥩", "🐟", "💧", "🫖", "😴", "🛏️", "🧼", "🦷", "🧴", "🌿"],
  },
  {
    id: "food",
    label: "Food",
    emojis: ["🍽️", "🥣", "🥤", "🍵", "☕", "🍯", "🥜", "🍓", "🫐", "🍊", "🍋", "🍠", "🥬", "🍗", "🥚", "🧀", "🍫", "🍪"],
  },
  {
    id: "mind",
    label: "Mind",
    emojis: ["🧠", "📖", "✍️", "📝", "📚", "🎧", "🧘", "🙏", "🌱", "🕯️", "💭", "🧩", "🔍", "🎓", "🗣️", "❤️", "🤝", "😊"],
  },
  {
    id: "work",
    label: "Work",
    emojis: ["💻", "⌨️", "📅", "🗓️", "📌", "📍", "📊", "📈", "📬", "📞", "🧾", "🛠️", "🚀", "💡", "🧪", "🧱", "🏆", "🎯"],
  },
  {
    id: "life",
    label: "Life",
    emojis: ["🏠", "🧹", "🧺", "🛒", "🍽️", "🪴", "🐶", "🚗", "🚌", "✈️", "💸", "🎁", "🎨", "🎸", "🎮", "📷", "🌍", "🌙"],
  },
  {
    id: "nature",
    label: "Nature",
    emojis: ["🌱", "🌿", "🍀", "🌳", "🌵", "🌸", "🌻", "🌞", "🌙", "⭐", "☁️", "🌧️", "🌈", "🌊", "🔥", "❄️", "⛰️", "🪨"],
  },
  {
    id: "symbols",
    label: "Symbols",
    emojis: ["✅", "☑️", "✔️", "➕", "➖", "🔁", "🔒", "🔓", "⏰", "⏳", "⌛", "⚡", "🔥", "⭐", "💎", "🟢", "🟡", "🔴"],
  },
]

const SEARCH_LABELS: Record<string, string> = {
  "✅": "check done complete success habit",
  "🔥": "fire streak energy intensity",
  "💪": "muscle strength gym bodybuilding",
  "🧘": "meditation calm mindfulness yoga",
  "💧": "water hydration drink",
  "📖": "reading book learn",
  "🏃": "running cardio exercise",
  "🥗": "salad nutrition healthy food",
  "😴": "sleep rest recovery",
  "🎯": "target focus goal",
  "🧠": "brain thinking learning focus",
  "🙏": "gratitude prayer reflection",
  "☕": "coffee caffeine morning",
  "💻": "coding computer work",
  "🎵": "music practice",
  "🌅": "morning sunrise routine",
  "🏋️": "lifting weights workout gym",
  "✍️": "writing journal notes",
  "📅": "calendar planning schedule",
  "🚀": "startup launch progress",
  "💡": "idea creativity insight",
}

const ALL_EMOJIS = EMOJI_CATEGORIES.flatMap((category) =>
  category.emojis.map((emoji) => ({
    emoji,
    category: category.id,
    label: SEARCH_LABELS[emoji] ?? emoji,
  }))
)

const UNIQUE_EMOJIS = Array.from(
  new Map(ALL_EMOJIS.map((item) => [item.emoji, item])).values()
)

export function EmojiPicker({
  value,
  onChange,
  label = "Choose emoji",
  className,
  disabled = false,
}: EmojiPickerProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [activeCategory, setActiveCategory] = useState(EMOJI_CATEGORIES[0].id)

  const visibleEmojis = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    if (normalizedQuery) {
      return UNIQUE_EMOJIS.filter((item) =>
        `${item.emoji} ${item.label}`.toLowerCase().includes(normalizedQuery)
      )
    }

    return EMOJI_CATEGORIES.find((category) => category.id === activeCategory)?.emojis.map((emoji) => ({
      emoji,
      category: activeCategory,
      label: SEARCH_LABELS[emoji] ?? emoji,
    })) ?? []
  }, [activeCategory, query])

  function selectEmoji(emoji: string) {
    onChange(emoji)
    setOpen(false)
    setQuery("")
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen)
    if (!nextOpen) setQuery("")
  }

  return (
    <div className={className}>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogTrigger
          disabled={disabled}
          render={
            <Button
              type="button"
              variant="outline"
              aria-label={label}
              aria-expanded={open}
              className="h-10 w-14 shrink-0 rounded-md px-0 text-xl sm:h-9"
            />
          }
        >
          {value || <SmilePlus className="size-5" />}
        </DialogTrigger>

        <DialogContent
          showCloseButton={false}
          className="bottom-[calc(var(--safe-area-bottom)+0.75rem)] top-auto flex max-h-[calc(100svh-1.5rem-var(--safe-area-bottom))] w-[calc(100%-1.5rem)] max-w-sm translate-y-0 flex-col gap-0 overflow-hidden rounded-2xl p-3 shadow-xl sm:bottom-auto sm:top-1/2 sm:max-h-[min(30rem,calc(100svh-2rem))] sm:-translate-y-1/2"
        >
          <DialogHeader className="mb-3 flex-row items-center justify-between gap-3 text-left">
            <DialogTitle className="text-sm font-semibold">Choose an icon</DialogTitle>
            <DialogClose
              render={
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Close emoji picker"
                  className="shrink-0 rounded-full"
                />
              }
            >
              <X className="size-4" />
            </DialogClose>
          </DialogHeader>

          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search emoji"
              className="h-10 pl-9"
            />
          </div>

          <div className="mt-2 flex shrink-0 gap-1 overflow-x-auto pb-1 sm:mt-3">
            {EMOJI_CATEGORIES.map((category) => (
              <button
                key={category.id}
                type="button"
                onClick={() => {
                  setActiveCategory(category.id)
                  setQuery("")
                }}
                className={cn(
                  "shrink-0 rounded-full px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors",
                  activeCategory === category.id && !query
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted/70 hover:bg-muted hover:text-foreground"
                )}
              >
                {category.label}
              </button>
            ))}
          </div>

          <div className="mt-2 grid min-h-0 max-h-44 grid-cols-6 gap-1 overflow-y-auto overscroll-contain pr-1 sm:mt-3 sm:max-h-56">
            {visibleEmojis.map((item) => (
              <button
                key={`${item.category}-${item.emoji}`}
                type="button"
                title={item.label}
                aria-label={`Use ${item.emoji}`}
                onClick={() => selectEmoji(item.emoji)}
                className={cn(
                  "grid size-9 place-items-center justify-self-center rounded-xl text-xl transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:size-10",
                  value === item.emoji && "bg-primary/10 ring-1 ring-primary/30"
                )}
              >
                {item.emoji}
              </button>
            ))}
          </div>

          {visibleEmojis.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No emoji found.
            </p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

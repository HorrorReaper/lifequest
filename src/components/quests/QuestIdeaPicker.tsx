'use client'

import { useState } from 'react'
import { Check, Coins, Plus, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { QUEST_IDEA_CATEGORIES, QUEST_IDEAS, type QuestIdea } from '@/lib/quest-ideas'

interface QuestIdeaPickerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAdd: (idea: QuestIdea) => Promise<void>
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return 'Could not create this quest.'
}

export function QuestIdeaPicker({ open, onOpenChange, onAdd }: QuestIdeaPickerProps) {
  const [addingId, setAddingId] = useState<string | null>(null)
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set())
  const [errors, setErrors] = useState<Record<string, string>>({})

  async function handleAdd(idea: QuestIdea) {
    setAddingId(idea.id)
    setErrors((prev) => {
      const next = { ...prev }
      delete next[idea.id]
      return next
    })
    try {
      await onAdd(idea)
      setAddedIds((prev) => new Set(prev).add(idea.id))
    } catch (error) {
      setErrors((prev) => ({ ...prev, [idea.id]: getErrorMessage(error) }))
    } finally {
      setAddingId(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg gap-3 sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Browse quest ideas</DialogTitle>
          <DialogDescription>
            Tap a quest to add it to your list. You can add as many as you like.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] space-y-5 overflow-y-auto pr-1">
          {QUEST_IDEA_CATEGORIES.map((category) => (
            <div key={category} className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {category}
              </p>
              <div className="space-y-2">
                {QUEST_IDEAS.filter((idea) => idea.category === category).map((idea) => {
                  const added = addedIds.has(idea.id)
                  const adding = addingId === idea.id
                  const error = errors[idea.id]
                  return (
                    <div
                      key={idea.id}
                      data-slot="quest-idea-row"
                      className="rounded-xl border border-border/60 p-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold">{idea.title}</p>
                          <p className="mt-0.5 text-xs text-muted-foreground">{idea.description}</p>
                          <div className="mt-1.5 flex items-center gap-3">
                            <span className="flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-400">
                              <Zap className="size-3" />
                              {idea.xpReward}
                            </span>
                            <span className="flex items-center gap-1 text-xs font-medium text-yellow-600 dark:text-yellow-400">
                              <Coins className="size-3" />
                              {idea.coinReward}
                            </span>
                          </div>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant={added ? 'secondary' : 'outline'}
                          disabled={added || adding}
                          onClick={() => handleAdd(idea)}
                          className="shrink-0"
                          aria-label={added ? `Added "${idea.title}"` : `Add "${idea.title}"`}
                        >
                          {added ? (
                            <Check className="size-4" />
                          ) : (
                            <Plus className="size-4" />
                          )}
                          {added ? 'Added' : adding ? 'Adding…' : 'Add'}
                        </Button>
                      </div>
                      {error && (
                        <p className="mt-1.5 text-xs text-red-500">{error}</p>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}

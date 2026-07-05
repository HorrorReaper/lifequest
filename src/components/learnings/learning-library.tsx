'use client'

import Link from 'next/link'
import { useDeferredValue, useMemo, useState } from 'react'
import { ArrowUpDown, BookOpenCheck, Search, Star, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { supabaseFrom } from '@/lib/supabase/helpers'
import type { JournalLearning } from '@/lib/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

export interface LearningLibraryItem extends JournalLearning {
  journal_entries?: {
    entry_date: string
    journal_templates?: {
      name: string | null
      icon: string | null
    } | null
  } | null
}

interface LearningLibraryProps {
  learnings: LearningLibraryItem[]
}

type SortMode = 'newest' | 'oldest' | 'favorites'

function formatDate(date: string) {
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function LearningLibrary({ learnings: initialLearnings }: LearningLibraryProps) {
  const supabase = createClient()
  const [learnings, setLearnings] = useState(initialLearnings)
  const [query, setQuery] = useState('')
  const [tag, setTag] = useState('all')
  const [favoritesOnly, setFavoritesOnly] = useState(false)
  const [sortMode, setSortMode] = useState<SortMode>('newest')
  const [message, setMessage] = useState<string | null>(null)
  const deferredQuery = useDeferredValue(query.trim().toLowerCase())

  const tags = useMemo(
    () => [...new Set(learnings.flatMap((learning) => learning.tags))].sort(),
    [learnings]
  )

  const filteredLearnings = useMemo(() => {
    return learnings
      .filter((learning) => {
        if (tag !== 'all' && !learning.tags.includes(tag)) return false
        if (favoritesOnly && !learning.is_favorite) return false

        if (!deferredQuery) return true

        const searchable = [
          learning.title,
          learning.note,
          learning.action_text,
          learning.created_at,
          learning.journal_entries?.entry_date,
          learning.journal_entries?.journal_templates?.name,
          ...learning.tags,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()

        return searchable.includes(deferredQuery)
      })
      .sort((a, b) => {
        if (sortMode === 'favorites') {
          if (a.is_favorite !== b.is_favorite) return a.is_favorite ? -1 : 1
        }
        const aTime = new Date(a.created_at).getTime()
        const bTime = new Date(b.created_at).getTime()
        return sortMode === 'oldest' ? aTime - bTime : bTime - aTime
      })
  }, [deferredQuery, favoritesOnly, learnings, sortMode, tag])

  async function toggleFavorite(learning: LearningLibraryItem) {
    const nextFavorite = !learning.is_favorite
    setLearnings((current) =>
      current.map((item) =>
        item.id === learning.id ? { ...item, is_favorite: nextFavorite } : item
      )
    )

    const { error } = await supabaseFrom(supabase, 'journal_learnings')
      .update({ is_favorite: nextFavorite, updated_at: new Date().toISOString() })
      .eq('id', learning.id)
      .eq('user_id', learning.user_id)

    if (error) {
      setLearnings((current) =>
        current.map((item) =>
          item.id === learning.id ? { ...item, is_favorite: learning.is_favorite } : item
        )
      )
      setMessage('Could not update favorite state.')
    }
  }

  const clearFilters = () => {
    setQuery('')
    setTag('all')
    setFavoritesOnly(false)
    setSortMode('newest')
  }

  const hasActiveFilters = query || tag !== 'all' || favoritesOnly || sortMode !== 'newest'

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-card p-3 shadow-sm">
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search learnings, tags, actions, or source entries..."
              className="h-9 pl-8"
            />
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={clearFilters}
            disabled={!hasActiveFilters}
            className="h-9 justify-self-start sm:justify-self-end"
          >
            <X className="size-3.5" />
            Reset
          </Button>
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <label className="space-y-1.5 text-xs font-medium text-muted-foreground">
            Tag
            <select
              value={tag}
              onChange={(event) => setTag(event.target.value)}
              className="h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm text-foreground outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <option value="all">All tags</option>
              {tags.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1.5 text-xs font-medium text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <ArrowUpDown className="size-3.5" />
              Sort
            </span>
            <select
              value={sortMode}
              onChange={(event) => setSortMode(event.target.value as SortMode)}
              className="h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm text-foreground outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="favorites">Favorites first</option>
            </select>
          </label>

          <Button
            type="button"
            variant={favoritesOnly ? 'default' : 'outline'}
            onClick={() => setFavoritesOnly((current) => !current)}
            className="mt-5 h-9 justify-self-start sm:justify-self-stretch"
          >
            <Star className={favoritesOnly ? 'size-3.5 fill-current' : 'size-3.5'} />
            Favorites
          </Button>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 text-sm">
        <p className="text-muted-foreground">
          Showing <span className="font-medium text-foreground">{filteredLearnings.length}</span>{' '}
          of <span className="font-medium text-foreground">{learnings.length}</span> learnings
        </p>
        {message && <p className="text-xs text-muted-foreground">{message}</p>}
      </div>

      {filteredLearnings.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border/60 p-8 text-center">
          <BookOpenCheck className="mx-auto mb-3 size-8 text-muted-foreground" />
          <p className="text-sm font-medium">No learnings found</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Save a lesson from a journal entry or clear your filters.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredLearnings.map((learning) => {
            const source = learning.journal_entries
            const template = source?.journal_templates

            return (
              <Card key={learning.id} className="border-border/60 transition-colors hover:border-primary/25">
                <CardContent className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium">{learning.title}</p>
                      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                        {learning.note}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={learning.is_favorite ? 'Remove favorite' : 'Mark favorite'}
                      onClick={() => toggleFavorite(learning)}
                    >
                      <Star
                        className={
                          learning.is_favorite
                            ? 'size-4 fill-primary text-primary'
                            : 'size-4 text-muted-foreground'
                        }
                      />
                    </Button>
                  </div>

                  {learning.action_text && (
                    <div className="rounded-lg bg-primary/10 px-3 py-2 text-sm text-primary">
                      Action: {learning.action_text}
                    </div>
                  )}

                  <div className="flex flex-wrap gap-1">
                    {learning.tags.map((item) => (
                      <Badge key={item} variant="secondary">
                        {item}
                      </Badge>
                    ))}
                  </div>

                  <div className="flex items-center justify-between gap-3 border-t pt-3 text-xs text-muted-foreground">
                    <span>
                      {template?.icon ?? '📓'} {template?.name ?? 'Journal Entry'} ·{' '}
                      {source?.entry_date ? formatDate(source.entry_date) : formatDate(learning.created_at)}
                    </span>
                    <Link
                      href={`/journal/${learning.entry_id}`}
                      className="font-medium text-primary hover:underline"
                    >
                      Open source
                    </Link>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

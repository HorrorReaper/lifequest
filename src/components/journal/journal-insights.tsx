'use client'

import Link from 'next/link'
import { useDeferredValue, useMemo, useState } from 'react'
import {
  ArrowUpDown,
  BookOpenCheck,
  CheckCircle2,
  CircleAlert,
  Lightbulb,
  Search,
  Star,
  X,
} from 'lucide-react'
import type { InsightType } from '@/lib/types'
import { INSIGHT_TYPES, insightTypeLabel } from '@/lib/insights'
import { createClient } from '@/lib/supabase/client'
import { supabaseFrom } from '@/lib/supabase/helpers'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

export interface JournalInsightItem {
  id: string
  source: 'response' | 'legacy'
  sourceId: string
  entryId: string
  fieldId: string | null
  type: InsightType
  title: string | null
  answer: string
  prompt: string | null
  tags: string[]
  actionText: string | null
  isFavorite: boolean
  markedAt: string
  entryDate: string
  template: {
    id: string | null
    name: string | null
    icon: string | null
  } | null
}

interface JournalInsightsProps {
  insights: JournalInsightItem[]
}

type SortMode = 'newest' | 'oldest' | 'favorites'
type TypeFilter = 'all' | InsightType

const TYPE_ICONS = {
  learning: BookOpenCheck,
  problem: CircleAlert,
  idea: Lightbulb,
  decision: CheckCircle2,
} satisfies Record<InsightType, typeof BookOpenCheck>

const TYPE_STYLES = {
  learning: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  problem: 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
  idea: 'bg-sky-500/10 text-sky-700 dark:text-sky-300',
  decision: 'bg-primary/10 text-primary',
} satisfies Record<InsightType, string>

function formatDate(date: string) {
  return new Date(`${date.slice(0, 10)}T12:00:00`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function JournalInsights({ insights: initialInsights }: JournalInsightsProps) {
  const supabase = createClient()
  const [insights, setInsights] = useState(initialInsights)
  const [query, setQuery] = useState('')
  const [type, setType] = useState<TypeFilter>('all')
  const [tag, setTag] = useState('all')
  const [templateId, setTemplateId] = useState('all')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [favoritesOnly, setFavoritesOnly] = useState(false)
  const [sortMode, setSortMode] = useState<SortMode>('newest')
  const [message, setMessage] = useState<string | null>(null)
  const deferredQuery = useDeferredValue(query.trim().toLowerCase())

  const tags = useMemo(
    () => [...new Set(insights.flatMap((insight) => insight.tags))].sort(),
    [insights]
  )
  const templates = useMemo(
    () => [
      ...new Map(
        insights
          .filter((insight) => insight.template?.id)
          .map((insight) => [insight.template!.id!, insight.template!])
      ).values(),
    ],
    [insights]
  )

  const filteredInsights = useMemo(() => {
    return insights
      .filter((insight) => {
        if (type !== 'all' && insight.type !== type) return false
        if (tag !== 'all' && !insight.tags.includes(tag)) return false
        if (templateId !== 'all' && insight.template?.id !== templateId) return false
        if (startDate && insight.entryDate < startDate) return false
        if (endDate && insight.entryDate > endDate) return false
        if (favoritesOnly && !insight.isFavorite) return false

        if (!deferredQuery) return true

        return [
          insight.title,
          insight.answer,
          insight.prompt,
          insight.actionText,
          insightTypeLabel(insight.type),
          insight.template?.name,
          insight.entryDate,
          ...insight.tags,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(deferredQuery)
      })
      .sort((a, b) => {
        if (sortMode === 'favorites' && a.isFavorite !== b.isFavorite) {
          return a.isFavorite ? -1 : 1
        }
        const aTime = new Date(a.markedAt).getTime()
        const bTime = new Date(b.markedAt).getTime()
        return sortMode === 'oldest' ? aTime - bTime : bTime - aTime
      })
  }, [
    deferredQuery,
    endDate,
    favoritesOnly,
    insights,
    sortMode,
    startDate,
    tag,
    templateId,
    type,
  ])

  async function toggleFavorite(insight: JournalInsightItem) {
    const nextFavorite = !insight.isFavorite
    setMessage(null)
    setInsights((current) =>
      current.map((item) =>
        item.id === insight.id ? { ...item, isFavorite: nextFavorite } : item
      )
    )

    const { error } =
      insight.source === 'response'
        ? await supabaseFrom(supabase, 'journal_responses')
            .update({ insight_is_favorite: nextFavorite })
            .eq('id', insight.sourceId)
        : await supabaseFrom(supabase, 'journal_learnings')
            .update({
              is_favorite: nextFavorite,
              updated_at: new Date().toISOString(),
            })
            .eq('id', insight.sourceId)

    if (error) {
      setInsights((current) =>
        current.map((item) =>
          item.id === insight.id ? { ...item, isFavorite: insight.isFavorite } : item
        )
      )
      setMessage('Could not update favorite state.')
    }
  }

  function clearFilters() {
    setQuery('')
    setType('all')
    setTag('all')
    setTemplateId('all')
    setStartDate('')
    setEndDate('')
    setFavoritesOnly(false)
    setSortMode('newest')
  }

  const hasFilters =
    query ||
    type !== 'all' ||
    tag !== 'all' ||
    templateId !== 'all' ||
    startDate ||
    endDate ||
    favoritesOnly ||
    sortMode !== 'newest'

  return (
    <div className="space-y-5">
      <div className="flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Insight types">
        <button
          type="button"
          role="tab"
          aria-selected={type === 'all'}
          onClick={() => setType('all')}
          className={cn(
            'h-10 shrink-0 rounded-full border px-4 text-sm font-medium transition-colors',
            type === 'all'
              ? 'border-primary bg-primary text-primary-foreground'
              : 'border-border/60 bg-background text-muted-foreground hover:text-foreground'
          )}
        >
          All
        </button>
        {INSIGHT_TYPES.map((item) => {
          const Icon = TYPE_ICONS[item.value]
          return (
            <button
              key={item.value}
              type="button"
              role="tab"
              aria-selected={type === item.value}
              onClick={() => setType(item.value)}
              className={cn(
                'flex h-10 shrink-0 items-center gap-1.5 rounded-full border px-4 text-sm font-medium transition-colors',
                type === item.value
                  ? TYPE_STYLES[item.value]
                  : 'border-border/60 bg-background text-muted-foreground hover:text-foreground'
              )}
            >
              <Icon className="size-3.5" />
              {item.label}
            </button>
          )
        })}
      </div>

      <div className="rounded-2xl border bg-card/80 p-3 shadow-sm">
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search answers, prompts, topics, or templates..."
              className="h-11 rounded-xl pl-9"
            />
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={clearFilters}
            disabled={!hasFilters}
            className="h-11 rounded-xl"
          >
            <X className="size-3.5" />
            Reset
          </Button>
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="space-y-1.5 text-xs font-medium text-muted-foreground">
            Topic
            <select
              value={tag}
              onChange={(event) => setTag(event.target.value)}
              className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <option value="all">All topics</option>
              {tags.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </label>

          <label className="space-y-1.5 text-xs font-medium text-muted-foreground">
            Template
            <select
              value={templateId}
              onChange={(event) => setTemplateId(event.target.value)}
              className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <option value="all">All templates</option>
              {templates.map((template) => (
                <option key={template.id} value={template.id ?? ''}>
                  {template.icon ?? '📓'} {template.name ?? 'Journal'}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1.5 text-xs font-medium text-muted-foreground">
            From
            <Input
              type="date"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
              className="h-10 rounded-xl"
            />
          </label>

          <label className="space-y-1.5 text-xs font-medium text-muted-foreground">
            To
            <Input
              type="date"
              value={endDate}
              onChange={(event) => setEndDate(event.target.value)}
              className="h-10 rounded-xl"
            />
          </label>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant={favoritesOnly ? 'default' : 'outline'}
            onClick={() => setFavoritesOnly((current) => !current)}
          >
            <Star className={cn('size-3.5', favoritesOnly && 'fill-current')} />
            Favorites
          </Button>
          <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <ArrowUpDown className="size-3.5" />
            <select
              value={sortMode}
              onChange={(event) => setSortMode(event.target.value as SortMode)}
              className="h-8 rounded-lg border border-input bg-background px-2 text-xs text-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="favorites">Favorites first</option>
            </select>
          </label>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 text-sm">
        <p className="text-muted-foreground">
          Showing <span className="font-medium text-foreground">{filteredInsights.length}</span>{' '}
          of <span className="font-medium text-foreground">{insights.length}</span> insights
        </p>
        {message && <p className="text-xs text-destructive">{message}</p>}
      </div>

      {filteredInsights.length === 0 ? (
        <div className="rounded-2xl border border-dashed bg-card/40 p-8 text-center">
          <BookOpenCheck className="mx-auto size-8 text-muted-foreground" />
          <p className="mt-3 text-sm font-medium">No matching insights</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Mark an answer while journaling or clear your filters.
          </p>
        </div>
      ) : (
        <div className="grid gap-3">
          {filteredInsights.map((insight) => {
            const Icon = TYPE_ICONS[insight.type]
            return (
              <Card key={insight.id} className="border-border/60 bg-card/80 shadow-sm transition-colors hover:border-primary/25">
                <CardContent className="space-y-4 p-4 sm:p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge className={cn('border-0', TYPE_STYLES[insight.type])}>
                          <Icon className="mr-1 size-3" />
                          {insightTypeLabel(insight.type)}
                        </Badge>
                        {insight.tags.map((item) => (
                          <Badge key={item} variant="secondary" className="font-normal">
                            {item}
                          </Badge>
                        ))}
                      </div>
                      {insight.prompt && (
                        <p className="mt-3 text-xs font-medium text-muted-foreground">
                          {insight.prompt}
                        </p>
                      )}
                      {insight.title && (
                        <h2 className="mt-2 text-base font-semibold">{insight.title}</h2>
                      )}
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-foreground/90">
                        {insight.answer}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={insight.isFavorite ? 'Remove favorite' : 'Mark favorite'}
                      onClick={() => toggleFavorite(insight)}
                    >
                      <Star className={cn('size-4', insight.isFavorite && 'fill-primary text-primary')} />
                    </Button>
                  </div>

                  {insight.actionText && (
                    <div className="rounded-xl bg-primary/10 px-3 py-2 text-sm text-primary">
                      Action: {insight.actionText}
                    </div>
                  )}

                  <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-3 text-xs text-muted-foreground">
                    <span>
                      {insight.template?.icon ?? '📓'} {insight.template?.name ?? 'Journal'} ·{' '}
                      {formatDate(insight.entryDate)}
                    </span>
                    <Link href={`/journal/${insight.entryId}`} className="font-medium text-primary hover:underline">
                      Open reflection
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

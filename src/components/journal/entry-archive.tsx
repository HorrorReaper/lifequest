'use client'

import Link from 'next/link'
import { useDeferredValue, useMemo, useState } from 'react'
import { ArrowUpDown, Calendar, Search, SlidersHorizontal, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'

export interface JournalArchiveTemplate {
  id: string
  name: string
  icon: string
}

export interface JournalArchiveResponse {
  value_text: string | null
  value_number: number | null
  value_boolean: boolean | null
  value_json: unknown | null
  template_fields?: { label: string | null } | null
}

export interface JournalArchiveEntry {
  id: string
  entry_date: string
  xp_earned: number
  journal_templates?: JournalArchiveTemplate | null
  journal_responses?: JournalArchiveResponse[]
}

interface EntryArchiveProps {
  entries: JournalArchiveEntry[]
  templates: JournalArchiveTemplate[]
}

type SortMode = 'newest' | 'oldest' | 'xp'

function responseToText(response: JournalArchiveResponse) {
  const parts = [
    response.template_fields?.label,
    response.value_text,
    response.value_number?.toString(),
    typeof response.value_boolean === 'boolean' ? String(response.value_boolean) : null,
    response.value_json ? JSON.stringify(response.value_json) : null,
  ]

  return parts.filter(Boolean).join(' ')
}

function formatEntryDate(date: string) {
  return new Date(date).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function EntryArchive({ entries, templates }: EntryArchiveProps) {
  const [query, setQuery] = useState('')
  const [templateId, setTemplateId] = useState('all')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [sortMode, setSortMode] = useState<SortMode>('newest')
  const deferredQuery = useDeferredValue(query.trim().toLowerCase())

  const filteredEntries = useMemo(() => {
    return entries
      .filter((entry) => {
        if (templateId !== 'all' && entry.journal_templates?.id !== templateId) return false
        if (startDate && entry.entry_date < startDate) return false
        if (endDate && entry.entry_date > endDate) return false

        if (!deferredQuery) return true

        const searchable = [
          entry.journal_templates?.name,
          entry.entry_date,
          formatEntryDate(entry.entry_date),
          entry.xp_earned.toString(),
          ...(entry.journal_responses ?? []).map(responseToText),
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()

        return searchable.includes(deferredQuery)
      })
      .sort((a, b) => {
        if (sortMode === 'xp') return b.xp_earned - a.xp_earned
        const aTime = new Date(a.entry_date).getTime()
        const bTime = new Date(b.entry_date).getTime()
        return sortMode === 'oldest' ? aTime - bTime : bTime - aTime
      })
  }, [deferredQuery, endDate, entries, sortMode, startDate, templateId])

  const activeFilters =
    query.length > 0 || templateId !== 'all' || startDate.length > 0 || endDate.length > 0

  const clearFilters = () => {
    setQuery('')
    setTemplateId('all')
    setStartDate('')
    setEndDate('')
    setSortMode('newest')
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-card p-3 shadow-sm">
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search entries, templates, or response text..."
              className="h-9 pl-8"
            />
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={clearFilters}
            disabled={!activeFilters && sortMode === 'newest'}
            className="h-9 justify-self-start sm:justify-self-end"
          >
            <X className="size-3.5" />
            Reset
          </Button>
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="space-y-1.5 text-xs font-medium text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <SlidersHorizontal className="size-3.5" />
              Template
            </span>
            <select
              value={templateId}
              onChange={(event) => setTemplateId(event.target.value)}
              className="h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm text-foreground outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <option value="all">All templates</option>
              {templates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.icon} {template.name}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1.5 text-xs font-medium text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Calendar className="size-3.5" />
              From
            </span>
            <Input
              type="date"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
              className="h-9"
            />
          </label>

          <label className="space-y-1.5 text-xs font-medium text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Calendar className="size-3.5" />
              To
            </span>
            <Input
              type="date"
              value={endDate}
              onChange={(event) => setEndDate(event.target.value)}
              className="h-9"
            />
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
              <option value="xp">Most XP</option>
            </select>
          </label>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 text-sm">
        <p className="text-muted-foreground">
          Showing <span className="font-medium text-foreground">{filteredEntries.length}</span> of{' '}
          <span className="font-medium text-foreground">{entries.length}</span> entries
        </p>
      </div>

      {filteredEntries.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border/60 p-8 text-center">
          <p className="text-sm font-medium">No matching entries</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Try a broader search or clear one of the filters.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredEntries.map((entry) => {
            const template = entry.journal_templates

            return (
              <Link key={entry.id} href={`/journal/${entry.id}`} className="block">
                <Card className="border-border/50 transition-all hover:border-primary/30 hover:bg-muted/30">
                  <CardContent className="flex items-center gap-3 p-3">
                    <span className="text-xl">{template?.icon ?? '📓'}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {template?.name ?? 'Journal Entry'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatEntryDate(entry.entry_date)}
                      </p>
                    </div>
                    {entry.xp_earned > 0 && (
                      <span className="text-xs font-medium text-primary">
                        +{entry.xp_earned} XP
                      </span>
                    )}
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}

import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { TemplatePicker } from '@/components/journal/template-picker'
import { EntryTimeline } from '@/components/journal/entry-timeline'
import { JournalTemplate, JournalEntry } from '@/lib/types'
import { ArrowRight, BookOpen, BookOpenCheck, LayoutList, LayoutTemplate } from 'lucide-react'

type EntryTypeJoin = { entry_type: string } | { entry_type: string }[] | null

interface TodayEntryTypeRow {
  journal_templates: EntryTypeJoin
}

function getBerlinToday() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Berlin',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

function getBerlinHour() {
  const hour = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Berlin',
    hour: '2-digit',
    hour12: false,
  }).format(new Date())

  return Number(hour)
}

function formatTodayLabel(today: string) {
  return new Date(`${today}T12:00:00`).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })
}

function entryTypeFromJoin(join: EntryTypeJoin) {
  if (Array.isArray(join)) return join[0]?.entry_type ?? null
  return join?.entry_type ?? null
}

function pickRecommendedTemplate(templates: JournalTemplate[], completedTypes: Set<string>) {
  const hour = getBerlinHour()
  const preferredTypes =
    hour < 12
      ? ['morning', 'free_write']
      : hour >= 17
        ? ['evening', 'free_write']
        : ['free_write']

  for (const type of preferredTypes) {
    const template = templates.find((item) => item.entry_type === type && !completedTypes.has(type))
    if (template) return { template, isRepeat: false }
  }

  for (const type of preferredTypes) {
    const template = templates.find((item) => item.entry_type === type)
    if (template) return { template, isRepeat: true }
  }

  return { template: templates[0] ?? null, isRepeat: false }
}

export default async function JournalPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const today = getBerlinToday()
  const todayLabel = formatTodayLabel(today)

  const [{ data: templates }, { data: entries }, { data: todayEntries }] = await Promise.all([
    supabase
      .from('journal_templates')
      .select('*')
      .or(`user_id.eq.${user.id},is_system.eq.true`)
      .eq('is_active', true)
      .order('sort_order'),
    supabase
      .from('journal_entries')
      .select(
        `
        *,
        journal_templates(*),
        journal_responses(
          value_text,
          value_number,
          value_boolean,
          value_json,
          insight_type,
          topic_tags,
          insight_marked_at,
          insight_is_favorite,
          template_fields(label, field_type, sort_order)
        )
      `
      )
      .eq('user_id', user.id)
      .eq('is_complete', true)
      .order('entry_date', { ascending: false })
      .limit(5),
    supabase
      .from('journal_entries')
      .select('journal_templates(entry_type)')
      .eq('user_id', user.id)
      .eq('is_complete', true)
      .eq('entry_date', today),
  ])

  const activeTemplates = (templates as JournalTemplate[]) ?? []
  const completedTypes = new Set(
    ((todayEntries as unknown as TodayEntryTypeRow[] | null) ?? [])
      .map((entry) => entryTypeFromJoin(entry.journal_templates))
      .filter((entryType): entryType is string => Boolean(entryType))
  )
  const recommendation = pickRecommendedTemplate(activeTemplates, completedTypes)
  const recommendedTemplate = recommendation.template
  const completedTodayCount = completedTypes.size

  return (
    <div className="min-h-svh bg-background px-4 pb-24 pt-5 sm:px-8 sm:pt-8">
      <div className="mx-auto max-w-4xl space-y-7">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="mt-1 font-heading text-3xl font-semibold tracking-tight">Journal</h1>
          </div>
          <nav className="flex shrink-0 flex-wrap gap-2">
            <Link
              href="/journal/insights"
              className="flex items-center gap-1.5 rounded-full border bg-background/70 px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
            >
              <BookOpenCheck className="size-3.5" />
              Insights
            </Link>
            <Link
              href="/journal/templates"
              className="flex items-center gap-1.5 rounded-full border bg-background/70 px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
            >
              <LayoutTemplate className="size-3.5" />
              Templates
            </Link>
          </nav>
        </header>

        <section className="overflow-hidden rounded-[2rem] border bg-card shadow-sm">
          <div className="relative p-5 sm:p-7">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-primary/8 to-transparent" />
            <div className="relative grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <span className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-2xl">
                    {recommendedTemplate?.icon ?? '📓'}
                  </span>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">{todayLabel}</p>
                    <h2 className="font-heading text-2xl font-semibold tracking-tight">
                      Today&apos;s Reflection
                    </h2>
                  </div>
                </div>
                <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
                  Take five quiet minutes. Write what is true, mark one useful insight, and leave with a clearer next move.
                </p>
                {completedTodayCount > 0 && (
                  <p className="inline-flex rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                    {completedTodayCount} reflection{completedTodayCount === 1 ? '' : 's'} already saved today
                  </p>
                )}
              </div>

              {recommendedTemplate ? (
                <Link
                  href={`/journal/new/${recommendedTemplate.id}`}
                  className="group flex min-w-0 items-center justify-between gap-4 rounded-2xl border bg-background/85 p-4 text-left shadow-sm transition hover:border-primary/30 hover:bg-background lg:w-80"
                >
                  <span className="min-w-0">
                    <span className="block text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      {recommendation.isRepeat ? 'Reflect again' : 'Recommended'}
                    </span>
                    <span className="mt-1 block truncate text-base font-semibold">
                      {recommendedTemplate.name}
                    </span>
                    <span className="mt-1 line-clamp-2 block text-xs leading-5 text-muted-foreground">
                      {recommendedTemplate.description ?? 'Begin a focused reflection for today.'}
                    </span>
                  </span>
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition group-hover:scale-105">
                    <ArrowRight className="size-4" />
                  </span>
                </Link>
              ) : (
                <div className="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground lg:w-80">
                  No active journal templates found.
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Journaling templates
              </h2>
            </div>
            <BookOpen className="hidden size-5 text-muted-foreground sm:block" />
          </div>
          <TemplatePicker
            templates={activeTemplates}
            recommendedTemplateId={recommendedTemplate?.id ?? null}
          />
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Recent entries
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                The latest five reflections from your journal.
              </p>
            </div>
            <Link
              href="/journal/entries"
              className="flex items-center gap-1.5 rounded-full border bg-background/70 px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
            >
              <LayoutList className="size-3.5" />
              View all
            </Link>
          </div>
          <EntryTimeline entries={(entries as JournalEntry[]) ?? []} />
        </section>
      </div>
    </div>
  )
}

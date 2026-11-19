import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft, BookHeart, PenLine } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { dateInTimezone } from '@/lib/dates'
import {
  DIARY_WRITE_PATH,
  diaryMonth,
  fetchDiaryEntries,
  groupDiaryByMonth,
  isMonthKey,
  monthKeyOf,
} from '@/lib/diary'
import { Button } from '@/components/ui/button'
import { DiaryEntryCard } from '@/components/diary/DiaryEntryCard'
import { DiaryMonthCard } from '@/components/diary/DiaryMonthCard'

interface PageProps {
  searchParams: Promise<{ month?: string }>
}

/**
 * /journal/diary: every diary entry, newest first, under a month at a
 * glance (docs/features/journal.md#diary).
 */
export default async function DiaryPage({ searchParams }: PageProps) {
  const { month } = await searchParams
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('timezone').eq('id', user.id).maybeSingle()
  const timezone = (profile as { timezone?: string | null } | null)?.timezone ?? 'UTC'
  const today = dateInTimezone(new Date(), timezone)
  const currentMonth = monthKeyOf(today)
  const shownMonth = isMonthKey(month) && month <= currentMonth ? month : currentMonth

  const entries = await fetchDiaryEntries(supabase, user.id)
  const writtenToday = entries.some((entry) => entry.entryDate === today)
  const groups = groupDiaryByMonth(entries)

  return (
    <div className="min-h-svh bg-background px-4 pb-24 pt-5 sm:px-8 sm:pt-8">
      <div className="mx-auto max-w-2xl space-y-6">
        <header className="space-y-4">
          <Link
            href="/journal"
            className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Journal
          </Link>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="font-heading text-3xl font-semibold tracking-tight">Diary</h1>
              <p className="mt-1 text-sm text-muted-foreground">One page for every day.</p>
            </div>
            <Button asChild className="h-11 rounded-xl px-4">
              <Link href={DIARY_WRITE_PATH}>
                <PenLine className="size-4" aria-hidden="true" />
                {writtenToday ? 'Continue today' : 'Write today'}
              </Link>
            </Button>
          </div>
        </header>

        <DiaryMonthCard month={diaryMonth(entries, shownMonth, today)} currentMonthKey={currentMonth} />

        {groups.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-3xl border border-dashed p-8 text-center">
            <span className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <BookHeart className="size-6" aria-hidden="true" />
            </span>
            <p className="font-semibold">No diary entries yet</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Write a page about today: what happened, how it felt, a photo from a link if you like.
            </p>
          </div>
        ) : (
          groups.map((group) => (
            <section key={group.monthKey} aria-labelledby={`diary-${group.monthKey}`} className="space-y-2.5">
              <h2
                id={`diary-${group.monthKey}`}
                className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground"
              >
                {group.label}
              </h2>
              <ul className="space-y-2.5">
                {group.entries.map((entry) => (
                  <li key={entry.id}>
                    <DiaryEntryCard entry={entry} />
                  </li>
                ))}
              </ul>
            </section>
          ))
        )}
      </div>
    </div>
  )
}

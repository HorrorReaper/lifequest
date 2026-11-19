import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ArrowLeft, ChevronLeft, ChevronRight, PenLine } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { formatDateOnly } from '@/lib/dates'
import { adjacentDiaryEntries, DIARY_PATH, diaryTitle, fetchDiaryEntries } from '@/lib/diary'
import { Button } from '@/components/ui/button'
import { MarkdownView } from '@/components/ui/markdown-view'
import { cn } from '@/lib/utils'

interface PageProps {
  params: Promise<{ entryId: string }>
}

/**
 * One diary entry, read back: its day, title and Markdown, with the days
 * before and after one tap away. Editing goes through the journal's own
 * entry page.
 */
export default async function DiaryEntryPage({ params }: PageProps) {
  const { entryId } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const entries = await fetchDiaryEntries(supabase, user.id)
  const entry = entries.find((item) => item.id === entryId)
  if (!entry) notFound()
  const { previous, next } = adjacentDiaryEntries(entries, entry.id)

  const dayLink = (target: typeof previous, label: string, Icon: typeof ChevronLeft) =>
    target ? (
      <Link
        href={`${DIARY_PATH}/${target.id}`}
        aria-label={`${label}: ${formatDateOnly(target.entryDate, { month: 'long', day: 'numeric' })}`}
        className="flex size-11 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <Icon className="size-5" aria-hidden="true" />
      </Link>
    ) : (
      <span aria-hidden="true" className="flex size-11 items-center justify-center text-muted-foreground/40">
        <Icon className="size-5" />
      </span>
    )

  return (
    <div className="min-h-svh bg-background px-4 pb-24 pt-5 sm:px-8 sm:pt-8">
      <article className="mx-auto max-w-2xl">
        <nav className="flex items-center justify-between gap-2" aria-label="Diary">
          <Link
            href={DIARY_PATH}
            className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Diary
          </Link>
          <div className="flex">
            {dayLink(previous, 'Previous day', ChevronLeft)}
            {dayLink(next, 'Next day', ChevronRight)}
          </div>
        </nav>

        <header className="mt-4">
          <p className="text-sm font-semibold uppercase tracking-[0.06em] text-primary">
            {formatDateOnly(entry.entryDate, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
          </p>
          <h1
            className={cn(
              'mt-1.5 font-heading text-3xl leading-tight font-semibold tracking-tight sm:text-4xl',
              !entry.title && 'italic text-muted-foreground'
            )}
          >
            {diaryTitle(entry)}
          </h1>
        </header>

        <MarkdownView content={entry.body} className="mt-5" />

        <footer className="mt-8 flex items-center justify-end border-t pt-4">
          <Button asChild variant="outline" className="h-11 rounded-xl">
            <Link href={`/journal/${entry.id}`}>
              <PenLine className="size-4" aria-hidden="true" />
              Edit entry
            </Link>
          </Button>
        </footer>
      </article>
    </div>
  )
}

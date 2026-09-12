import Link from 'next/link'
import { ArrowRight, BookOpen, NotebookPen, Sparkles } from 'lucide-react'
import { buildAcademyRails } from '@/lib/academy-rails'
import { groupInsightsByType, type JournalInsightItem } from '@/lib/journal-insights'
import type { LessonWithStatus } from '@/lib/lessons'
import { CardRail } from './CardRail'
import { InsightCard } from './InsightCard'
import { LessonCard } from './LessonCard'
import { ToolGrid } from './ToolGrid'

interface AcademyLibraryProps {
  lessons: LessonWithStatus[]
  /** Everything marked while journaling, newest first. */
  insights: JournalInsightItem[]
}

/**
 * The Academy for everyone who is not an admin: the toolbox and the article
 * library, laid out as rails. Topic rails come from the articles themselves,
 * so a new article joins a row -- or starts one -- with no wiring here.
 */
export function AcademyLibrary({ lessons, insights }: AcademyLibraryProps) {
  const { rails, leftover, completed, stats } = buildAcademyRails(lessons)
  const insightRails = groupInsightsByType(insights)
  const percent = stats.total === 0 ? 0 : Math.round((stats.completed / stats.total) * 100)

  return (
    <div className="space-y-9">
      <div className="flex flex-wrap items-center gap-x-8 gap-y-4 rounded-2xl border bg-card p-4 sm:p-5">
        <div className="min-w-[9rem] flex-1">
          <div className="flex items-center gap-2 text-muted-foreground">
            <BookOpen className="size-3.5" />
            <p className="text-xs font-semibold uppercase tracking-[0.14em]">Articles read</p>
          </div>
          <p className="mt-1.5 font-mono text-2xl font-semibold tabular-nums">
            {stats.completed} of {stats.total}
          </p>
          <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-[width]"
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>
        <div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Sparkles className="size-3.5" />
            <p className="text-xs font-semibold uppercase tracking-[0.14em]">XP earned</p>
          </div>
          <p className="mt-1.5 font-mono text-2xl font-semibold tabular-nums">{stats.xpEarned}</p>
        </div>
      </div>

      <ToolGrid variant="rail" />

      {rails.map((rail) => (
        <CardRail key={rail.topic} title={rail.topic} count={rail.lessons.length}>
          {rail.lessons.map((lesson) => (
            <LessonCard key={lesson.id} lesson={lesson} />
          ))}
        </CardRail>
      ))}

      {leftover.length > 0 && (
        <CardRail title="More articles" count={leftover.length}>
          {leftover.map((lesson) => (
            <LessonCard key={lesson.id} lesson={lesson} />
          ))}
        </CardRail>
      )}

      <section className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-3 border-t pt-7">
          <div className="flex items-center gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
              <NotebookPen className="size-5" />
            </span>
            <div>
              <h2 className="text-xl font-semibold tracking-tight">From your journal</h2>
              <p className="mt-0.5 text-sm text-muted-foreground">
                What you marked while reflecting, kept where you can find it again.
              </p>
            </div>
          </div>
          {insightRails.length > 0 && (
            <Link
              href="/journal/insights"
              className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
            >
              See all
              <ArrowRight className="size-3.5" />
            </Link>
          )}
        </div>

        {insightRails.length === 0 ? (
          <div className="rounded-2xl border border-dashed px-5 py-9 text-center">
            <NotebookPen className="mx-auto size-8 text-muted-foreground/60" />
            <p className="mt-3 text-sm font-medium">Nothing marked yet</p>
            <p className="mx-auto mt-1 max-w-sm text-sm leading-6 text-muted-foreground">
              Mark a learning, idea, or win while journaling and it collects here.
            </p>
            <Link
              href="/journal"
              className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
            >
              Open the journal
              <ArrowRight className="size-3.5" />
            </Link>
          </div>
        ) : (
          insightRails.map((rail) => (
            <CardRail
              key={rail.type}
              title={rail.label}
              count={rail.total}
              itemClassName="w-[15.5rem] shrink-0 snap-start"
            >
              {rail.insights.map((item) => (
                <InsightCard key={item.id} insight={item} />
              ))}
            </CardRail>
          ))
        )}
      </section>

      {completed.length > 0 && (
        <CardRail title="Completed" count={completed.length} description="Read again any time.">
          {completed.map((lesson) => (
            <LessonCard key={lesson.id} lesson={lesson} />
          ))}
        </CardRail>
      )}

      {stats.total === 0 && (
        <div className="rounded-2xl border border-dashed px-5 py-9 text-center">
          <BookOpen className="mx-auto size-8 text-muted-foreground/60" />
          <p className="mt-3 text-sm font-medium">No articles yet</p>
        </div>
      )}
    </div>
  )
}

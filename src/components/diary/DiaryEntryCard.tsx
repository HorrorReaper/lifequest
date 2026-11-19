import Link from 'next/link'
import { formatDateOnly } from '@/lib/dates'
import { DIARY_PATH, diaryTitle, type DiaryEntry } from '@/lib/diary'
import { firstMarkdownImage, markdownExcerpt } from '@/lib/markdown-text'
import { cn } from '@/lib/utils'

/**
 * One day in the diary list: weekday and day, the title ("Untitled" when
 * there is none), two lines of the text without its Markdown, and the first
 * image as a thumbnail. Opens the entry.
 */
export function DiaryEntryCard({ entry }: { entry: DiaryEntry }) {
  const image = firstMarkdownImage(entry.body)
  const excerpt = markdownExcerpt(entry.body)
  return (
    <Link
      href={`${DIARY_PATH}/${entry.id}`}
      className="flex gap-3.5 rounded-2xl border bg-card p-3.5 transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <span className="w-11 shrink-0 text-center">
        <span className="block text-[11px] font-semibold uppercase text-primary">
          {formatDateOnly(entry.entryDate, { weekday: 'short' })}
        </span>
        <span className="block font-heading text-2xl leading-tight font-semibold">
          {Number(entry.entryDate.slice(8, 10))}
        </span>
      </span>
      <span className="min-w-0 flex-1 space-y-1">
        <span className={cn('block font-semibold', !entry.title && 'italic text-muted-foreground')}>
          {diaryTitle(entry)}
        </span>
        {excerpt && (
          <span className="line-clamp-2 block text-sm leading-relaxed text-muted-foreground">{excerpt}</span>
        )}
      </span>
      {image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={image}
          alt=""
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          className="size-16 shrink-0 rounded-xl bg-muted object-cover"
        />
      )}
    </Link>
  )
}

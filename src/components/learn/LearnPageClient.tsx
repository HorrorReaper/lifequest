'use client'

import { useState } from 'react'
import { LessonCard } from './LessonCard'
import type { LessonWithStatus } from '@/lib/lessons'
import { cn } from '@/lib/utils'

interface LearnPageClientProps {
  lessons: LessonWithStatus[]
}

export function LearnPageClient({ lessons }: LearnPageClientProps) {
  const [topic, setTopic] = useState('All')
  const lessonTopics = Array.from(new Set(lessons.flatMap((lesson) => lesson.topics))).sort()
  const prioritizedTopics = [
    ...lessonTopics.filter((item) => item === 'Habits'),
    ...lessonTopics.filter((item) => item !== 'Habits'),
  ]
  const topics = [
    'All',
    ...prioritizedTopics,
  ]
  const filteredLessons =
    topic === 'All'
      ? lessons
      : lessons.filter((lesson) => lesson.topics.includes(topic))
  const active = filteredLessons.filter((l) => l.status === 'not-started')
  const completed = filteredLessons.filter((l) => l.status === 'completed')

  return (
    <div className="space-y-6">
      {topics.length > 1 && (
        <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <div className="flex w-max gap-2">
            {topics.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTopic(t)}
                className={cn(
                  'rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                  topic === t
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-background text-muted-foreground hover:text-foreground'
                )}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      )}

      {active.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Available
          </p>
          <div className="space-y-2">
            {active.map((l) => <LessonCard key={l.id} lesson={l} />)}
          </div>
        </div>
      )}

      {completed.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Completed
          </p>
          <div className="space-y-2">
            {completed.map((l) => <LessonCard key={l.id} lesson={l} />)}
          </div>
        </div>
      )}

      {lessons.length === 0 && (
        <p className="text-center text-sm text-muted-foreground py-12">
          No lessons available yet.
        </p>
      )}

      {lessons.length > 0 && filteredLessons.length === 0 && (
        <p className="text-center text-sm text-muted-foreground py-12">
          No lessons in this topic yet.
        </p>
      )}
    </div>
  )
}

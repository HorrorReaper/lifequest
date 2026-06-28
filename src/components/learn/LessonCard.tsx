import Link from 'next/link'
import Image from 'next/image'
import { Clock, Zap, Coins, CheckCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { LessonWithStatus } from '@/lib/lessons'

const DIFFICULTY_CLASSES = {
  easy: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  medium: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  hard: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
}

interface LessonCardProps {
  lesson: LessonWithStatus
}

export function LessonCard({ lesson }: LessonCardProps) {
  const completed = lesson.status === 'completed'

  return (
    <Link
      href={`/learn/${lesson.id}`}
      className={cn(
        'block rounded-xl border overflow-hidden transition-all hover:border-primary/40 hover:shadow-sm',
        completed && 'opacity-70'
      )}
    >
      {/* Cover image */}
      <div className="relative h-36 w-full bg-muted">
        <Image
          src={lesson.image}
          alt={lesson.title}
          fill
          className="object-cover"
          sizes="(max-width: 768px) 100vw, 640px"
        />
        {completed && (
          <div className="absolute inset-0 bg-background/40 flex items-center justify-center">
            <div className="rounded-full bg-green-500 p-2">
              <CheckCircle className="size-6 text-white" />
            </div>
          </div>
        )}
        <div className="absolute bottom-2 left-2">
          <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium backdrop-blur-sm', DIFFICULTY_CLASSES[lesson.difficulty])}>
            {lesson.difficulty.charAt(0).toUpperCase() + lesson.difficulty.slice(1)}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-1.5">
        <h3 className="font-semibold text-sm leading-snug">{lesson.title}</h3>
        <p className="text-xs text-muted-foreground line-clamp-2">{lesson.description}</p>

        <div className="flex flex-wrap gap-1.5 pt-1">
          {lesson.topics.slice(0, 3).map((topic) => (
            <span
              key={topic}
              className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground"
            >
              {topic}
            </span>
          ))}
        </div>

        <div className="flex items-center gap-3 pt-0.5 flex-wrap">
          <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <Clock className="size-3" />
            {lesson.estimatedMinutes} min
          </span>
          <span className="flex items-center gap-1 text-[11px] text-blue-600 dark:text-blue-400">
            <Zap className="size-3" />
            {lesson.xp_reward} XP
          </span>
          <span className="flex items-center gap-1 text-[11px] text-yellow-600 dark:text-yellow-400">
            <Coins className="size-3" />
            {lesson.coin_reward}
          </span>
        </div>
      </div>
    </Link>
  )
}

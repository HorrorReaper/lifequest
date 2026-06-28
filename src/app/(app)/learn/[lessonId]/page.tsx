'use client'

import { useParams, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { LESSONS } from '@/lib/lessons'
import { LessonReader } from '@/components/learn/LessonReader'
import { createClient } from '@/lib/supabase/client'

export default function LessonDetailPage() {
  const params = useParams()
  const router = useRouter()
  const lessonId = params.lessonId as string

  const lesson = LESSONS.find((l) => l.id === lessonId)

  const [alreadyCompleted, setAlreadyCompleted] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!lesson) return
    const supabase = createClient()
    ;(async () => {
      const { data: userData } = await supabase.auth.getUser()
      const user = userData?.user
      if (!user) { router.replace('/login'); return }

      const { data } = await (supabase as any)
        .from('lesson_completions')
        .select('id')
        .eq('user_id', user.id)
        .eq('lesson_id', lessonId)
        .maybeSingle()

      setAlreadyCompleted(!!data)
      setLoading(false)
    })()
  }, [lessonId])

  if (!lesson) {
    return (
      <div className="min-h-svh flex items-center justify-center">
        <p className="text-muted-foreground">Lesson not found.</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-svh flex items-center justify-center">
        <p className="text-muted-foreground text-sm">Loading…</p>
      </div>
    )
  }

  return <LessonReader lesson={lesson} alreadyCompleted={alreadyCompleted} />
}

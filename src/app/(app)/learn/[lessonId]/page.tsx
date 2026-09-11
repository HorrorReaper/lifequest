import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { showAdminUi } from '@/lib/admin'
import { isArticleLessonId } from '@/lib/lessons'
import { LessonDetailClient } from '@/components/learn/LessonDetailClient'

interface LessonDetailPageProps {
  params: Promise<{ lessonId: string }>
}

export default async function LessonDetailPage({ params }: LessonDetailPageProps) {
  const { lessonId } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // Courses are admin-only, so a normal user who lands on a course lesson —
  // an old link, a guessed slug — goes back to the articles they can read.
  const coursesEnabled = await showAdminUi(user)
  if (!coursesEnabled && !isArticleLessonId(lessonId)) redirect('/learn')

  return <LessonDetailClient lessonId={lessonId} coursesEnabled={coursesEnabled} />
}

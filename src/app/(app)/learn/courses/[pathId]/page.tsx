import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { showAdminUi } from '@/lib/admin'
import { fetchLearningExperience } from '@/lib/learning-api'
import {
  DEFAULT_LEARNING_CATALOG,
  EMPTY_LEARNING_PROGRESS,
  type LearningPathId,
} from '@/lib/learning-paths'
import { withPersonalLearningPath } from '@/lib/personal-learning'
import { LearningPathLibrary } from '@/components/learn/LearningPathLibrary'

export default async function CoursePage({
  params,
}: {
  params: Promise<{ pathId: string }>
}) {
  const client = await createClient()
  const {
    data: { user },
  } = await client.auth.getUser()
  if (!user) redirect('/login')
  if (!(await showAdminUi(user))) redirect('/learn')
  const { pathId } = await params
  let catalog = DEFAULT_LEARNING_CATALOG
  let progress = EMPTY_LEARNING_PROGRESS
  let publishedPathIds: LearningPathId[] = []
  let backendEnabled = false
  try {
    const learning = await fetchLearningExperience(client)
    catalog = learning.catalog
    progress = learning.progress
    publishedPathIds = catalog.paths.map((path) => path.id)
    backendEnabled = true
  } catch (error) {
    console.error('Course backend unavailable; using admin preview.', error)
  }
  if (
    !withPersonalLearningPath(catalog).paths.some((path) => path.id === pathId)
  )
    notFound()
  return (
    <LearningPathLibrary
      key={pathId}
      catalog={catalog}
      progress={progress}
      backendEnabled={backendEnabled}
      publishedPathIds={publishedPathIds}
      userId={user.id}
      initialPathId={pathId as LearningPathId}
      legacyLessons={[]}
    />
  )
}

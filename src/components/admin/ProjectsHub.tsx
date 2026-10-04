'use client'

import { ProjectsOverview } from '@/components/projects/ProjectsOverview'

/** Compatibility entry point for the reusable Projects feature. */
export function ProjectsHub({ userId }: { userId: string; workLinks?: boolean }) {
  return <ProjectsOverview userId={userId} />
}

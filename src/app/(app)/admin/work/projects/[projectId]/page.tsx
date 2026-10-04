import { notFound } from 'next/navigation'
import { getWorkContext } from '@/lib/work/context'
import { ProjectDetail } from '@/components/projects/ProjectDetail'
import type { WorkspaceProject } from '@/lib/projects/project-workspace'

export default async function ProjectPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(projectId)) notFound()
  const { supabase, userId } = await getWorkContext()
  const { data, error } = await supabase.from('projects').select('*').eq('id', projectId).eq('user_id', userId).maybeSingle()
  if (error) throw new Error('Project could not be loaded. Please retry.')
  if (!data) notFound()
  return <ProjectDetail key={projectId} userId={userId} initialProject={data as WorkspaceProject} />
}

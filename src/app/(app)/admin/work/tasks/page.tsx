import Link from 'next/link'
import { notFound } from 'next/navigation'
import { AdminPageHeader } from '@/components/admin/AdminPageHeader'
import { TaskList } from '@/components/tasks/TaskList'
import { Button } from '@/components/ui/button'
import { getWorkContext } from '@/lib/work/context'
import { cn } from '@/lib/utils'

export default async function WorkTasksPage({ searchParams }: { searchParams: Promise<{ project?: string }> }) {
  const { userId, today, supabase } = await getWorkContext()
  const { project: projectId } = await searchParams
  const { data, error } = await supabase.from('projects').select('id,name').eq('user_id', userId).order('name')
  if (error) throw new Error('Your projects could not be loaded.')
  const projects = (data ?? []) as { id: string; name: string }[]
  const project = projects.find((item) => item.id === projectId)
  if (projectId && !project) notFound()

  return (
    <div className="space-y-5">
      <AdminPageHeader eyebrow="Work" title={project ? `${project.name} · Tasks` : 'Tasks'} description="Choose the next action, set a due date and make progress." />
      <div className="flex flex-wrap items-center gap-2" aria-label="Filter tasks by project">
        <Link href="/admin/work/tasks" aria-current={!projectId ? 'page' : undefined} className={cn('rounded-full border px-3 py-2 text-sm', !projectId && 'bg-primary text-primary-foreground')}>All projects</Link>
        {projects.map((item) => <Link key={item.id} href={`/admin/work/tasks?project=${encodeURIComponent(item.id)}`} aria-current={projectId === item.id ? 'page' : undefined} className={cn('max-w-64 truncate rounded-full border px-3 py-2 text-sm', projectId === item.id && 'bg-primary text-primary-foreground')}>{item.name}</Link>)}
        <Button asChild variant="outline" size="sm" className="sm:ml-auto"><Link href="/admin/work/plan?step=timeline">Plan my day</Link></Button>
      </div>
      <TaskList key={projectId ?? 'all'} userId={userId} today={today} projectId={projectId} awardCompletionXp={false} />
    </div>
  )
}

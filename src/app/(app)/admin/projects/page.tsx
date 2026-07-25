import { createClient } from '@/lib/supabase/server'
import { ProjectsHub } from '@/components/admin/ProjectsHub'

export default async function AdminProjectsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return <ProjectsHub userId={user!.id} />
}

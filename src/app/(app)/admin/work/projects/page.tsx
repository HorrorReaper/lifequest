import { ProjectsHub } from '@/components/admin/ProjectsHub'
import { getWorkContext } from '@/lib/work/context'

export default async function WorkProjectsPage() {
  const { userId } = await getWorkContext()
  return <ProjectsHub userId={userId} workLinks />
}

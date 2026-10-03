import { redirect } from 'next/navigation'
import { getWorkContext } from '@/lib/work/context'

export default async function AdminProjectsPage() {
  await getWorkContext()
  redirect('/admin/work/projects')
}

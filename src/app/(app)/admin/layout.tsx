import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { hasTrustedAdminRole, showAdminUi } from '@/lib/admin'
import { AdminShell } from '@/components/admin/AdminShell'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  // Also 404s while previewing as a normal user -- a preview that still let
  // you walk into the admin workspace would not be showing you their app.
  if (!(await showAdminUi(user))) notFound()

  const trusted = hasTrustedAdminRole(user)
  const { data: appStats } = trusted
    ? await supabase.rpc('admin_app_stats').single()
    : { data: null }
  const stats = appStats as { total_users: number } | null

  return <AdminShell trusted={trusted} userCount={stats?.total_users ?? null}>{children}</AdminShell>
}

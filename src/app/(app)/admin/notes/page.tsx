import { createClient } from '@/lib/supabase/server'
import { AdminNotesHub } from '@/components/admin/AdminNotesHub'

export default async function AdminNotesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return <AdminNotesHub userId={user!.id} />
}

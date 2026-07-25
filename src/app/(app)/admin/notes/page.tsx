import { createClient } from '@/lib/supabase/server'
import { AdminNotesHub } from '@/components/admin/AdminNotesHub'

export default async function AdminNotesPage({
  searchParams,
}: {
  searchParams: Promise<{ note?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { note } = await searchParams
  return <AdminNotesHub userId={user!.id} initialNoteId={note} />
}

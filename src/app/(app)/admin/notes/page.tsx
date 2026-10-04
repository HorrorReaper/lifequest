import { createClient } from '@/lib/supabase/server'
import { AdminNotesHub } from '@/components/admin/AdminNotesHub'
import { safeNextPath } from '@/lib/auth-redirect'

export default async function AdminNotesPage({
  searchParams,
}: {
  searchParams: Promise<{ note?: string; returnTo?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { note, returnTo } = await searchParams
  const safeReturn = safeNextPath(returnTo)
  const projectReturn = safeReturn && /^\/admin\/work\/projects\/[0-9a-f-]{36}(\?|$)/i.test(safeReturn) ? safeReturn : undefined
  return <AdminNotesHub userId={user!.id} initialNoteId={note} returnHref={projectReturn} />
}

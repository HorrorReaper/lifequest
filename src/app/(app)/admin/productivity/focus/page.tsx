import { createClient } from '@/lib/supabase/server'
import { FullscreenFocusTimer } from '@/components/admin/FullscreenFocusTimer'

export default async function FocusPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return <FullscreenFocusTimer userId={user!.id} />
}

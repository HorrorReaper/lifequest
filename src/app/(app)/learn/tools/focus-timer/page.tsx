import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { FocusTimerTool } from '@/components/tools/focus/FocusTimerTool'

export default async function FocusTimerPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data, error } = await supabase
    .from('focus_sessions')
    .select('*')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .maybeSingle()
  return <FocusTimerTool initialSession={data} loadFailed={Boolean(error)} />
}

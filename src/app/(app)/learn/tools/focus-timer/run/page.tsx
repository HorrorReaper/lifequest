import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { FullscreenFocusTimer } from '@/components/admin/FullscreenFocusTimer'

export default async function RunFocusTimerPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  return (
    <FullscreenFocusTimer
      userId={user.id}
      returnHref="/learn/tools/focus-timer"
    />
  )
}

// src/app/onboarding/page.tsx

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { OnboardingFlow } from '@/components/onboarding/onboarding-flow'
import type { Database } from '@/lib/supabase/database.types'

export default async function OnboardingPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()
  const profile = data as Database['public']['Tables']['profiles']['Row'] | null

  // Existing accounts never see this flow again, so nothing they have is
  // touched by it.
  if (profile?.onboarding_complete) redirect('/dashboard')

  return (
    // Plain background on purpose. The stacked gradients this replaced were
    // literal rgb values with a dark-mode twin, so the white and trail themes
    // both got the light one regardless of what they set.
    <div className="flex min-h-svh justify-center bg-background px-4 sm:px-6">
      <OnboardingFlow
        userId={user.id}
        currentName={profile?.username ?? user.user_metadata?.full_name ?? ''}
      />
    </div>
  )
}

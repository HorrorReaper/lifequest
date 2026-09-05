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

  if (profile?.onboarding_complete) redirect('/dashboard')

  // Fetch system templates for the "pick your first template" step
  const { data: templates } = await supabase
    .from('journal_templates')
    .select('id, name, description, icon, entry_type, xp_reward')
    .eq('is_system', true)
    .eq('is_active', true)
    .order('sort_order')

  return (
    // Plain background on purpose. The stacked gradients this replaced were
    // literal rgb values with a dark-mode twin, so the white and trail themes
    // both got the light one regardless of what they set.
    <div className="flex min-h-svh justify-center bg-background px-5 sm:px-6">
      <OnboardingFlow
        userId={user.id}
        currentName={profile?.username ?? user.user_metadata?.full_name ?? ''}
        templates={templates ?? []}
      />
    </div>
  )
}

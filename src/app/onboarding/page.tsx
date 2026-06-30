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

  const isMvp = process.env.IS_MVP === 'true'

  if (profile?.onboarding_complete && !isMvp) redirect('/dashboard')

  // Fetch system templates for the "pick your first template" step
  const { data: templates } = await supabase
    .from('journal_templates')
    .select('id, name, description, icon, entry_type, xp_reward')
    .eq('is_system', true)
    .eq('is_active', true)
    .order('sort_order')

  return (
    <div className="relative flex min-h-svh items-start justify-center overflow-hidden bg-[radial-gradient(circle_at_top_left,rgba(125,211,252,0.22),transparent_34%),radial-gradient(circle_at_top_right,rgba(251,113,133,0.20),transparent_32%),linear-gradient(135deg,rgba(255,255,255,1),rgba(250,245,255,0.65),rgba(254,249,195,0.38))] px-4 py-8 pt-12 dark:bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.18),transparent_34%),radial-gradient(circle_at_top_right,rgba(244,63,94,0.16),transparent_32%),linear-gradient(135deg,rgb(9,9,11),rgb(24,24,27),rgb(17,24,39))] sm:items-center sm:px-6 sm:pt-8 lg:px-8">
      <OnboardingFlow
        userId={user.id}
        currentName={profile?.username ?? user.user_metadata?.full_name ?? ''}
        templates={templates ?? []}
      />
    </div>
  )
}

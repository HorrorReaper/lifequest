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
    <div className="flex min-h-svh items-center justify-center bg-background px-4 py-8">
      <OnboardingFlow
        userId={user.id}
        currentName={profile?.username ?? user.user_metadata?.full_name ?? ''}
        templates={templates ?? []}
      />
    </div>
  )
}

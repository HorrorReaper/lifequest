import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { SettingsForm } from '@/components/settings/settings-form'
import type { Database } from '@/lib/supabase/database.types'

export default async function SettingsPage() {
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

  return (
    <div className="min-h-svh bg-background p-4 sm:p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold">Settings</h1>
        <SettingsForm
          userId={user.id}
          email={user.email ?? ''}
          username={profile?.username ?? ''}
          timezone={profile?.timezone ?? 'UTC'}
          aiAssistantEnabled={profile?.ai_assistant_enabled ?? false}
          aiConsentAt={profile?.ai_consent_at ?? null}
        />
      </div>
    </div>
  )
}

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { hasTrustedAdminRole } from '@/lib/admin'
import { normalizeRitualSettings } from '@/lib/rituals'
import { RitualsHub } from '@/components/admin/RitualsHub'

export default async function AdminRitualsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const [{ data: ritualRows }, { data: templateRows }] = await Promise.all([
    supabase.from('ritual_settings').select('*'),
    // Only system templates: a prompt every user sees cannot open one
    // user's private template.
    supabase
      .from('journal_templates')
      .select('id, name, icon')
      .eq('is_system', true)
      .eq('is_active', true)
      .order('sort_order'),
  ])

  const templates = ((templateRows ?? []) as { id: string; name: string; icon: string | null }[]).map(
    (template) => ({ id: template.id, name: template.name, icon: template.icon ?? '📓' })
  )

  return (
    <RitualsHub
      userId={user.id}
      trusted={hasTrustedAdminRole(user)}
      settings={normalizeRitualSettings(ritualRows)}
      templates={templates}
    />
  )
}

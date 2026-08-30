// src/app/(app)/layout.tsx

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { LevelUpOverlay } from '@/components/ui/level-up-overlay'
import { AppShell } from '@/components/layout/app-shell'
import { isPreviewingAsUser, showAdminUi } from '@/lib/admin'
import { PreviewAsUserBanner } from '@/components/layout/PreviewAsUserBanner'

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const [showAdmin, previewing] = await Promise.all([
    showAdminUi(user),
    isPreviewingAsUser(),
  ])

  return (
    <>
      {previewing && <PreviewAsUserBanner />}
      <AppShell isAdmin={showAdmin}>
        {children}
        <LevelUpOverlay />
      </AppShell>
    </>
  )
}

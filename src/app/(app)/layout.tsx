// src/app/(app)/layout.tsx

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { LevelUpOverlay } from '@/components/ui/level-up-overlay'
import { AppShell } from '@/components/layout/app-shell'
import { isPreviewingAsUser, showAdminUi } from '@/lib/admin'
import { PreviewAsUserBanner } from '@/components/layout/PreviewAsUserBanner'
import { PREVIEW_BANNER_HEIGHT } from '@/components/layout/preview-banner-height'
import { fetchShellStats } from '@/lib/shell-stats'

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

  const [showAdmin, previewing, stats] = await Promise.all([
    showAdminUi(user),
    isPreviewingAsUser(),
    fetchShellStats(supabase, user.id),
  ])

  return (
    <div
      // Tells the sticky top bar how tall the preview banner above it is, so
      // it sticks beneath it rather than behind it.
      style={
        previewing
          ? ({ '--preview-banner-height': PREVIEW_BANNER_HEIGHT } as React.CSSProperties)
          : undefined
      }
    >
      {previewing && <PreviewAsUserBanner />}
      <AppShell isAdmin={showAdmin} initialStats={stats}>
        {children}
        <LevelUpOverlay />
      </AppShell>
    </div>
  )
}

// src/app/(app)/layout.tsx

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { LevelUpOverlay } from '@/components/ui/level-up-overlay'
import { AppShell } from '@/components/layout/app-shell'
import { isAdminUser } from '@/lib/admin'

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

  return (
    <AppShell isAdmin={isAdminUser(user)}>
      {children}
      <LevelUpOverlay />
    </AppShell>
  )
}

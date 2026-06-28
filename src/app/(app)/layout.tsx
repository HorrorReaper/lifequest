// src/app/(app)/layout.tsx

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { BottomNav } from '@/components/layout/bottom-nav'
import { LevelUpOverlay } from '@/components/ui/level-up-overlay'

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
    <div className="min-h-svh pb-16">
      {children}
      <BottomNav />
      <LevelUpOverlay />
    </div>
  )
}

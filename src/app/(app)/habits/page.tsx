import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft, Flame } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { HabitDashboardWidget } from '@/components/dashboard/HabitDashboardWidget'

export default async function HabitsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  return (
    <main className="min-h-svh bg-background p-4 pb-24 sm:p-8">
      <div className="mx-auto max-w-2xl space-y-6">
        <header>
          <Link
            href="/dashboard"
            className="mb-4 inline-flex min-h-11 items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            Dashboard
          </Link>
          <div className="flex items-center gap-3">
            <span className="flex size-11 items-center justify-center rounded-2xl bg-orange-500/10 text-orange-600 dark:text-orange-400">
              <Flame className="size-5" />
            </span>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Habits</h1>
              <p className="text-sm text-muted-foreground">Build, track, edit, and organize your daily habits.</p>
            </div>
          </div>
        </header>

        <HabitDashboardWidget userId={user.id} />
      </div>
    </main>
  )
}

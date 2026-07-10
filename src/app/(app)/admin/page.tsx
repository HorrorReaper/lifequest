import { notFound, redirect } from 'next/navigation'
import { ShieldCheck } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { isAdminUser } from '@/lib/admin'
import { AdminTestingTools } from '@/components/dev/AdminTestingTools'

export default async function AdminPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')
  if (!isAdminUser(user)) notFound()

  return (
    <main className="min-h-svh bg-background p-4 pb-[calc(var(--bottom-nav-height)+var(--safe-area-bottom))] sm:p-8">
      <div className="mx-auto max-w-2xl space-y-5">
        <header className="rounded-3xl border bg-card p-5 shadow-sm sm:p-6">
          <div className="flex items-start gap-3">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <ShieldCheck className="size-6" />
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                Admin only
              </p>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight">Testing Lab</h1>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Private MVP controls for testing animations, client state, and app flows without exposing them to normal users.
              </p>
            </div>
          </div>
        </header>

        <AdminTestingTools />
      </div>
    </main>
  )
}

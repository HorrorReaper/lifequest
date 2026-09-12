import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft, Wrench } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { ToolGrid } from '@/components/learn/ToolGrid'

export default async function ToolLibraryPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  return (
    <main className="min-h-svh bg-background p-4 pb-24 sm:p-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <header>
          <Link
            href="/learn"
            className="mb-4 inline-flex min-h-11 items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            Learn
          </Link>
          <div className="flex items-center gap-3">
            <span className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Wrench className="size-5" />
            </span>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Toolbox</h1>
              <p className="text-sm text-muted-foreground">
                Self-improvement tools you can come back to whenever you need them.
              </p>
            </div>
          </div>
        </header>

        <ToolGrid />
      </div>
    </main>
  )
}

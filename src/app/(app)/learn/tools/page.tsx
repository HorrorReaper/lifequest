import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft, Wrench } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { TOOL_REGISTRY } from '@/lib/tools/registry'

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

        {TOOL_REGISTRY.length === 0 ? (
          <div className="rounded-2xl border border-dashed px-5 py-9 text-center">
            <Wrench className="mx-auto size-8 text-muted-foreground/60" />
            <p className="mt-3 text-sm font-medium">No tools yet</p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {TOOL_REGISTRY.map((tool) => {
              const Icon = tool.icon

              return (
                <Link
                  key={tool.id}
                  href={`/learn/tools/${tool.id}`}
                  className="flex items-start gap-3 rounded-2xl border bg-card p-4 shadow-sm transition-colors hover:border-primary/40 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Icon className="size-5" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold">{tool.title}</span>
                    <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                      {tool.description}
                    </span>
                  </span>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </main>
  )
}

import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getToolManifest } from '@/lib/tools/registry'
import { fetchToolEntries } from '@/lib/tools/storage'

interface ToolPageProps {
  params: Promise<{ toolId: string }>
}

export default async function ToolPage({ params }: ToolPageProps) {
  const { toolId } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const tool = getToolManifest(toolId)
  if (!tool) notFound()

  const Icon = tool.icon
  const ToolComponent = tool.Component
  const initialEntries = await fetchToolEntries(supabase, user.id, tool.id)

  return (
    <main className="min-h-svh bg-background p-4 pb-24 sm:p-8">
      <div className="mx-auto max-w-2xl space-y-6">
        <header>
          <Link
            href="/learn/tools"
            className="mb-4 inline-flex min-h-11 items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            Toolbox
          </Link>
          <div className="flex items-center gap-3">
            <span className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Icon className="size-5" />
            </span>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">{tool.title}</h1>
              <p className="text-sm text-muted-foreground">{tool.description}</p>
            </div>
          </div>
        </header>

        <ToolComponent userId={user.id} initialEntries={initialEntries} />
      </div>
    </main>
  )
}

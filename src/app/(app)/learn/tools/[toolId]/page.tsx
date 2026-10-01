import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getToolManifest } from '@/lib/tools/registry'
import { fetchToolEntries } from '@/lib/tools/storage'
import { fetchChallengePrograms } from '@/lib/challenge-programs'
import { CHALLENGE_RETURN_PARAM } from '@/lib/challenge-rules'
import { ToolChallengeRunner, type ToolChallengeContext } from '@/components/challenges/ToolChallengeRunner'
import type { SupabaseClient } from '@supabase/supabase-js'

interface ToolPageProps {
  params: Promise<{ toolId: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * The challenge a day's button opened this tool from, when the link carried
 * one and the user is actually doing it. Anything else is ignored, so a
 * crafted link can only ever show the plain tool.
 */
async function challengeContext(
  supabase: SupabaseClient,
  userId: string,
  value: string | string[] | undefined
): Promise<ToolChallengeContext | null> {
  const templateId = typeof value === 'string' ? value : null
  if (!templateId || !UUID_PATTERN.test(templateId)) return null
  const [program] = await fetchChallengePrograms(supabase, userId, { templateId })
  if (!program?.enrollment || program.enrollment.status !== 'active') return null
  return {
    templateId,
    enrollmentId: program.enrollment.id,
    title: program.template.title,
    dayNumber: Math.min(program.progress.length + 1, program.template.duration_days),
    totalDays: program.template.duration_days,
  }
}

export default async function ToolPage({ params, searchParams }: ToolPageProps) {
  const { toolId } = await params
  const query = await searchParams
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const tool = getToolManifest(toolId)
  if (!tool) notFound()

  const Icon = tool.icon
  const ToolComponent = tool.Component
  const [initialEntries, challenge] = await Promise.all([
    fetchToolEntries(supabase, user.id, tool.id),
    challengeContext(supabase as unknown as SupabaseClient, user.id, query[CHALLENGE_RETURN_PARAM]),
  ])

  return (
    <main className="min-h-svh bg-background p-4 pb-24 sm:p-8">
      <div className="mx-auto max-w-2xl space-y-6">
        <header>
          <Link
            href={challenge ? `/challenges/${challenge.templateId}` : '/learn/tools'}
            className="mb-4 inline-flex min-h-11 items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            {challenge ? challenge.title : 'Toolbox'}
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

        {challenge ? (
          <ToolChallengeRunner toolId={tool.id} userId={user.id} initialEntries={initialEntries} challenge={challenge} />
        ) : (
          <ToolComponent userId={user.id} initialEntries={initialEntries} />
        )}
      </div>
    </main>
  )
}

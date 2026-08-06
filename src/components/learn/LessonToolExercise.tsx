'use client'

import { Suspense, use, useState } from 'react'
import { TriangleAlert } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { getToolManifest, type ToolManifest } from '@/lib/tools/registry'
import { fetchToolEntries, type ToolEntry } from '@/lib/tools/storage'
import type { ToolExercise } from '@/lib/learning-paths'
import { cn } from '@/lib/utils'

interface ToolContext {
  userId: string
  entries: ToolEntry[]
}

async function loadToolContext(toolId: string): Promise<ToolContext | null> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  return { userId: user.id, entries: await fetchToolEntries(supabase, user.id, toolId) }
}

/**
 * Loads through `use()` rather than a fetch effect. The lesson page is a
 * client component, so the entries cannot be passed down from the server the
 * way the standalone tool route does it — and an on-mount fetch effect would
 * trip react-hooks/set-state-in-effect.
 */
function ToolRunner({
  manifest,
  contextPromise,
  onUsed,
}: {
  manifest: ToolManifest
  contextPromise: Promise<ToolContext | null>
  onUsed: () => void
}) {
  const context = use(contextPromise)

  if (!context) {
    return (
      <p className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
        Sign in again to use this tool.
      </p>
    )
  }

  const ToolComponent = manifest.Component

  return (
    <ToolComponent
      userId={context.userId}
      initialEntries={context.entries}
      onUsed={onUsed}
    />
  )
}

export function LessonToolExercise({
  exercise,
  accentSoft,
  onUsed,
}: {
  exercise: ToolExercise
  accentSoft: string
  onUsed: () => void
}) {
  const manifest = getToolManifest(exercise.toolId)
  // Held in state so the promise survives re-renders; recreating it each
  // render would make `use()` suspend forever.
  const [contextPromise] = useState(() =>
    manifest ? loadToolContext(manifest.id) : Promise.resolve(null)
  )

  if (!manifest) {
    // Authored content can reference a tool that no longer exists; the
    // database validates the shape of a tool exercise but knows nothing about
    // TOOL_REGISTRY, so this has to fail visibly rather than silently.
    return (
      <div className="my-auto">
        <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-800 dark:text-amber-200">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          <p>
            This lesson references a tool called <code>{exercise.toolId}</code>, which is
            not available in this version of the app.
          </p>
        </div>
      </div>
    )
  }

  const Icon = manifest.icon

  return (
    <div className="my-auto">
      <div className={cn('mb-6 grid size-16 place-items-center rounded-2xl', accentSoft)}>
        <Icon className="size-7" />
      </div>
      <h1 className="max-w-2xl text-2xl font-semibold tracking-tight sm:text-3xl">
        {exercise.prompt}
      </h1>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">
        {manifest.description} You can come back to it any time from the Toolbox.
      </p>

      <div className="mt-6">
        <Suspense
          fallback={
            <div className="h-40 animate-pulse rounded-2xl bg-muted" aria-busy="true">
              <span className="sr-only">Loading {manifest.title}</span>
            </div>
          }
        >
          <ToolRunner manifest={manifest} contextPromise={contextPromise} onUsed={onUsed} />
        </Suspense>
      </div>
    </div>
  )
}

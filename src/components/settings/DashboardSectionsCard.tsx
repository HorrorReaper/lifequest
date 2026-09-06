'use client'

import { useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { supabaseUpdateWhere } from '@/lib/supabase/helpers'
import {
  isSectionVisible,
  sectionsFor,
  type DashboardSectionVisibility,
} from '@/lib/dashboard-sections'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'

interface DashboardSectionsCardProps {
  userId: string
  isAdmin: boolean
  initial: DashboardSectionVisibility
}

/**
 * Which sections the dashboard shows.
 *
 * Saving is optimistic with a rollback rather than write-then-update like
 * the AI consent card next door: that is one weighty decision where waiting
 * is right, this is six switches where a visible round trip behind each
 * would be tiresome.
 */
export function DashboardSectionsCard({
  userId,
  isAdmin,
  initial,
}: DashboardSectionsCardProps) {
  const [supabase] = useState(() => createClient())
  const [visibility, setVisibility] = useState(initial)
  const [error, setError] = useState<string | null>(null)
  // Mirrors `visibility` synchronously so a second toggle fired before React
  // re-renders from the first still reads the first's change: `visibility`
  // itself is a stale closure until the next render lands.
  const visibilityRef = useRef(initial)
  // Serializes the network writes: each toggle chains its write onto this
  // promise instead of firing immediately, so only one write is ever in
  // flight against the row. Without this, two writes race independently of
  // click order and the row can end up holding a value neither the rollback
  // nor the UI knows about.
  const writeChainRef = useRef<Promise<void>>(Promise.resolve())

  const sections = sectionsFor({ isAdmin })

  async function save(id: string, previousValue: boolean) {
    // Built from the ref at send time, not at click time: by the time this
    // write actually goes out, an earlier queued write may have already
    // rolled its own key back (or another click may have landed), and this
    // payload needs to carry that, not a stale snapshot from when it was
    // queued.
    const { error: saveError } = await supabaseUpdateWhere(
      supabase,
      'profiles',
      {
        dashboard_sections: visibilityRef.current,
        updated_at: new Date().toISOString(),
      },
      'id',
      userId
    )

    if (saveError) {
      // Roll back only this switch's key. A different, later toggle may
      // have already succeeded and been persisted while this write was in
      // flight; restoring the whole pre-click snapshot would silently
      // discard that already-saved change from the UI.
      visibilityRef.current = { ...visibilityRef.current, [id]: previousValue }
      setVisibility(visibilityRef.current)
      setError('We could not save which sections to show. Please try again.')
    }
  }

  function toggle(id: string, next: boolean) {
    const previousValue = isSectionVisible(visibilityRef.current, id)
    // The whole map goes to the database. Sending only the key that moved
    // would drop every other choice back to its default. Built from the
    // ref, not the `visibility` state, so a fast second click includes the
    // first click's still-in-flight change in its own payload.
    const updated = { ...visibilityRef.current, [id]: next }
    visibilityRef.current = updated
    setVisibility(updated)
    setError(null)

    // Chain onto the queue rather than sending now: this write will not
    // actually reach the network until every write queued ahead of it has
    // settled, so writes land in click order and each one's payload is
    // built from whatever the ref holds once its turn comes up.
    writeChainRef.current = writeChainRef.current
      .then(() => save(id, previousValue))
      .catch(() => {
        // A rejection here would be a bug in save() itself (it already
        // reports save failures via saveError), but if one ever slips
        // through, don't let it wedge every write queued after it.
      })
  }

  return (
    <Card className="border-border/50">
      <CardHeader>
        <CardTitle>Start screen</CardTitle>
        <CardDescription>
          Choose what your dashboard shows. Hiding a section does not delete
          anything; it stays reachable from the menu.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {sections.map((section) => (
          <div
            key={section.id}
            className="flex items-start justify-between gap-4 rounded-xl border bg-muted/25 p-4"
          >
            <div className="min-w-0 space-y-1">
              <Label
                htmlFor={`dashboard-section-${section.id}`}
                className="text-sm font-semibold"
              >
                {section.label}
              </Label>
              <p className="text-xs leading-relaxed text-muted-foreground">
                {section.description}
              </p>
            </div>
            <Switch
              id={`dashboard-section-${section.id}`}
              aria-label={section.label}
              checked={isSectionVisible(visibility, section.id)}
              onCheckedChange={(next) => toggle(section.id, next)}
            />
          </div>
        ))}

        {error && <p className="text-xs text-destructive">{error}</p>}
      </CardContent>
    </Card>
  )
}

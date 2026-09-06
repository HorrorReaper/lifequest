'use client'

import { useState } from 'react'
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

  const sections = sectionsFor({ isAdmin })

  async function toggle(id: string, next: boolean) {
    const previous = visibility
    // The whole map goes to the database. Sending only the key that moved
    // would drop every other choice back to its default.
    const updated = { ...visibility, [id]: next }

    setVisibility(updated)
    setError(null)

    const { error: saveError } = await supabaseUpdateWhere(
      supabase,
      'profiles',
      {
        dashboard_sections: updated,
        updated_at: new Date().toISOString(),
      },
      'id',
      userId
    )

    if (saveError) {
      setVisibility(previous)
      setError('We could not save which sections to show. Please try again.')
    }
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
              onCheckedChange={(next) => void toggle(section.id, next)}
            />
          </div>
        ))}

        {error && <p className="text-xs text-destructive">{error}</p>}
      </CardContent>
    </Card>
  )
}

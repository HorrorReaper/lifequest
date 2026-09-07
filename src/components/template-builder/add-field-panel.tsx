'use client'

import { motion } from 'framer-motion'
import { FIELD_REGISTRY, FieldTypeDefinition } from '@/lib/field-registry'
import type { FieldType } from '@/lib/types'

interface AddFieldPanelProps {
  onAdd: (definition: FieldTypeDefinition) => void
}

/**
 * The palette, sorted by what a field is for.
 *
 * Fifteen equally weighted tiles told nobody that "Habit Tracker" is a
 * different order of thing from "Short Text". Any type missing from a group
 * still shows up, under Other, so adding one to the registry cannot silently
 * drop it from the palette.
 */
const FIELD_GROUPS: { label: string; types: FieldType[] }[] = [
  { label: 'Text', types: ['text', 'textarea', 'prompt'] },
  { label: 'Scales & choice', types: ['number', 'slider', 'rating', 'mood', 'select', 'checkbox'] },
  { label: 'Structure', types: ['heading', 'divider', 'checklist'] },
  { label: 'Integrations', types: ['tasks', 'day_planner', 'habit_tracker'] },
]

export function AddFieldPanel({ onAdd }: AddFieldPanelProps) {
  const availableFields = FIELD_REGISTRY.filter((definition) => definition.type !== 'learning')
  const grouped = FIELD_GROUPS.map((group) => ({
    label: group.label,
    definitions: group.types
      .map((type) => availableFields.find((definition) => definition.type === type))
      .filter((definition): definition is FieldTypeDefinition => Boolean(definition)),
  }))

  const placed = new Set(grouped.flatMap((group) => group.definitions.map((d) => d.type)))
  const ungrouped = availableFields.filter((definition) => !placed.has(definition.type))
  const groups = ungrouped.length
    ? [...grouped, { label: 'Other', definitions: ungrouped }]
    : grouped

  // Precomputed rather than counted up mid-render, so the stagger cannot
  // depend on how often React happens to render this.
  const order = groups.flatMap((group) => group.definitions.map((d) => d.type))

  return (
    <div className="space-y-5">
      <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        Add a Field
      </h3>

      {groups.map((group) => (
        <div key={group.label} className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">{group.label}</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {group.definitions.map((definition) => {
              const delay = order.indexOf(definition.type) * 0.02

              return (
                <motion.div
                  key={definition.type}
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay }}
                >
                  <button
                    type="button"
                    onClick={() => onAdd(definition)}
                    className="flex h-full w-full items-start gap-3 rounded-xl border border-border/60 bg-card p-3 text-left transition-colors hover:border-primary/30 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span aria-hidden="true" className="text-xl leading-none">
                      {definition.icon}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium">{definition.label}</span>
                      <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">
                        {definition.description}
                      </span>
                    </span>
                  </button>
                </motion.div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

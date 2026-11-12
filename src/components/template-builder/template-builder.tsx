'use client'

import { Fragment, useState, useCallback, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { motion, AnimatePresence } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'
import type { Database } from '@/lib/supabase/database.types'
import { supabaseFrom } from '@/lib/supabase/helpers'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { EmojiPicker } from '@/components/ui/emoji-picker'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Eye } from 'lucide-react'
import {
  SortableFieldItem,
  BuilderField,
} from '@/components/template-builder/sortable-field-item'
import { FieldConfigEditor } from '@/components/template-builder/field-config-editor'
import { AddFieldPanel } from '@/components/template-builder/add-field-panel'
import { TemplatePreview } from '@/components/template-builder/template-preview'
import { FieldTypeDefinition, getFieldDefinition } from '@/lib/field-registry'
import {
  fetchTemplateMetricLinks,
  matchFieldsByLabel,
  updateMetric,
  type TemplateMetricLink,
} from '@/lib/metrics'

interface TemplateBuilderProps {
  templateId?: string
  initialName?: string
  initialDescription?: string
  initialEntryType?: string
  initialIcon?: string
  initialXpReward?: number
  initialFields?: BuilderField[]
  isSystem?: boolean
}

const ENTRY_TYPES = [
  { value: 'morning', label: '🌅 Morning' },
  { value: 'evening', label: '🌙 Evening' },
  { value: 'weekly', label: '📝 Weekly' },
  { value: 'free_write', label: '✍️ Free Write' },
  { value: 'custom', label: '🎨 Custom' },
]

export function TemplateBuilder({
  templateId,
  initialName = '',
  initialDescription = '',
  initialEntryType = 'custom',
  initialIcon = '📓',
  initialXpReward = 10,
  initialFields = [],
  isSystem = false,
}: TemplateBuilderProps) {
  const router = useRouter()
  const supabase = createClient()

  const [name, setName] = useState(initialName)
  const [description, setDescription] = useState(initialDescription)
  const [entryType, setEntryType] = useState(initialEntryType)
  const [icon, setIcon] = useState(initialIcon)
  const [xpReward, setXpReward] = useState(initialXpReward)
  const [fields, setFields] = useState<BuilderField[]>(initialFields)
  const [editingField, setEditingField] = useState<BuilderField | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Below lg the preview cannot sit beside the builder, so it moves into a
  // sheet the same way the dashboard puts its day management in one.
  const [previewOpen, setPreviewOpen] = useState(false)
  // Metrics tied to this template, for the "Also asks for" line and the
  // field editor's "Feeds metric" note. A failed read only hides them.
  const [metricLinks, setMetricLinks] = useState<TemplateMetricLink[]>([])

  useEffect(() => {
    if (!templateId || isSystem) return
    let cancelled = false

    fetchTemplateMetricLinks(
      createClient(),
      templateId,
      initialFields.map((f) => f.id)
    )
      .then((links) => {
        if (!cancelled) setMetricLinks(links)
      })
      .catch((err) => console.error('Metric links error:', err))

    return () => {
      cancelled = true
    }
    // The initial fields are only the first read's lookup keys; reloading
    // when the parent re-renders would not find anything new.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateId, isSystem])

  const feedsMetricByFieldId = useMemo(() => {
    const feeds: Record<string, string> = {}
    for (const link of metricLinks) {
      if (link.sourceFieldId) feeds[link.sourceFieldId] = link.name
    }
    return feeds
  }, [metricLinks])

  const alsoAsksFor = metricLinks
    .filter((link) => link.templateId === templateId)
    .map((link) => ({ id: link.id, name: link.name }))

  const sensors = useSensors( // DnD Kit Sensoren für Maus und Tastatur
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  // Drag end handler
  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    setFields((prev) => {
      const oldIndex = prev.findIndex((f) => f.id === active.id)
      const newIndex = prev.findIndex((f) => f.id === over.id)
      return arrayMove(prev, oldIndex, newIndex)
    })
  }

  // Add a new field
  const handleAddField = useCallback((definition: FieldTypeDefinition) => {
    const newField: BuilderField = {
      id: `new_${crypto.randomUUID()}`,
      field_type: definition.type,
      label: definition.isDisplayOnly
        ? definition.type === 'heading'
          ? 'New Section'
          : ''
        : '',
      description: null,
      placeholder: null,
      is_required: false,
      sort_order: 0,
      config: { ...definition.defaultConfig },
      xp_rules: [], // Start with empty XP rules
    }
    setFields((prev) => [...prev, newField])
    // Auto-open editor for non-display fields
    if (!definition.isDisplayOnly || definition.type === 'heading') {
      setEditingField(newField)
    }
  }, [])

  // Delete a field
  function handleDeleteField(id: string) {
    setFields((prev) => prev.filter((f) => f.id !== id))
  }

  // Update a field after editing
  function handleSaveField(updated: BuilderField) {
    setFields((prev) =>
      prev.map((f) => (f.id === updated.id ? updated : f))
    )
  }

  // Save entire template
  async function handleSave() {
    if (!name.trim()) {
      setError('Template name is required.')
      return
    }
    if (fields.length === 0) {
      setError('Add at least one field.')
      return
    }

    setSaving(true)
    setError(null)

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      let savedTemplateId = templateId
      // Metrics fed by the fields about to be replaced, with those fields as
      // they are now. Read before the delete: the foreign key nulls
      // metrics.source_field_id as soon as the old fields are gone.
      let linkedToOldFields: TemplateMetricLink[] = []
      let oldFields: { id: string; label: string }[] = []

      if (savedTemplateId && !isSystem) {
        // Nothing may be written before we know the fields can be replaced.
        // This check used to run after the metadata update, which left a
        // refused save with a changed name, icon and XP reward on a template
        // whose fields had not moved.
        const { data: existingFields, error: fieldsError } = await supabase
          .from('template_fields')
          .select('id, label')
          .eq('template_id', savedTemplateId)
          // Pairing by label hands duplicates out in order, so both lists
          // have to be in field order.
          .order('sort_order', { ascending: true })

        // A failed read must not look like "no fields" or "no responses":
        // both would let the delete below run.
        if (fieldsError) throw fieldsError

        oldFields = (existingFields ?? []) as { id: string; label: string }[]
        const fieldIds = oldFields.map((f) => f.id)
        if (fieldIds.length > 0) {
          const { count, error: countError } = await supabase
            .from('journal_responses')
            .select('id', { count: 'exact', head: true })
            .in('field_id', fieldIds)

          if (countError) throw countError

          if ((count ?? 0) > 0) {
            setError('Cannot modify template fields because there are existing responses. Duplicate or archive the template first.')
            setSaving(false)
            return
          }
        }

        if (fieldIds.length > 0) {
          const links = await fetchTemplateMetricLinks(supabase, savedTemplateId, fieldIds)
          linkedToOldFields = links.filter(
            (link) => link.sourceFieldId && fieldIds.includes(link.sourceFieldId)
          )
        }

        // Update existing template
        const { error: updateError } = await supabaseFrom(supabase, 'journal_templates')
          .update({
            name: name.trim(),
            description: description.trim() || null,
            entry_type: entryType,
            icon,
            xp_reward: xpReward,
            updated_at: new Date().toISOString(),
          })
          .eq('id', savedTemplateId)
          .eq('user_id', user.id)

        if (updateError) throw updateError

        // Delete existing fields and re-insert (safe because no responses reference them)
        const { error: deleteError } = await supabase
          .from('template_fields')
          .delete()
          .eq('template_id', savedTemplateId)

        if (deleteError) throw deleteError
      } else {
        // Create new template
        const { data: newTemplate, error: insertError } = await supabaseFrom(supabase, 'journal_templates')
          .insert({
            user_id: user.id,
            name: name.trim(),
            description: description.trim() || null,
            entry_type: entryType,
            icon,
            xp_reward: xpReward,
            is_system: false,
            is_default: false,
          })
          .select('id')
          .single()

        if (insertError) throw insertError
        savedTemplateId = newTemplate.id
      }

      // Insert fields with correct sort order
      const fieldInserts = fields.map((field, index) => ({
        template_id: savedTemplateId!,
        field_type: field.field_type,
        // Falls back to the type's readable name: an unnamed field used to
        // reach the journal labelled "mood" or "textarea".
        label: field.label || getFieldDefinition(field.field_type).label,
        description: field.description,
        placeholder: field.placeholder,
        is_required: field.is_required,
        sort_order: index,
        config: field.config,
        xp_rules: field.xp_rules ?? [],
      }))

      const { data: insertedFields, error: fieldsError } = await supabaseFrom(
        supabase,
        'template_fields'
      )
        .insert(fieldInserts)
        .select('id, label, sort_order')

      if (fieldsError) throw fieldsError

      // The fields have new ids now. Point each metric at the field with the
      // same label; one whose field is gone stays unlinked (it is null
      // already) and keeps asking for its value in the entry's Metrics block.
      if (linkedToOldFields.length > 0) {
        const newIdByOldId = matchFieldsByLabel(
          oldFields,
          [...((insertedFields ?? []) as { id: string; label: string; sort_order?: number }[])].sort(
            (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)
          )
        )
        const unrestored: string[] = []

        for (const metric of linkedToOldFields) {
          try {
            await updateMetric(supabase, metric.id, {
              sourceFieldId: newIdByOldId.get(metric.sourceFieldId!) ?? null,
            })
          } catch (err) {
            console.error('Metric link error:', err)
            unrestored.push(metric.name)
          }
        }

        // The builder keeps its field ids after a save, so a restored link
        // still points at the right field here. A lost one does not.
        const lost = new Set(linkedToOldFields.filter((m) => unrestored.includes(m.name)).map((m) => m.id))
        const gone = new Set(
          linkedToOldFields.filter((m) => !newIdByOldId.get(m.sourceFieldId!)).map((m) => m.id)
        )
        setMetricLinks((links) =>
          links.map((link) =>
            lost.has(link.id) || gone.has(link.id) ? { ...link, sourceFieldId: null } : link
          )
        )

        if (unrestored.length > 0) {
          setError(
            `The template was saved, but these metrics lost their field link: ${unrestored.join(', ')}. They still appear in the entry's Metrics block.`
          )
          return
        }
      }

      router.push('/journal/templates')
      router.refresh()
    } catch (err) {
      console.error('Save error:', err)
      setError('Failed to save template. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const renderPreview = (showLabel: boolean) => (
    <TemplatePreview
      icon={icon}
      name={name}
      description={description}
      fields={fields}
      showLabel={showLabel}
    />
  )

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)] lg:items-start">
      <div className="space-y-6">
      {/* Template Metadata */}
      <Card className="border-border/50">
        <CardContent className="space-y-4 pt-6">
          <div className="flex items-start gap-4">
            {/* Icon picker -- the same one habits use, so both are chosen the
                same way and the choice is not limited to a fixed handful. */}
            <div className="space-y-2">
              <Label>Icon</Label>
              <EmojiPicker value={icon} onChange={setIcon} label="Choose template icon" />
            </div>

            <div className="flex-1 space-y-3">
              <div className="space-y-2">
                <Label htmlFor="template-name">Template Name</Label>
                <Input
                  id="template-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="My Custom Journal"
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="template-desc">Description</Label>
                <Textarea
                  id="template-desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="A short description of this journal template..."
                  rows={2}
                  className="resize-none"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Entry Type</Label>
              <select
                value={entryType}
                onChange={(e) => setEntryType(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {ENTRY_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>XP Reward</Label>
              <Input
                type="number"
                min={1}
                max={100}
                value={xpReward}
                onChange={(e) => setXpReward(Number(e.target.value))}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Separator />

      {/* Fields List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Fields ({fields.length})
          </h3>
          <Button
            variant="outline"
            size="sm"
            className="lg:hidden"
            onClick={() => setPreviewOpen(true)}
          >
            <Eye className="size-4" />
            Preview
          </Button>
        </div>

        {fields.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border/50 p-8 text-center">
            <p className="text-3xl mb-2">🧱</p>
            <p className="text-sm text-muted-foreground">
              No fields yet. Add fields from the palette below.
            </p>
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={fields.map((f) => f.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-2">
                <AnimatePresence>
                  {fields.map((field) => (
                    <motion.div
                      key={field.id}
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <SortableFieldItem
                        field={field}
                        onEdit={setEditingField}
                        onDelete={handleDeleteField}
                      />
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>

      <Separator />

      {alsoAsksFor.length > 0 && (
        <p className="text-sm text-muted-foreground">
          Also asks for:{' '}
          {alsoAsksFor.map((metric, index) => (
            <Fragment key={metric.id}>
              {index > 0 && ', '}
              <Link href={`/journal/metrics/${metric.id}`} className="underline underline-offset-2">
                {metric.name}
              </Link>
            </Fragment>
          ))}
        </p>
      )}

      {/* Add Field Palette */}
      <AddFieldPanel onAdd={handleAddField} />

      {/* Error */}
      {error && <p className="text-sm text-destructive">{error}</p>}

      {/* Save / Cancel */}
      <div className="flex gap-3 pt-4">
        <Button
          variant="outline"
          className="flex-1"
          onClick={() => router.back()}
        >
          Cancel
        </Button>
        <Button className="flex-1" onClick={handleSave} disabled={saving}>
          {saving
            ? 'Saving...'
            : templateId && !isSystem
            ? 'Save Changes'
            : 'Create Template'}
        </Button>
      </div>

      {/* Field Config Editor Dialog */}
      <FieldConfigEditor
        field={editingField}
        open={!!editingField}
        onClose={() => setEditingField(null)}
        onSave={handleSaveField}
        feedsMetricByFieldId={feedsMetricByFieldId}
      />
      </div>

      {/* Wide screens keep the preview in view while the builder scrolls. */}
      <div className="hidden lg:sticky lg:top-8 lg:block">{renderPreview(true)}</div>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="bottom-0 top-auto max-h-[92svh] max-w-none translate-y-0 gap-0 overflow-y-auto rounded-b-none rounded-t-3xl sm:bottom-auto sm:top-1/2 sm:max-w-lg sm:-translate-y-1/2 sm:rounded-xl">
          <DialogHeader className="pr-10 text-left">
            <DialogTitle>Preview</DialogTitle>
          </DialogHeader>
          <div className="mt-2">{renderPreview(false)}</div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

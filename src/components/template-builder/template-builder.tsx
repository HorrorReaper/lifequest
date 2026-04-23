'use client'

import { useState, useCallback } from 'react'
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
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import {
  SortableFieldItem,
  BuilderField,
} from '@/components/template-builder/sortable-field-item'
import { FieldConfigEditor } from '@/components/template-builder/field-config-editor'
import { AddFieldPanel } from '@/components/template-builder/add-field-panel'
import { FieldTypeDefinition } from '@/lib/field-registry'

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

const TEMPLATE_ICONS = [
  '📓', '🌅', '🌙', '📝', '✍️', '💡', '🎯', '🧠',
  '💪', '🙏', '🌟', '🔥', '📖', '💭', '🎨', '🏆',
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

      if (savedTemplateId && !isSystem) {
        // Update existing template
        const { error: updateError } = await supabase
          .from('journal_templates')
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

        // Delete existing fields and re-insert
        await supabase
          .from('template_fields')
          .delete()
          .eq('template_id', savedTemplateId)
      } else {
        // Create new template
        const { data: newTemplate, error: insertError } = await supabase
          .from('journal_templates')
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
        label: field.label || field.field_type,
        description: field.description,
        placeholder: field.placeholder,
        is_required: field.is_required,
        sort_order: index,
        config: field.config,
      }))

      const { error: fieldsError } = await supabase
        .from('template_fields')
        .insert(fieldInserts)

      if (fieldsError) throw fieldsError

      router.push('/journal/templates')
      router.refresh()
    } catch (err) {
      console.error('Save error:', err)
      setError('Failed to save template. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Template Metadata */}
      <Card className="border-border/50">
        <CardContent className="space-y-4 pt-6">
          <div className="flex items-start gap-4">
            {/* Icon picker */}
            <div className="space-y-2">
              <Label>Icon</Label>
              <div className="relative">
                <button
                  type="button"
                  className="flex h-14 w-14 items-center justify-center rounded-xl border border-border/50 bg-card text-3xl hover:bg-muted/50 transition-colors"
                  onClick={() => {
                    const currentIndex = TEMPLATE_ICONS.indexOf(icon)
                    const nextIndex =
                      (currentIndex + 1) % TEMPLATE_ICONS.length
                    setIcon(TEMPLATE_ICONS[nextIndex])
                  }}
                >
                  {icon}
                </button>
              </div>
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
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Fields ({fields.length})
        </h3>

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
      />
    </div>
  )
}

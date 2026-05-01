'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { BuilderField } from './sortable-field-item'
import { getFieldDefinition } from '@/lib/field-registry'
// diese Komponente zeigt einen Dialog an, in dem die Konfiguration eines Feldes bearbeitet werden kann. Je nach Feldtyp werden unterschiedliche Konfigurationsoptionen angezeigt, z.B. Label, Beschreibung, Platzhalter, erforderlicher Status und spezifische Einstellungen wie Min/Max Werte oder Optionen für Select-Felder. Beim Speichern werden die Änderungen an die übergebenen Callback-Funktionen weitergegeben.

interface FieldConfigEditorProps {
  field: BuilderField | null
  open: boolean
  onClose: () => void
  onSave: (field: BuilderField) => void
}

export function FieldConfigEditor({
  field,
  open,
  onClose,
  onSave,
}: FieldConfigEditorProps) {
  const [editedField, setEditedField] = useState<BuilderField | null>(null)

  // Sync when field changes
  if (field && (!editedField || editedField.id !== field.id)) {
    setEditedField({ ...field })
  }

  if (!editedField) return null

  const definition = getFieldDefinition(editedField.field_type)
  const config = editedField.config as Record<string, unknown>

  function updateConfig(key: string, value: unknown) {
    setEditedField((prev) =>
      prev ? { ...prev, config: { ...prev.config, [key]: value } } : prev
    )
  }

  function handleSave() {
    if (editedField) {
      onSave(editedField)
      onClose()
      setEditedField(null)
    }
  }

  function handleClose() {
    onClose()
    setEditedField(null)
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span>{definition.icon}</span>
            Edit {definition.label}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Label */}
          {!definition.isDisplayOnly || editedField.field_type === 'heading' ? (
            <div className="space-y-2">
              <Label>Label</Label>
              <Input
                value={editedField.label}
                onChange={(e) =>
                  setEditedField({ ...editedField, label: e.target.value })
                }
                placeholder="Field label"
              />
            </div>
          ) : null}

          {/* Description */}
          {!definition.isDisplayOnly && (
            <div className="space-y-2">
              <Label>Helper Text</Label>
              <Input
                value={editedField.description ?? ''}
                onChange={(e) =>
                  setEditedField({
                    ...editedField,
                    description: e.target.value || null,
                  })
                }
                placeholder="Optional helper text below the field"
              />
            </div>
          )}

          {/* Placeholder */}
          {['text', 'textarea'].includes(editedField.field_type) && (
            <div className="space-y-2">
              <Label>Placeholder</Label>
              <Input
                value={editedField.placeholder ?? ''}
                onChange={(e) =>
                  setEditedField({
                    ...editedField,
                    placeholder: e.target.value || null,
                  })
                }
                placeholder="Placeholder text..."
              />
            </div>
          )}

          {/* Required toggle */}
          {!definition.isDisplayOnly && (
            <div className="flex items-center justify-between">
              <Label>Required</Label>
              <Switch
                checked={editedField.is_required}
                onCheckedChange={(checked) =>
                  setEditedField({ ...editedField, is_required: checked })
                }
              />
            </div>
          )}

          {/* Heading level */}
          {editedField.field_type === 'heading' && (
            <div className="space-y-2">
              <Label>Heading Level</Label>
              <div className="flex gap-2">
                {[1, 2, 3].map((level) => (
                  <Button
                    key={level}
                    type="button"
                    variant={
                      (config.level ?? 2) === level ? 'default' : 'outline'
                    }
                    size="sm"
                    onClick={() => updateConfig('level', level)}
                  >
                    H{level}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* Max length for textarea */}
          {editedField.field_type === 'textarea' && (
            <div className="space-y-2">
              <Label>Max Length</Label>
              <Input
                type="number"
                value={(config.maxLength as number) ?? 2000}
                onChange={(e) =>
                  updateConfig('maxLength', Number(e.target.value))
                }
              />
            </div>
          )}

          {/* Min/Max for number and slider */}
          {['number', 'slider'].includes(editedField.field_type) && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Min</Label>
                <Input
                  type="number"
                  value={(config.min as number) ?? 1}
                  onChange={(e) => updateConfig('min', Number(e.target.value))}
                />
              </div>
              <div className="space-y-2">
                <Label>Max</Label>
                <Input
                  type="number"
                  value={(config.max as number) ?? 10}
                  onChange={(e) => updateConfig('max', Number(e.target.value))}
                />
              </div>
            </div>
          )}

          {/* Slider labels */}
          {editedField.field_type === 'slider' && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Low Label</Label>
                <Input
                  value={((config.labels as string[]) ?? ['Low', 'High'])[0]}
                  onChange={(e) => {
                    const labels = (config.labels as string[]) ?? [
                      'Low',
                      'High',
                    ]
                    updateConfig('labels', [e.target.value, labels[1]])
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label>High Label</Label>
                <Input
                  value={((config.labels as string[]) ?? ['Low', 'High'])[1]}
                  onChange={(e) => {
                    const labels = (config.labels as string[]) ?? [
                      'Low',
                      'High',
                    ]
                    updateConfig('labels', [labels[0], e.target.value])
                  }}
                />
              </div>
            </div>
          )}

          {/* Star rating max */}
          {editedField.field_type === 'rating' && (
            <div className="space-y-2">
              <Label>Max Stars</Label>
              <Input
                type="number"
                min={3}
                max={10}
                value={(config.max as number) ?? 5}
                onChange={(e) => updateConfig('max', Number(e.target.value))}
              />
            </div>
          )}

          {/* Select options */}
          {editedField.field_type === 'select' && (
            <div className="space-y-2">
              <Label>Options (one per line)</Label>
              <Textarea
                value={((config.options as string[]) ?? []).join('\n')}
                onChange={(e) =>
                  updateConfig(
                    'options',
                    e.target.value.split('\n').filter((s) => s.trim())
                  )
                }
                rows={4}
                placeholder={'Option 1\nOption 2\nOption 3'}
              />
            </div>
          )}

          {/* Checklist items */}
          {editedField.field_type === 'checklist' && (
            <div className="space-y-2">
              <Label>Checklist Items (one per line)</Label>
              <Textarea
                value={((config.items as string[]) ?? []).join('\n')}
                onChange={(e) =>
                  updateConfig(
                    'items',
                    e.target.value.split('\n').filter((s) => s.trim())
                  )
                }
                rows={4}
                placeholder={'Meditated\nExercised\nRead'}
              />
            </div>
          )}

          {/* Prompt category */}
          {editedField.field_type === 'prompt' && (
            <div className="space-y-2">
              <Label>Prompt Category</Label>
              <select
                value={(config.category as string) ?? 'self_discovery'}
                onChange={(e) => updateConfig('category', e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="self_discovery">Self Discovery</option>
                <option value="growth">Growth & Goals</option>
                <option value="relationships">Relationships</option>
                <option value="mindset">Mindset & Mental Health</option>
                <option value="celebration">Celebration & Gratitude</option>
                <option value="future_vision">Future Vision</option>
              </select>
            </div>
          )}
          {editedField.field_type === "tasks" && (
  <>
    <div className="space-y-2">
      <Label>Default Priority</Label>
      <select
        value={(config.defaultPriority as string) ?? "medium"}
        onChange={(e) => updateConfig("defaultPriority", e.target.value)}
        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
      >
        <option value="low">Low</option>
        <option value="medium">Medium</option>
        <option value="high">High</option>
      </select>
    </div>
    <div className="space-y-2">
      <Label>Max Tasks per Entry</Label>
      <Input
        type="number"
        min={1}
        max={50}
        value={(config.maxTasks as number) ?? 10}
        onChange={(e) => updateConfig("maxTasks", Number(e.target.value))}
      />
    </div>
  </>
)}
{editedField.field_type === "day_planner" && (
  <>
    <div className="space-y-2">
      <Label>Default Plan Date</Label>
      <select
        value={(config.defaultDate as string) ?? "tomorrow"}
        onChange={(e) => updateConfig("defaultDate", e.target.value)}
        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
      >
        <option value="tomorrow">Tomorrow</option>
        <option value="today">Today</option>
      </select>
    </div>
    <div className="space-y-2">
      <Label>Default Start Hour (0–23)</Label>
      <Input
        type="number"
        min={0}
        max={23}
        value={(config.startHour as number) ?? 9}
        onChange={(e) => updateConfig("startHour", Number(e.target.value))}
      />
    </div>
  </>
)}


        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button onClick={handleSave}>Save Field</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

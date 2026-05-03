'use client'

import { useState, useEffect } from 'react'
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
import { Habit } from '@/lib/types'
import { createClient } from '@/lib/supabase/client'
import { fetchHabits } from '@/lib/habits'
import { XpRule, XpRuleOperator } from "@/lib/types";
import { Sparkles, Plus, X } from "lucide-react";
// diese Komponente zeigt einen Dialog an, in dem die Konfiguration eines Feldes bearbeitet werden kann. Je nach Feldtyp werden unterschiedliche Konfigurationsoptionen angezeigt, z.B. Label, Beschreibung, Platzhalter, erforderlicher Status und spezifische Einstellungen wie Min/Max Werte oder Optionen für Select-Felder. Beim Speichern werden die Änderungen an die übergebenen Callback-Funktionen weitergegeben.

// Helpers — operators per field type
function operatorsForType(type: string): { value: XpRuleOperator; label: string; needsValue: boolean }[] {
  switch (type) {
    case "checkbox":
      return [
        { value: "is_checked", label: "is checked (Yes)", needsValue: false },
        { value: "is_not_checked", label: "is unchecked (No)", needsValue: false },
      ];
    case "select":
    case "mood":
      return [
        { value: "equals", label: "equals", needsValue: true },
        { value: "not_equals", label: "is not", needsValue: true },
      ];
    case "number":
    case "slider":
    case "rating":
      return [
        { value: "greater_than", label: "is greater than", needsValue: true },
        { value: "less_than", label: "is less than", needsValue: true },
        { value: "equals", label: "equals", needsValue: true },
      ];
    case "text":
    case "textarea":
      return [
        { value: "contains", label: "contains", needsValue: true },
      ];
    default:
      return [];
  }
}

const SUPPORTS_RULES = ["checkbox", "select", "mood", "number", "slider", "rating", "text", "textarea"];

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
  const [availableHabits, setAvailableHabits] = useState<Habit[]>([]);
  // Sync when `field` prop changes
  useEffect(() => {
    if (field && (!editedField || editedField.id !== field.id)) {
      setEditedField({ ...field })
    }
    if (!field) setEditedField(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [field])

  // Fetch available habits when editing a habit_tracker field
  useEffect(() => {
    if (!editedField) return
    if (editedField.field_type !== 'habit_tracker') return

    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) fetchHabits(supabase, user.id).then(setAvailableHabits)
    })
  }, [editedField])

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
{editedField.field_type === "habit_tracker" && (
  <>
    <div className="flex items-center justify-between">
      <Label>Show all habits automatically</Label>
      <Switch
        checked={Boolean(config.showAll)}
        onCheckedChange={(v) => updateConfig("showAll", v)}
      />
    </div>
    {!config.showAll && (
      <div className="space-y-2">
        <Label>Select habits for this widget</Label>
        {availableHabits.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No habits yet. Add some in Settings first.
          </p>
        ) : (
          <div className="space-y-1 max-h-48 overflow-y-auto rounded-md border p-2">
            {availableHabits.map((h) => {
              const ids = (config.selectedHabitIds as string[]) ?? [];
              const checked = ids.includes(h.id);
              return (
                <label key={h.id} className="flex items-center gap-2 p-1.5 rounded hover:bg-muted/50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => {
                      const next = checked ? ids.filter((id) => id !== h.id) : [...ids, h.id];
                      updateConfig("selectedHabitIds", next);
                    }}
                  />
                  <span>{h.emoji}</span>
                  <span className="text-sm">{h.name}</span>
                </label>
              );
            })}
          </div>
        )}
      </div>
    )}
  </>
)}
{SUPPORTS_RULES.includes(editedField.field_type) && (
  <div className="space-y-2 pt-2 border-t">
    <div className="flex items-center justify-between">
      <Label className="flex items-center gap-1.5">
        <Sparkles className="h-4 w-4 text-purple-500" />
        XP Rules
      </Label>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => {
          const ops = operatorsForType(editedField.field_type);
          if (ops.length === 0) return;
          const newRule: XpRule = {
            id: crypto.randomUUID(),
            operator: ops[0].value,
            value: ops[0].needsValue ? "" : undefined,
            xp: 5,
          };
          setEditedField({
            ...editedField,
            xp_rules: [...(editedField.xp_rules ?? []), newRule],
          });
        }}
      >
        <Plus className="h-3 w-3 mr-1" /> Add rule
      </Button>
    </div>

    <p className="text-xs text-muted-foreground">
      Award bonus XP when the user's answer matches a condition.
    </p>

    {(editedField.xp_rules ?? []).length === 0 ? (
      <p className="text-xs text-muted-foreground italic">No rules yet.</p>
    ) : (
      <div className="space-y-2">
        {(editedField.xp_rules ?? []).map((rule) => {
          const ops = operatorsForType(editedField.field_type);
          const opMeta = ops.find((o) => o.value === rule.operator);

          return (
            <div key={rule.id} className="flex items-center gap-1.5 rounded-md border p-2 bg-muted/30">
              <span className="text-xs text-muted-foreground">If</span>
              <select
                value={rule.operator}
                onChange={(e) => {
                  const next = (editedField.xp_rules ?? []).map((r) =>
                    r.id === rule.id ? { ...r, operator: e.target.value as XpRuleOperator } : r
                  );
                  setEditedField({ ...editedField, xp_rules: next });
                }}
                className="h-8 rounded-md border border-input bg-background px-2 text-xs"
              >
                {ops.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>

              {opMeta?.needsValue && (
                <Input
                  className="h-8 w-24 text-xs"
                  value={String(rule.value ?? "")}
                  onChange={(e) => {
                    const next = (editedField.xp_rules ?? []).map((r) =>
                      r.id === rule.id ? { ...r, value: e.target.value } : r
                    );
                    setEditedField({ ...editedField, xp_rules: next });
                  }}
                  placeholder="value"
                />
              )}

              <span className="text-xs text-muted-foreground">→</span>

              <Input
                type="number"
                min={0}
                max={1000}
                className="h-8 w-16 text-xs"
                value={rule.xp}
                onChange={(e) => {
                  const next = (editedField.xp_rules ?? []).map((r) =>
                    r.id === rule.id ? { ...r, xp: Number(e.target.value) } : r
                  );
                  setEditedField({ ...editedField, xp_rules: next });
                }}
              />
              <span className="text-xs text-muted-foreground">XP</span>

              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-7 w-7 p-0"
                onClick={() => {
                  setEditedField({
                    ...editedField,
                    xp_rules: (editedField.xp_rules ?? []).filter((r) => r.id !== rule.id),
                  });
                }}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          );
        })}
      </div>
    )}
  </div>
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

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { JournalTemplate } from '@/lib/types'

interface TemplateListProps {
  templates: JournalTemplate[]
  isOwner: boolean
  userId: string
}

export function TemplateList({
  templates,
  isOwner,
  userId,
}: TemplateListProps) {
  const router = useRouter()
  const supabase = createClient()

  const [deleteTarget, setDeleteTarget] = useState<JournalTemplate | null>(null)
  const [duplicating, setDuplicating] = useState<string | null>(null)

  async function handleDuplicate(template: JournalTemplate) {
    setDuplicating(template.id)

    try {
      // Fetch original fields
      const { data: fields } = await supabase
        .from('template_fields')
        .select('*')
        .eq('template_id', template.id)
        .order('sort_order')

      // Create new template
      const { data: newTemplate, error: templateError } = await supabase
        .from('journal_templates')
        .insert({
          user_id: userId,
          name: `${template.name} (Copy)`,
          description: template.description,
          entry_type: template.entry_type,
          icon: template.icon,
          xp_reward: template.xp_reward,
          is_system: false,
          is_default: false,
        })
        .select('id')
        .single()

      if (templateError) throw templateError

      // Copy fields
      if (fields && fields.length > 0) {
        const fieldCopies = fields.map((field) => ({
          template_id: newTemplate.id,
          field_type: field.field_type,
          label: field.label,
          description: field.description,
          placeholder: field.placeholder,
          is_required: field.is_required,
          sort_order: field.sort_order,
          config: field.config,
        }))

        await supabase.from('template_fields').insert(fieldCopies)
      }

      router.refresh()
    } catch (err) {
      console.error('Duplicate error:', err)
    } finally {
      setDuplicating(null)
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return

    try {
      await supabase
        .from('journal_templates')
        .update({ is_active: false })
        .eq('id', deleteTarget.id)
        .eq('user_id', userId)

      setDeleteTarget(null)
      router.refresh()
    } catch (err) {
      console.error('Delete error:', err)
    }
  }

  return (
    <>
      <div className="space-y-2">
        {templates.map((template, index) => (
          <motion.div
            key={template.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.03 }}
          >
            <Card className="border-border/50">
              <CardContent className="flex items-center gap-3 p-3">
                <span className="text-2xl">{template.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {template.name}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {template.description}
                    <span className="ml-2">+{template.xp_reward} XP</span>
                  </p>
                </div>
                <div className="flex gap-1">
                  {/* Duplicate (available for all) */}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    disabled={duplicating === template.id}
                    onClick={() => handleDuplicate(template)}
                    title="Duplicate"
                  >
                    {duplicating === template.id ? '⏳' : '📋'}
                  </Button>

                  {/* Edit (owner only, non-system) */}
                  {isOwner && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={() =>
                        router.push(`/journal/templates/${template.id}/edit`)
                      }
                      title="Edit"
                    >
                      ✏️
                    </Button>
                  )}

                  {/* Delete (owner only) */}
                  {isOwner && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 hover:text-destructive"
                      onClick={() => setDeleteTarget(template)}
                      title="Delete"
                    >
                      🗑️
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Template?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete &quot;{deleteTarget?.name}&quot;?
            Past entries using this template will still be viewable.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

// src/components/journal/template-picker.tsx

'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { Card, CardContent } from '@/components/ui/card'
import { JournalTemplate } from '@/lib/types'
import { ArrowRight, CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface TemplatePickerProps {
  templates: JournalTemplate[]
  recommendedTemplateId?: string | null
}

const TYPE_COPY: Record<string, string> = {
  morning: 'Set intention',
  evening: 'Close the loop',
  weekly: 'Step back',
  free_write: 'Clear the mind',
  custom: 'Personal ritual',
}

export function TemplatePicker({ templates, recommendedTemplateId = null }: TemplatePickerProps) {
  if (templates.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed p-8 text-center">
        <p className="text-sm font-medium">No templates yet</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Create a template to start shaping your journaling ritual.
        </p>
      </div>
    )
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {templates.map((template, index) => (
        <motion.div
          key={template.id}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.05 }}
        >
          <Link
            href={`/journal/new/${template.id}`}
            className="block rounded-xl focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
                <Card
                  className={cn(
                    'border border-border/70 bg-card/85 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:bg-card',
                    recommendedTemplateId === template.id &&
                      'border-primary/80 bg-primary/[0.055] ring-2 ring-primary/20 shadow-md hover:border-primary hover:bg-primary/[0.07]'
                  )}
                >
              <CardContent className="flex items-center gap-4 p-4">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-muted text-2xl">
                {template.icon}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="truncate font-semibold">{template.name}</h3>
                  {recommendedTemplateId === template.id && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                      <CheckCircle2 className="size-3" />
                      Pick
                    </span>
                  )}
                </div>
                <p className="mt-1 text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                  {TYPE_COPY[template.entry_type] ?? TYPE_COPY.custom}
                </p>
                <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
                  {template.description ?? 'A quiet space to write what matters.'}
                </p>
              </div>
              <span className="hidden whitespace-nowrap rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground sm:inline-flex">
                +{template.xp_reward} XP
              </span>
              <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
              </CardContent>
            </Card>
          </Link>
        </motion.div>
      ))}
    </div>
  )
}

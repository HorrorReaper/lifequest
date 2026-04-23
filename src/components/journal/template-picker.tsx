// src/components/journal/template-picker.tsx

'use client'

import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Card, CardContent } from '@/components/ui/card'
import { JournalTemplate } from '@/lib/types'

interface TemplatePickerProps {
  templates: JournalTemplate[]
}

const TYPE_COLORS: Record<string, string> = {
  morning: 'from-amber-500/10 to-orange-500/10 border-amber-500/20',
  evening: 'from-indigo-500/10 to-purple-500/10 border-indigo-500/20',
  weekly: 'from-emerald-500/10 to-teal-500/10 border-emerald-500/20',
  free_write: 'from-pink-500/10 to-rose-500/10 border-pink-500/20',
  custom: 'from-sky-500/10 to-blue-500/10 border-sky-500/20',
}

export function TemplatePicker({ templates }: TemplatePickerProps) {
  const router = useRouter()

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {templates.map((template, index) => (
        <motion.div
          key={template.id}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.05 }}
        >
          <Card
            className={`cursor-pointer border transition-all hover:scale-[1.02] hover:shadow-md bg-gradient-to-br ${
              TYPE_COLORS[template.entry_type] ?? TYPE_COLORS.custom
            }`}
            onClick={() => router.push(`/journal/new/${template.id}`)}
          >
            <CardContent className="flex items-center gap-4 p-4">
              <span className="text-3xl">{template.icon}</span>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold truncate">{template.name}</h3>
                <p className="text-xs text-muted-foreground truncate">
                  {template.description}
                </p>
              </div>
              <span className="text-xs font-medium text-primary whitespace-nowrap">
                +{template.xp_reward} XP
              </span>
            </CardContent>
          </Card>
        </motion.div>
      ))}
    </div>
  )
}

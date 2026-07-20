'use client'

import { motion } from 'framer-motion'
import { Card, CardContent } from '@/components/ui/card'
import { FIELD_REGISTRY, FieldTypeDefinition } from '@/lib/field-registry'

interface AddFieldPanelProps {
  onAdd: (definition: FieldTypeDefinition) => void
}

export function AddFieldPanel({ onAdd }: AddFieldPanelProps) {
  const availableFields = FIELD_REGISTRY.filter((definition) => definition.type !== 'learning')

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
        Add a Field
      </h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {availableFields.map((def, index) => (
          <motion.div
            key={def.type}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.02 }}
          >
            <Card
              className="cursor-pointer border-border/50 transition-all hover:border-primary/30 hover:bg-muted/30 hover:scale-[1.02]"
              onClick={() => onAdd(def)}
            >
              <CardContent className="flex flex-col items-center gap-1 p-3 text-center">
                <span className="text-xl">{def.icon}</span>
                <span className="text-xs font-medium">{def.label}</span>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
    </div>
  )
}

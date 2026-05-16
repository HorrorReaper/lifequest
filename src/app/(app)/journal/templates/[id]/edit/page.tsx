import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/lib/supabase/database.types'
import { TemplateBuilder } from '@/components/template-builder/template-builder'
import { BuilderField } from '@/components/template-builder/sortable-field-item'
import { FieldType } from '@/lib/types'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function EditTemplatePage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // Fetch template
  const { data } = await supabase
    .from('journal_templates')
    .select('*')
    .eq('id', id)
    .single()
  const template = data as Database['public']['Tables']['journal_templates']['Row'] | null

  if (!template) redirect('/journal/templates')

  // Only owner can edit non-system templates
  const isSystem = template.is_system
  if (!isSystem && template.user_id !== user.id) redirect('/journal/templates')

  // Fetch fields
  const { data: fieldsData } = await supabase
    .from('template_fields')
    .select('*')
    .eq('template_id', id)
    .order('sort_order')
  const fields = fieldsData as Database['public']['Tables']['template_fields']['Row'][] | null

  const builderFields: BuilderField[] = (fields ?? []).map((f) => ({
    id: f.id,
    field_type: f.field_type as FieldType,
    label: f.label,
    description: f.description,
    placeholder: f.placeholder,
    is_required: f.is_required,
    sort_order: f.sort_order,
    config: (f.config as Record<string, unknown>) ?? {},
  }))

  return (
    <div className="min-h-svh bg-background p-4 pb-20 sm:p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold">
            {isSystem ? `Duplicate: ${template.name}` : 'Edit Template'}
          </h1>
          <p className="text-sm text-muted-foreground">
            {isSystem
              ? 'System templates can\'t be edited directly. This will create a copy.'
              : 'Modify your template fields, then save.'}
          </p>
        </div>

        <TemplateBuilder
          templateId={isSystem ? undefined : template.id}
          initialName={isSystem ? `${template.name} (Custom)` : template.name}
          initialDescription={template.description ?? ''}
          initialEntryType={template.entry_type}
          initialIcon={template.icon}
          initialXpReward={template.xp_reward}
          initialFields={builderFields}
          isSystem={isSystem}
        />
      </div>
    </div>
  )
}

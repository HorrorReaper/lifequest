import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { TemplateBuilder } from '@/components/template-builder/template-builder'

export default async function NewTemplatePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  return (
    <div className="min-h-svh bg-background p-4 pb-20 sm:p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Create Template</h1>
          <p className="text-sm text-muted-foreground">
            Design your own journal template with custom fields.
          </p>
        </div>

        <TemplateBuilder />
      </div>
    </div>
  )
}

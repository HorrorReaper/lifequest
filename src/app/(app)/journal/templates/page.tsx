// src/app/journal/templates/page.tsx

import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { TemplateList } from '@/components/template-builder/template-list'
import { JournalTemplate } from '@/lib/types'

export default async function TemplatesPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // System templates
  const { data: systemTemplates } = await supabase
    .from('journal_templates')
    .select('*')
    .eq('is_system', true)
    .eq('is_active', true)
    .order('sort_order')

  // User templates
  const { data: userTemplates } = await supabase
    .from('journal_templates')
    .select('*')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .order('sort_order')

  return (
    <div className="min-h-svh bg-background p-4 pb-20 sm:p-8">
      <div className="max-w-2xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Templates</h1>
            <p className="text-sm text-muted-foreground">
              Manage your journal templates or create new ones.
            </p>
          </div>
          <Button asChild>
            <Link href="/journal/templates/new">+ New</Link>
          </Button>
        </div>

        {/* User Templates */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            My Templates
          </h2>
          {userTemplates && userTemplates.length > 0 ? (
            <TemplateList
              templates={userTemplates as JournalTemplate[]}
              isOwner
              userId={user.id}
            />
          ) : (
            <div className="rounded-lg border border-dashed border-border/50 p-8 text-center">
              <p className="text-3xl mb-2">🎨</p>
              <p className="text-sm text-muted-foreground">
                No custom templates yet.
              </p>
              <Button asChild variant="outline" size="sm" className="mt-3">
                <Link href="/journal/templates/new">Create Your First</Link>
              </Button>
            </div>
          )}
        </section>

        {/* System Templates */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            System Templates
          </h2>
          <TemplateList
            templates={(systemTemplates as JournalTemplate[]) ?? []}
            isOwner={false}
            userId={user.id}
          />
        </section>
      </div>
    </div>
  )
}

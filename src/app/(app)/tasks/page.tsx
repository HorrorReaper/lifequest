import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft, ListTodo } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { TaskList } from '@/components/tasks/TaskList'

export default async function TasksPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  return (
    <main className="min-h-svh bg-background p-4 pb-24 sm:p-8">
      <div className="mx-auto max-w-2xl space-y-6">
        <header>
          <Link
            href="/dashboard"
            className="mb-4 inline-flex min-h-11 items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            Dashboard
          </Link>
          <div className="flex items-center gap-3">
            <span className="flex size-11 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <ListTodo className="size-5" />
            </span>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Tasks</h1>
              <p className="text-sm text-muted-foreground">Create, prioritize, complete, or reschedule your work.</p>
            </div>
          </div>
        </header>

        <TaskList userId={user.id} />
      </div>
    </main>
  )
}

'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ArrowLeft, BookOpenText, Dumbbell, FlaskConical, LayoutDashboard, NotebookPen, Salad, ShieldCheck, Users } from 'lucide-react'
import { cn } from '@/lib/utils'

const sections = [
  { href: '/admin/productivity', label: 'Productivity', icon: LayoutDashboard },
  { href: '/admin/workouts', label: 'Training', icon: Dumbbell },
  { href: '/admin/nutrition', label: 'Nutrition', icon: Salad },
  { href: '/admin/challenges', label: 'Challenges', icon: BookOpenText },
  { href: '/admin/notes', label: 'Notes', icon: NotebookPen },
  { href: '/admin/tools', label: 'Tools', icon: FlaskConical },
]

export function AdminShell({ children, trusted, userCount }: { children: React.ReactNode; trusted: boolean; userCount: number | null }) {
  const pathname = usePathname()

  return (
    <div className="min-h-dvh bg-background lg:grid lg:grid-cols-[15rem_1fr]">
      <aside className="hidden border-r bg-card/70 p-5 backdrop-blur lg:flex lg:min-h-dvh lg:flex-col">
        <Link href="/dashboard" className="mb-10 flex items-center gap-3 text-sm text-muted-foreground transition-colors hover:text-foreground">
          <ArrowLeft className="size-4" /> Back to LifeQuest
        </Link>
        <div className="mb-7 flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-2xl bg-primary text-primary-foreground"><ShieldCheck className="size-5" /></span>
          <div><p className="font-semibold">LifeQuest Labs</p><p className="text-xs text-muted-foreground">Test ideas before launch</p></div>
        </div>
        <div className="mb-6 rounded-2xl bg-muted/50 p-4 ring-1 ring-border">
          <div className="flex items-center gap-3">
            <span className="grid size-9 place-items-center rounded-xl bg-background text-primary"><Users className="size-4" /></span>
            <div>
              <p className="font-mono text-2xl font-semibold tabular-nums">{userCount ?? '-'}</p>
              <p className="text-xs text-muted-foreground">Registered users</p>
            </div>
          </div>
        </div>
        <nav className="space-y-1" aria-label="Admin workspace">
          {sections.map(({ href, label, icon: Icon }) => {
            const active = pathname.startsWith(href)
            return <Link key={href} href={href} className={cn('flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition-all', active ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-muted hover:text-foreground')}><Icon className="size-4" />{label}</Link>
          })}
        </nav>
        <p className="mt-auto text-xs leading-relaxed text-muted-foreground">Private tools. No activity here awards XP or coins.</p>
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-30 border-b bg-background/92 px-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur lg:hidden">
          <div className="mb-2 flex items-center justify-between px-1"><Link href="/dashboard" className="grid size-10 place-items-center rounded-xl bg-muted" aria-label="Back to dashboard"><ArrowLeft className="size-4" /></Link><p className="text-sm font-semibold">LifeQuest Labs</p><div className="flex items-center gap-1 rounded-full bg-muted px-3 py-1 font-mono text-sm tabular-nums"><Users className="size-3.5 text-primary" />{userCount ?? '-'}</div></div>
          <nav className="flex overflow-x-auto" aria-label="Admin workspace">
            {sections.map(({ href, label, icon: Icon }) => <Link key={href} href={href} className={cn('flex min-w-[5.5rem] flex-1 flex-col items-center gap-1 border-b-2 px-3 py-2 text-xs transition-colors', pathname.startsWith(href) ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground')}><Icon className="size-4" />{label}</Link>)}
          </nav>
        </header>
        {!trusted && <div className="border-b border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">The route allowlist granted access, but Supabase still needs <code>app_metadata.role = admin</code>. Tracker writes remain blocked until you assign the role and sign in again.</div>}
        <main id="admin-content" className="min-h-dvh p-4 pb-[max(2rem,env(safe-area-inset-bottom))] sm:p-7 xl:p-10">{children}</main>
      </div>
    </div>
  )
}

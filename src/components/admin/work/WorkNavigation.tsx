'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { CalendarDays, FolderKanban, LayoutDashboard, ListTodo } from 'lucide-react'
import { cn } from '@/lib/utils'

const sections = [
  { href: '/admin/work', label: 'Today', icon: LayoutDashboard },
  { href: '/admin/work/projects', label: 'Projects', icon: FolderKanban },
  { href: '/admin/work/tasks', label: 'Tasks', icon: ListTodo },
  { href: '/admin/work/plan', label: 'Daily Planner', icon: CalendarDays },
]

export function WorkNavigation() {
  const pathname = usePathname()
  return (
    <nav aria-label="Work" className="flex gap-1 overflow-x-auto rounded-2xl border bg-card p-1.5">
      {sections.map(({ href, label, icon: Icon }) => {
        const active = href === '/admin/work' ? pathname === href : pathname === href || pathname.startsWith(`${href}/`)
        return (
          <Link key={href} href={href} aria-current={active ? 'page' : undefined}
            className={cn('flex shrink-0 items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium transition-colors', active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground')}>
            <Icon className="size-4" />{label}
          </Link>
        )
      })}
    </nav>
  )
}

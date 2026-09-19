'use client'

import { usePathname } from 'next/navigation'
import { BottomNav } from '@/components/layout/bottom-nav'
import { ChatbotWidget } from '@/components/ai/chatbot-widget'
import { cn } from '@/lib/utils'

interface AppShellProps {
  children: React.ReactNode
  isAdmin?: boolean
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Whether a path segment is a record id rather than a page name.
 *
 * Every table in this schema keys on `uuid default gen_random_uuid()`, so a
 * segment that looks like one is a row, and anything else is a page someone
 * named.
 */
function isRecordId(segment: string | undefined) {
  return typeof segment === 'string' && UUID.test(segment)
}

/**
 * Writing or reading one journal entry, which takes the whole screen.
 *
 * Recognised by the id in the path, not by a list of the pages that are not
 * entries. That list was the bug: it named `entries` and `templates`, so
 * `insights` and `metrics` silently became immersive when they shipped and
 * lost their navigation. Now a page keeps its nav unless it is an id.
 */
function isJournalEntryRoute(pathname: string) {
  const segments = pathname.split('/').filter(Boolean)

  if (segments[0] !== 'journal') return false
  if (segments[1] === 'new' && segments.length === 3) {
    return isRecordId(segments[2])
  }

  return segments.length === 2 && isRecordId(segments[1])
}

export function isImmersiveRoute(pathname: string) {
  const segments = pathname.split('/').filter(Boolean)
  return (
    pathname.startsWith('/admin') ||
    pathname === '/plan' ||
    (segments[0] === 'learn' && segments.length === 2) ||
    (pathname.startsWith('/routines/') && pathname.endsWith('/run')) ||
    isJournalEntryRoute(pathname)
  )
}

export function AppShell({ children, isAdmin = false }: AppShellProps) {
  const pathname = usePathname()
  const immersive = isImmersiveRoute(pathname)

  return (
    <div
      className={cn(
        'min-h-svh',
        immersive ? 'pb-0' : 'pb-[calc(var(--bottom-nav-height)+var(--safe-area-bottom))]'
      )}
    >
      {children}
      {!immersive && <BottomNav isAdmin={isAdmin} />}
      {!immersive && isAdmin && <ChatbotWidget />}
    </div>
  )
}

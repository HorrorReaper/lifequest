'use client'

import { usePathname } from 'next/navigation'
import { BottomNav } from '@/components/layout/bottom-nav'
import { ChatbotWidget } from '@/components/ai/chatbot-widget'
import { cn } from '@/lib/utils'

interface AppShellProps {
  children: React.ReactNode
  isAdmin?: boolean
}

function isJournalEntryRoute(pathname: string) {
  const segments = pathname.split('/').filter(Boolean)

  if (segments[0] !== 'journal') return false
  if (segments[1] === 'new' && segments.length === 3) return true

  return (
    segments.length === 2 &&
    segments[1] !== 'entries' &&
    segments[1] !== 'templates'
  )
}

function isImmersiveRoute(pathname: string) {
  return (
    pathname.startsWith('/admin') ||
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

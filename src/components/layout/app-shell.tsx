'use client'

import { usePathname } from 'next/navigation'
import { BottomNav } from '@/components/layout/bottom-nav'
import { ChatbotWidget } from '@/components/ai/chatbot-widget'
import { cn } from '@/lib/utils'

interface AppShellProps {
  children: React.ReactNode
}

function isImmersiveRoute(pathname: string) {
  return pathname.startsWith('/routines/') && pathname.endsWith('/run')
}

export function AppShell({ children }: AppShellProps) {
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
      {!immersive && <BottomNav />}
      {!immersive && <ChatbotWidget />}
    </div>
  )
}

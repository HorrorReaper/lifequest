'use client'

import { useEffect, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Building2Icon } from 'lucide-react'

// The (app) layout awaits supabase.auth.getUser() before it can render
// anything, and Next's loading.tsx cannot cover that: a segment's own
// loading.tsx wraps its page and nested layouts, never that segment's own
// layout. So the gap between "credentials accepted" and the dashboard
// actually painting has no framework-level fallback — this overlay is it.
// It must stay mounted for that whole gap, so callers should not reset
// their `loading` state before navigating; let the route swap unmount this.

const TIPS = [
  'Journaling daily is what keeps your streak alive.',
  'Every completed task and habit earns XP toward your next building.',
  'Your Today Plan turns a scattered day into three clear outcomes.',
  'Quests turn small wins into visible rewards.',
  'Habits are simple by design: one action, done or not, every day.',
  'The city grows exactly as fast as you do.',
  'Insights you mark in your journal become your personal learning library.',
]

const TIP_INTERVAL_MS = 2800

export function AuthLoadingOverlay({ label }: { label: string }) {
  const reduceMotion = useReducedMotion()
  const [tipIndex, setTipIndex] = useState(0)

  useEffect(() => {
    const id = window.setInterval(() => {
      setTipIndex((index) => (index + 1) % TIPS.length)
    }, TIP_INTERVAL_MS)
    return () => window.clearInterval(id)
  }, [])

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950 text-white">
      <div className="pointer-events-none absolute -left-[15vw] -top-[28vw] size-[72vw] rounded-full bg-amber-300/10 blur-[90px]" />
      <div className="pointer-events-none absolute -right-[10vw] bottom-[-20vw] size-[60vw] rounded-full bg-sky-400/10 blur-[90px]" />

      <div className="relative flex w-full max-w-xs flex-col items-center gap-6 px-6 text-center">
        <motion.div
          className="flex size-16 items-center justify-center rounded-2xl border border-white/15 bg-white/10 text-amber-200 backdrop-blur"
          animate={reduceMotion ? undefined : { y: [0, -6, 0], rotate: [0, 1.5, 0] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
        >
          <Building2Icon className="size-8" />
        </motion.div>

        <div role="status" aria-live="polite" className="space-y-3">
          <p className="text-sm font-medium text-white/90">{label}</p>

          <AnimatePresence mode="wait">
            <motion.p
              key={tipIndex}
              initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -6 }}
              transition={{ duration: 0.3 }}
              className="text-xs leading-relaxed text-white/55"
            >
              {TIPS[tipIndex]}
            </motion.p>
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}

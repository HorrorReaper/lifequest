'use client'

import { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useUserStore } from '@/lib/stores/user-store'
import { CITY_TIER_LABELS } from '@/lib/gamification'
import { useTheme } from '@/components/providers/theme-provider'
import { cn } from '@/lib/utils'

export function LevelUpOverlay() {
  const pendingLevelUp = useUserStore((s) => s.pendingLevelUp)
  const cityTier = useUserStore((s) => s.cityTier)
  const clearLevelUp = useUserStore((s) => s.clearLevelUp)
  const { theme } = useTheme()
  const isWhiteMode = theme === 'white'

  useEffect(() => {
    if (!pendingLevelUp) return
    const t = setTimeout(clearLevelUp, 4000)
    return () => clearTimeout(t)
  }, [pendingLevelUp, clearLevelUp])

  return (
    <AnimatePresence>
      {pendingLevelUp !== null && (
        <motion.div
          key="level-up-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className={cn(
            "fixed inset-0 z-[9999] flex cursor-pointer items-center justify-center backdrop-blur-sm",
            isWhiteMode ? "bg-stone-100/75" : "bg-black/60"
          )}
          onClick={clearLevelUp}
        >
          {/* Radial glow */}
          {!isWhiteMode && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 2.5, opacity: 0.15 }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
                className="size-96 rounded-full bg-primary"
              />
            </div>
          )}

          {/* Particles */}
          {!isWhiteMode && <Particles />}

          {/* Card */}
          <motion.div
            initial={{ scale: 0.6, opacity: 0, y: 24 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.8, opacity: 0, y: -16 }}
            transition={{ type: 'spring', stiffness: 320, damping: 22, delay: 0.05 }}
            className={cn(
              "relative flex flex-col items-center gap-4 rounded-2xl border px-12 py-10 text-center",
              isWhiteMode
                ? "border-stone-200 bg-white/95 shadow-[0_24px_80px_rgba(68,64,60,0.12)]"
                : "border-primary/30 bg-background/95 shadow-2xl"
            )}
            onClick={(e) => e.stopPropagation()}
          >
            <motion.p
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-xs font-semibold uppercase tracking-[0.2em] text-primary"
            >
              Level Up!
            </motion.p>

            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 260, damping: 18, delay: 0.25 }}
              className={cn(
                "relative flex size-28 items-center justify-center rounded-full border bg-primary/10",
                isWhiteMode ? "border-2 border-primary/30" : "border-4 border-primary"
              )}
            >
              <motion.span
                initial={{ scale: 1.4 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 300, damping: 20, delay: 0.3 }}
                className="text-5xl font-black text-primary tabular-nums"
              >
                {pendingLevelUp}
              </motion.span>

              {/* Ring pulse */}
              <motion.div
                className={cn(
                  "absolute inset-0 rounded-full border-primary",
                  isWhiteMode ? "border-2" : "border-4"
                )}
                initial={{ scale: 1, opacity: 0.8 }}
                animate={{ scale: isWhiteMode ? 1.18 : 1.6, opacity: 0 }}
                transition={
                  isWhiteMode
                    ? { duration: 1.2, ease: 'easeOut', delay: 0.3 }
                    : { duration: 1, ease: 'easeOut', delay: 0.3, repeat: Infinity, repeatDelay: 0.8 }
                }
              />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="space-y-1"
            >
              <p className="text-lg font-bold">
                {CITY_TIER_LABELS[cityTier]}
              </p>
              <p className="text-sm text-muted-foreground">Your city is growing!</p>
            </motion.div>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.2 }}
              className="text-[11px] text-muted-foreground/60"
            >
              Tap anywhere to continue
            </motion.p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function Particles() {
  const count = 16
  return (
    <>
      {Array.from({ length: count }).map((_, i) => {
        const angle = (i / count) * 360
        const distance = 140 + seededUnit(i + 1) * 80
        const size = 4 + seededUnit(i + 17) * 6
        const delay = 0.1 + seededUnit(i + 33) * 0.3
        const rad = (angle * Math.PI) / 180
        const tx = Math.cos(rad) * distance
        const ty = Math.sin(rad) * distance

        return (
          <motion.div
            key={i}
            className="absolute rounded-full bg-primary pointer-events-none"
            style={{ width: size, height: size }}
            initial={{ opacity: 1, x: 0, y: 0, scale: 1 }}
            animate={{ opacity: 0, x: tx, y: ty, scale: 0 }}
            transition={{ duration: 0.9, ease: 'easeOut', delay }}
          />
        )
      })}
    </>
  )
}

function seededUnit(seed: number) {
  const x = Math.sin(seed * 999) * 10000
  return x - Math.floor(x)
}

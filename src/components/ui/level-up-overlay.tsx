'use client'

import { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useUserStore } from '@/lib/stores/user-store'
import { CITY_TIER_LABELS } from '@/lib/gamification'

export function LevelUpOverlay() {
  const pendingLevelUp = useUserStore((s) => s.pendingLevelUp)
  const cityTier = useUserStore((s) => s.cityTier)
  const clearLevelUp = useUserStore((s) => s.clearLevelUp)

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
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm cursor-pointer"
          onClick={clearLevelUp}
        >
          {/* Radial glow */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 2.5, opacity: 0.15 }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
              className="size-96 rounded-full bg-primary"
            />
          </div>

          {/* Particles */}
          <Particles />

          {/* Card */}
          <motion.div
            initial={{ scale: 0.6, opacity: 0, y: 24 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.8, opacity: 0, y: -16 }}
            transition={{ type: 'spring', stiffness: 320, damping: 22, delay: 0.05 }}
            className="relative flex flex-col items-center gap-4 rounded-2xl border border-primary/30 bg-background/95 px-12 py-10 shadow-2xl text-center"
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
              className="relative flex size-28 items-center justify-center rounded-full border-4 border-primary bg-primary/10"
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
                className="absolute inset-0 rounded-full border-4 border-primary"
                initial={{ scale: 1, opacity: 0.8 }}
                animate={{ scale: 1.6, opacity: 0 }}
                transition={{ duration: 1, ease: 'easeOut', delay: 0.3, repeat: Infinity, repeatDelay: 0.8 }}
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
        const distance = 140 + Math.random() * 80
        const size = 4 + Math.random() * 6
        const delay = 0.1 + Math.random() * 0.3
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

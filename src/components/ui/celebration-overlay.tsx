'use client'

import { useEffect, type ReactNode } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { useTheme } from '@/components/providers/theme-provider'
import { cn } from '@/lib/utils'

// Full class names, so Tailwind finds them. `streak` matches the flame in the
// top bar.
const TONES = {
  primary: {
    text: 'text-primary',
    fill: 'bg-primary',
    tint: 'bg-primary/10',
    border: 'border-primary',
    softBorder: 'border-primary/30',
  },
  streak: {
    text: 'text-orange-600 dark:text-orange-400',
    fill: 'bg-orange-500',
    tint: 'bg-orange-500/10',
    border: 'border-orange-500',
    softBorder: 'border-orange-500/30',
  },
} as const

export type CelebrationTone = keyof typeof TONES

interface CelebrationOverlayProps {
  open: boolean
  onClose: () => void
  /** Small caps line above the ring, e.g. "Level Up!". */
  eyebrow: string
  /** What sits inside the ring: a level, a day number. */
  badge: ReactNode
  title: ReactNode
  subtitle?: ReactNode
  /** Closes on its own after this long; a tap anywhere closes it sooner. */
  autoCloseMs?: number
  /** Colour of the ring, glow, burst and eyebrow. */
  tone?: CelebrationTone
}

/**
 * The full-screen "you did it" moment: dimmed backdrop, a glow, a burst of
 * particles, and a card with a pulsing ring. Shared by the level-up and the
 * challenge-day celebrations so the two always feel like the same reward.
 *
 * With reduced motion the burst and the looping pulse are left out; the card
 * still fades in.
 */
export function CelebrationOverlay({
  open,
  onClose,
  eyebrow,
  badge,
  title,
  subtitle,
  autoCloseMs = 4000,
  tone = 'primary',
}: CelebrationOverlayProps) {
  const colors = TONES[tone]
  const { theme } = useTheme()
  const reduceMotion = useReducedMotion()
  const isWhiteMode = theme === 'white'
  const lively = !isWhiteMode && !reduceMotion

  useEffect(() => {
    if (!open) return
    const timer = setTimeout(onClose, autoCloseMs)
    return () => clearTimeout(timer)
  }, [open, onClose, autoCloseMs])

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="celebration-overlay"
          role="dialog"
          aria-modal="true"
          aria-label={eyebrow}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className={cn(
            'fixed inset-0 z-[9999] flex cursor-pointer items-center justify-center backdrop-blur-sm',
            isWhiteMode ? 'bg-stone-100/75' : 'bg-black/60'
          )}
          onClick={onClose}
        >
          {/* Radial glow */}
          {lively && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 2.5, opacity: 0.15 }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
                className={cn('size-96 rounded-full', colors.fill)}
              />
            </div>
          )}

          {lively && <Particles className={colors.fill} />}

          {/* Card */}
          <motion.div
            initial={{ scale: 0.6, opacity: 0, y: 24 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.8, opacity: 0, y: -16 }}
            transition={{ type: 'spring', stiffness: 320, damping: 22, delay: 0.05 }}
            className={cn(
              'relative mx-4 flex max-w-sm flex-col items-center gap-4 rounded-2xl border px-12 py-10 text-center',
              isWhiteMode
                ? 'border-stone-200 bg-white/95 shadow-[0_24px_80px_rgba(68,64,60,0.12)]'
                : cn(colors.softBorder, 'bg-background/95 shadow-2xl')
            )}
            onClick={(e) => e.stopPropagation()}
          >
            <motion.p
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className={cn('text-xs font-semibold uppercase tracking-[0.2em]', colors.text)}
            >
              {eyebrow}
            </motion.p>

            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 260, damping: 18, delay: 0.25 }}
              className={cn(
                'relative flex size-28 items-center justify-center rounded-full border',
                colors.tint,
                isWhiteMode ? cn('border-2', colors.softBorder) : cn('border-4', colors.border)
              )}
            >
              <motion.span
                initial={{ scale: 1.4 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 300, damping: 20, delay: 0.3 }}
                className={cn('flex items-center justify-center text-5xl font-black tabular-nums', colors.text)}
              >
                {badge}
              </motion.span>

              {/* Ring pulse */}
              {!reduceMotion && (
                <motion.div
                  className={cn('absolute inset-0 rounded-full', colors.border, isWhiteMode ? 'border-2' : 'border-4')}
                  initial={{ scale: 1, opacity: 0.8 }}
                  animate={{ scale: isWhiteMode ? 1.18 : 1.6, opacity: 0 }}
                  transition={
                    isWhiteMode
                      ? { duration: 1.2, ease: 'easeOut', delay: 0.3 }
                      : { duration: 1, ease: 'easeOut', delay: 0.3, repeat: Infinity, repeatDelay: 0.8 }
                  }
                />
              )}
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="space-y-1"
            >
              <p className="text-lg font-bold">{title}</p>
              {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
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

function Particles({ className }: { className: string }) {
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
            className={cn('pointer-events-none absolute rounded-full', className)}
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

/** Deterministic pseudo-random in [0, 1), so server and client draw the same burst. */
function seededUnit(seed: number) {
  const x = Math.sin(seed * 999) * 10000
  return x - Math.floor(x)
}

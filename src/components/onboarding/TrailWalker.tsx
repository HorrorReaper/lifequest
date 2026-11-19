import { cn } from '@/lib/utils'

interface TrailWalkerProps {
  className?: string
}

/**
 * The smiling traveller who walks through onboarding: a small hiker with a
 * hat and a day pack, arms and legs swinging (`.trail-walker` in
 * globals.css; still under reduced motion). Drawn 40 x 64 and scaled by the
 * caller's height. The shirt takes the text colour, so `text-primary`
 * dresses it in the theme's accent.
 *
 * Decorative: hidden from assistive technology, like the scene around it.
 * Deliberately simpler than the dashboard's `AvatarFigure`, which carries
 * the gear a user has bought; a new account has none yet.
 */
export function TrailWalker({ className }: TrailWalkerProps) {
  return (
    <svg
      viewBox="0 0 40 64"
      aria-hidden="true"
      data-slot="trail-walker"
      className={cn('trail-walker block overflow-visible', className)}
    >
      <rect data-limb="b" x="17" y="40" width="6" height="20" rx="3" fill="#2F3A35" />
      <rect data-limb="a" x="19" y="23" width="5" height="15" rx="2.5" fill="#3B5550" />
      <rect x="7" y="22" width="9" height="17" rx="3" fill="#8A6A44" />
      <rect x="13" y="20" width="14" height="23" rx="6" fill="currentColor" />
      <rect data-limb="a" x="17" y="40" width="6" height="20" rx="3" fill="#3D4A44" />
      <rect data-limb="b" x="17" y="23" width="5" height="15" rx="2.5" fill="#F1C9A5" />
      <circle cx="20" cy="12" r="7.5" fill="#F1C9A5" />
      <circle cx="15.6" cy="14.6" r="1.3" fill="#F2A99A" opacity="0.7" />
      <circle cx="24.4" cy="14.6" r="1.3" fill="#F2A99A" opacity="0.7" />
      <g fill="none" stroke="#2D2924" strokeWidth="1.1" strokeLinecap="round">
        <path d="M16.4 12.6 Q17.5 11.4 18.6 12.6" />
        <path d="M21.4 12.6 Q22.5 11.4 23.6 12.6" />
        <path d="M17.2 15.2 Q20 18.2 22.8 15.2" />
      </g>
      <path d="M11 10 Q20 0 29 10 L26 9 Q20 5 14 9 Z" fill="#5A4632" />
      <rect x="9" y="8" width="22" height="3" rx="1.5" fill="#7A5B3A" />
    </svg>
  )
}

'use client'

import { useTheme } from '@/components/providers/theme-provider'

/**
 * The dashed trail running the full height of the page, not just the hero's
 * illustration.
 *
 * Fixed rather than absolute so it stays visible the whole way down instead
 * of ending where the content happens to end. It sits in the page's own
 * gutter, left of the centred content column, so it never runs underneath a
 * card. Rendered only under the Trail theme -- the other three themes have no
 * illustration for it to belong to.
 */
export function TrailPageSpine() {
  const { theme } = useTheme()
  if (theme !== 'trail') return null

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-y-0 left-2 z-0 border-l border-dashed border-foreground/20 sm:left-5"
    />
  )
}

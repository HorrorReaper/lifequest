'use client'

import type { ComponentProps, MouseEvent, ReactNode } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * What a click inside a section must be left alone for: the controls the
 * section offers itself (check-offs, "Add …", "Show more", claim buttons).
 * `data-section-ignore` opts any other element out.
 */
const INTERACTIVE =
  'a, button, input, textarea, select, label, summary, [role="button"], [role="checkbox"], [role="dialog"], [contenteditable="true"], [data-section-ignore]'

/**
 * A dashboard section that opens its full page when clicked anywhere that is
 * not one of its own controls -- in place of a separate "Manage …" or
 * "Open …" link at the bottom.
 *
 * Mouse and touch only: for the keyboard and screen readers the section's
 * heading is the link (`SectionHeadingLink`), so the page stays reachable
 * without a second visible button.
 */
export function ClickableSection({
  href,
  className,
  onClick,
  children,
  ...props
}: ComponentProps<'section'> & { href: string }) {
  const router = useRouter()

  function handleClick(event: MouseEvent<HTMLElement>) {
    onClick?.(event)
    if (event.defaultPrevented || event.button !== 0) return
    const target = event.target
    if (!(target instanceof Element)) return
    // React bubbles events out of portals along the component tree, so a
    // click inside a dialog this section opened arrives here too. Only
    // clicks on the section's own DOM count.
    if (!event.currentTarget.contains(target)) return
    if (target.closest(INTERACTIVE)) return
    // Selecting text to copy it is not a request to leave the page.
    if (window.getSelection()?.toString()) return

    if (event.metaKey || event.ctrlKey) window.open(href, '_blank', 'noopener')
    else router.push(href)
  }

  return (
    <section
      {...props}
      onClick={handleClick}
      className={cn('cursor-pointer transition-colors hover:border-foreground/25', className)}
    >
      {children}
    </section>
  )
}

/** A section's heading as the link to its page, for the keyboard and screen readers. */
export function SectionHeadingLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="group/heading inline-flex items-center gap-0.5 rounded-md focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      {children}
      <ChevronRight
        className="size-4 text-muted-foreground transition-transform group-hover/heading:translate-x-0.5"
        aria-hidden="true"
      />
    </Link>
  )
}

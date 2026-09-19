'use client'

import { useSyncExternalStore } from 'react'

function subscribeToDismissal(onChange: () => void) {
  window.addEventListener('storage', onChange)
  return () => window.removeEventListener('storage', onChange)
}

// Server and the pre-hydration client paint agree the prompt is dismissed so
// it never flashes open before hydration; see auth-loading-overlay.tsx for
// the same reasoning applied to a different widget.
function readDismissedOnServer() {
  return true
}

/**
 * "Not now" for a dashboard prompt, remembered in localStorage under `key`.
 *
 * The key carries its own expiry -- a date for the daily prompts, a week
 * start for the weekly ones -- so a new period means a new key and nothing
 * has to be cleaned up. Shared by every prompt on the dashboard so the
 * hydration-safe reading lives in one place.
 */
export function usePromptDismissal(key: string) {
  const dismissed = useSyncExternalStore(
    subscribeToDismissal,
    () => window.localStorage.getItem(key) === '1',
    readDismissedOnServer
  )

  function dismiss() {
    window.localStorage.setItem(key, '1')
    // localStorage's native "storage" event only fires in other tabs; dispatch
    // one manually so this tab's useSyncExternalStore re-reads immediately.
    window.dispatchEvent(new Event('storage'))
  }

  return { dismissed, dismiss }
}

/**
 * A key nothing ever writes, so `usePromptDismissal` on it always reads
 * "not dismissed". Lets a prompt with nothing to yield to call
 * `usePromptHeldBack(null)` without a conditional hook.
 */
const NEVER_DISMISSED_KEY = 'lifequest-prompt-never-dismissed'

/**
 * Whether a prompt must stay closed because another prompt, identified by
 * its dismissal key, has precedence on this page and has not been answered
 * yet.
 *
 * On Sunday evening the weekly review would otherwise open on top of the
 * evening review, and on Monday the weekly plan on top of the daily one.
 * The weekly prompt wins; the daily one waits until the weekly key is
 * written -- by "Not now" or by starting the ritual -- or the server passes
 * null because the weekly entry already exists.
 */
export function usePromptHeldBack(heldBackBy: string | null | undefined): boolean {
  const { dismissed } = usePromptDismissal(heldBackBy ?? NEVER_DISMISSED_KEY)
  return heldBackBy != null && !dismissed
}

/**
 * What a ritual prompt says, as an admin wrote it at /admin/rituals with
 * `{name}` already filled in by the page. The prompts print these as-is.
 */
export interface PromptCopy {
  title: string
  description: string
  ctaLabel: string
}

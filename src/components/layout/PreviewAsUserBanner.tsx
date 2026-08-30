'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

/**
 * The only way back out of preview mode.
 *
 * Preview hides every admin entry point, /admin included, so the exit has to
 * live somewhere that is always on screen rather than inside the workspace it
 * hides. It renders above the app rather than inside a page so it survives
 * whichever route the admin wanders onto.
 */
export function PreviewAsUserBanner() {
  const router = useRouter()
  const [leaving, setLeaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleExit() {
    setLeaving(true)
    setError(null)
    try {
      const response = await fetch('/api/admin/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: false }),
      })
      if (!response.ok) throw new Error('Could not leave preview mode.')
      router.push('/admin/tools')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not leave preview mode.')
      setLeaving(false)
    }
  }

  return (
    <div className="sticky top-0 z-[60] border-b border-amber-500/30 bg-amber-500/10 backdrop-blur">
      <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-2">
        <Eye className="size-4 shrink-0 text-amber-700 dark:text-amber-400" />
        <p className="min-w-0 flex-1 text-xs leading-relaxed text-amber-900 dark:text-amber-200">
          <span className="font-semibold">Viewing as a normal user.</span>{' '}
          <span className="hidden sm:inline">
            Admin features are hidden. Your own data is untouched.
          </span>
          {error && <span className="block text-destructive">{error}</span>}
        </p>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8 shrink-0"
          onClick={handleExit}
          disabled={leaving}
        >
          {leaving && <Loader2 className="size-3.5 animate-spin" />}
          {leaving ? 'Leaving...' : 'Exit preview'}
        </Button>
      </div>
    </div>
  )
}

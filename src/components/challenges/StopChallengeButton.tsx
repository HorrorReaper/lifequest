'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Square } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { abandonChallengeProgram } from '@/lib/challenge-programs'

export function StopChallengeButton({ enrollmentId, title }: { enrollmentId: string; title: string }) {
  const router = useRouter()
  const [stopping, setStopping] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function stop() {
    if (!window.confirm(`Stop “${title}”? Your progress so far stays, and you can start again any time.`)) return
    setStopping(true)
    setError(null)
    try {
      await abandonChallengeProgram(createClient(), enrollmentId)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not stop this challenge.')
    } finally {
      setStopping(false)
    }
  }

  return (
    <div>
      <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={stop} disabled={stopping}>
        {stopping ? <Loader2 className="animate-spin" /> : <Square />}
        Stop challenge
      </Button>
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  )
}

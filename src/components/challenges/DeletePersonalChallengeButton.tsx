'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { deletePersonalChallenge } from '@/lib/challenge-programs'

export function DeletePersonalChallengeButton({ templateId, title }: { templateId: string; title: string }) {
  const router = useRouter()
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function remove() {
    if (!window.confirm(`Delete “${title}” and its progress? XP you already earned stays.`)) return
    setDeleting(true)
    setError(null)
    try {
      await deletePersonalChallenge(createClient(), templateId)
      router.push('/challenges')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete this challenge.')
      setDeleting(false)
    }
  }

  return (
    <div>
      <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={remove} disabled={deleting}>
        {deleting ? <Loader2 className="animate-spin" /> : <Trash2 />}
        Delete challenge
      </Button>
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  )
}

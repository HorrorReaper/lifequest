'use client'

import { Button } from '@/components/ui/button'

export default function WorkError({ reset }: { reset: () => void }) {
  return (
    <div role="alert" className="space-y-4 rounded-3xl border bg-card p-8">
      <h2 className="text-xl font-semibold">Your work could not be loaded</h2>
      <p className="text-sm text-muted-foreground">Check your connection and try again.</p>
      <Button onClick={reset}>Try again</Button>
    </div>
  )
}

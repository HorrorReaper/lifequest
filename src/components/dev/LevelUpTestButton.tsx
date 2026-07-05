'use client'

import { useUserStore } from '@/lib/stores/user-store'
import { Button } from '@/components/ui/button'

export function LevelUpTestButton() {
  const addXp = useUserStore((s) => s.addXp)
  return (
    <Button variant="outline" size="sm" onClick={() => addXp(10000)}>
      Test Level Up
    </Button>
  )
}

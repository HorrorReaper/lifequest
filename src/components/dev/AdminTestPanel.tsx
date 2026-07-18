import Link from 'next/link'
import { LevelUpTestButton } from '@/components/dev/LevelUpTestButton'
import { Button } from '@/components/ui/button'

export function AdminTestPanel() {
  return (
    <section className="rounded-2xl border border-dashed border-primary/35 bg-primary/5 p-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-primary">Admin testing</p>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Visible only to allowlisted admin accounts.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <LevelUpTestButton />
          <Button asChild variant="outline" size="sm">
            <Link href="/admin">Open admin</Link>
          </Button>
        </div>
      </div>
    </section>
  )
}

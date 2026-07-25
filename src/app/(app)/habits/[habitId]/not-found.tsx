import Link from 'next/link'
import { ArrowLeft, SearchX } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function HabitAnalyticsNotFound() {
  return (
    <main className="grid min-h-svh place-items-center bg-background p-4 pb-24">
      <div className="w-full max-w-md rounded-2xl border bg-card p-6 text-center">
        <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-muted text-muted-foreground">
          <SearchX className="size-5" />
        </span>
        <h1 className="mt-4 font-heading text-xl font-semibold">
          Habit not found
        </h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          This habit may have been removed or it does not belong to your account.
        </p>
        <Button asChild className="mt-5">
          <Link href="/habits">
            <ArrowLeft className="size-3.5" />
            Back to habits
          </Link>
        </Button>
      </div>
    </main>
  )
}

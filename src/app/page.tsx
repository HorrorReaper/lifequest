// src/app/page.tsx

import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function LandingPage() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-background px-4 text-center">
      <div className="max-w-2xl space-y-8">
        <h1 className="text-5xl font-bold tracking-tight sm:text-6xl">
          🏰 LifeQuest
        </h1>
        <p className="text-xl text-muted-foreground">
          Duolingo meets journaling. Write daily, earn XP, maintain streaks,
          and build your virtual city — one entry at a time.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button asChild size="lg">
            <Link href="/login">Get Started — It&apos;s Free</Link>
          </Button>
        </div>

        {/* Feature pills */}
        <div className="flex flex-wrap justify-center gap-3 pt-4">
          {[
            '📝 Guided Templates',
            '⚡ Earn XP',
            '🔥 Streaks',
            '🏙️ Build a City',
            '📊 Mood Insights',
          ].map((feature) => (
            <span
              key={feature}
              className="rounded-full bg-muted px-4 py-1.5 text-sm font-medium"
            >
              {feature}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

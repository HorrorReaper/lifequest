import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { cache } from 'react'
import { CalendarCheck2, Coins, Sparkles, Zap } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { fetchPublicChallenge } from '@/lib/challenge-programs'
import { challengeJoinPath } from '@/lib/challenge-intent'
import { isValidChallengeSlug } from '@/lib/challenge-rules'
import { nightfallBody, nightfallDisplay } from '@/lib/marketing-fonts'

// Public landing page for a published challenge that has a slug. The only
// challenge data it can read is what get_public_challenge returns: title,
// copy, rewards and the day titles. Instructions stay behind the login.

interface ChallengeLandingProps {
  params: Promise<{ slug: string }>
}

const loadChallenge = cache(async (rawSlug: string) => {
  const slug = rawSlug.trim().toLowerCase()
  if (!isValidChallengeSlug(slug)) return null
  const supabase = await createClient()
  return fetchPublicChallenge(supabase, slug)
})

export async function generateMetadata({ params }: ChallengeLandingProps): Promise<Metadata> {
  const { slug } = await params
  const challenge = await loadChallenge(slug)
  if (!challenge) return { title: 'Challenge | LifeQuest' }
  return {
    title: `${challenge.title} | LifeQuest`,
    description: challenge.tagline ?? challenge.description ?? `A ${challenge.duration_days}-day challenge on LifeQuest.`,
  }
}

const ctaClass =
  'inline-flex items-center justify-center gap-2 rounded-xl bg-[#d1870b] px-6 py-3.5 text-base font-bold text-[#1b1a17] transition-colors hover:bg-[#c07b08]'

export default async function ChallengeLandingPage({ params }: ChallengeLandingProps) {
  const { slug } = await params
  const challenge = await loadChallenge(slug)
  if (!challenge) notFound()

  // A plain <a>, not <Link>: the join route starts the challenge on GET and
  // must never be prefetched.
  const joinHref = challengeJoinPath(challenge.slug)
  const autoPace = challenge.schedule_mode !== 'strict'
  const automaticDays = challenge.days.filter((day) => day.automatic).length

  return (
    <div
      className={`${nightfallDisplay.variable} ${nightfallBody.variable} min-h-svh bg-[#fdfcf9] text-[#1b1a17] [font-family:var(--font-nightfall-body)]`}
    >
      <header className="border-b border-[#f3efe6] px-5">
        <div className="mx-auto flex h-16 max-w-[880px] items-center justify-between gap-4">
          <Link href="/" className="[font-family:var(--font-nightfall-display)] text-[1.35rem] font-extrabold tracking-tight">
            Life<span className="text-[#d1870b]">Quest</span>
          </Link>
          <a href={joinHref} className="text-[0.92rem] font-semibold text-[#6f6b63] hover:text-[#1b1a17]">
            Start the challenge
          </a>
        </div>
      </header>

      <main className="px-5">
        <section className="mx-auto flex max-w-[880px] flex-col items-center gap-5 py-14 text-center sm:py-20">
          <span className="rounded-full bg-[#fdf4e2] px-3 py-1 text-sm font-semibold text-[#a86a06]">
            {challenge.duration_days}-day challenge · free
          </span>
          <h1 className="max-w-[18ch] text-balance [font-family:var(--font-nightfall-display)] text-[clamp(2.4rem,6vw,3.8rem)] font-extrabold leading-[1.05]">
            {challenge.title}
          </h1>
          {challenge.tagline && (
            <p className="max-w-[44ch] text-[clamp(1.05rem,2.2vw,1.25rem)] leading-relaxed text-[#6f6b63]">{challenge.tagline}</p>
          )}
          <a href={joinHref} className={ctaClass}>
            Start now, it&apos;s free
          </a>
          <p className="text-sm text-[#8a857b]">One small action a day. {autoPace ? 'Go at your own pace.' : 'Every day counts.'}</p>
        </section>

        {challenge.description && (
          <section className="mx-auto max-w-[680px] pb-12">
            <p className="whitespace-pre-line text-lg leading-relaxed text-[#3d3a34]">{challenge.description}</p>
          </section>
        )}

        <section className="mx-auto grid max-w-[880px] gap-4 pb-14 sm:grid-cols-3">
          <Feature icon={<CalendarCheck2 className="size-5" />} title="One step a day">
            Each day unlocks a single concrete action. No overwhelm, just the next step.
          </Feature>
          <Feature icon={<Sparkles className="size-5" />} title="Tracked for you">
            {automaticDays > 0
              ? `${automaticDays} of ${challenge.duration_days} days tick themselves off when you do the action in LifeQuest.`
              : 'Your progress and notes live in LifeQuest, next to your habits, plans and journal.'}
          </Feature>
          <Feature icon={<Zap className="size-5" />} title="Earn rewards">
            Finish all {challenge.duration_days} days for {challenge.xp_reward} XP and {challenge.coin_reward} coins.
          </Feature>
        </section>

        {challenge.days.length > 0 && (
          <section className="mx-auto max-w-[680px] pb-16">
            <h2 className="text-center [font-family:var(--font-nightfall-display)] text-[clamp(1.8rem,4vw,2.4rem)] font-extrabold">
              Your {challenge.duration_days} days
            </h2>
            <ol className="mt-8 space-y-2">
              {challenge.days.map((day) => (
                <li key={day.day_number} className="flex items-center gap-4 rounded-xl border border-[#eae5da] bg-white px-4 py-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-[#fdf4e2] font-mono text-sm font-bold text-[#a86a06]">
                    {day.day_number}
                  </span>
                  <span className="flex-1 font-semibold">{day.title}</span>
                  {day.automatic && <Sparkles className="size-4 shrink-0 text-[#d1870b]" aria-label="Tracked automatically" />}
                </li>
              ))}
            </ol>
          </section>
        )}

        <section className="mx-auto flex max-w-[680px] flex-col items-center gap-4 border-t border-[#eae5da] py-16 text-center">
          <h2 className="[font-family:var(--font-nightfall-display)] text-[clamp(1.8rem,4vw,2.4rem)] font-extrabold">
            Day 1 starts today.
          </h2>
          <p className="max-w-[40ch] text-[#6f6b63]">Create a free account and the challenge is waiting on your dashboard.</p>
          <a href={joinHref} className={ctaClass}>
            Start {challenge.title}
          </a>
          <p className="flex items-center gap-3 text-sm text-[#8a857b]">
            <span className="flex items-center gap-1">
              <Zap className="size-4" /> {challenge.xp_reward} XP
            </span>
            <span className="flex items-center gap-1">
              <Coins className="size-4" /> {challenge.coin_reward} coins
            </span>
          </p>
        </section>
      </main>

      <footer className="border-t border-[#f3efe6] px-5 py-8 text-center text-sm text-[#8a857b]">
        <Link href="/" className="hover:text-[#1b1a17]">LifeQuest</Link>
        {' · '}
        <Link href="/privacy" className="hover:text-[#1b1a17]">Privacy</Link>
        {' · '}
        <Link href="/terms" className="hover:text-[#1b1a17]">Terms</Link>
      </footer>
    </div>
  )
}

function Feature({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-[#eae5da] bg-white p-5">
      <span className="grid size-10 place-items-center rounded-xl bg-[#fdf4e2] text-[#a86a06]">{icon}</span>
      <h3 className="mt-4 font-bold">{title}</h3>
      <p className="mt-1 text-sm leading-relaxed text-[#6f6b63]">{children}</p>
    </div>
  )
}

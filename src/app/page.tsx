"use client";

import { useState } from "react";
import Link from "next/link";
import WaitlistModal from "@/components/waitlist/WaitlistModal";
import Roadmap from "@/components/marketing/Roadmap";
import Navbar from "@/components/layout/Navbar";
import {
  DashboardPanel,
  ReflectionPanel,
  StreakPanel,
  TemplatesPanel,
} from "@/components/marketing/ProductPanels";
import { nightfallBody, nightfallDisplay } from "@/lib/marketing-fonts";

// Colours are literal rather than themed: this page sits outside (app) and
// must look the same whatever theme a returning user last picked in Settings.

const STEPS = [
  {
    title: "Write",
    body: "Pick a template and answer a few fields. Morning, evening, weekly — or one you built yourself.",
  },
  {
    title: "Earn",
    body: "Entries pay XP. Habits and quests pay XP and coins. Your streak grows with every day you show up.",
  },
  {
    title: "Level up",
    body: "Spend coins on gear for your character, and watch the level bar fill as the days add up.",
  },
];

const EVERYTHING = [
  { title: "Tasks", body: "Capture them in an entry, find them on your dashboard." },
  { title: "Day planner", body: "Time-block tomorrow while you write tonight's review." },
  { title: "Insights", body: "Mark any answer as a learning and keep it somewhere you can find it." },
  { title: "Metrics", body: "Any number you track becomes a chart, with a target if you want one." },
  { title: "Quests", body: "Daily challenges and your own, claimed when you're ready." },
  { title: "Your character", body: "Twelve pieces of gear, bought with coins you earned." },
];

/**
 * The page's one call to action, in both of the states the build can be in:
 * a link to sign-up once the app is live, the waitlist dialog before that.
 * Defined at module scope so it is one component rather than a new one on
 * every render.
 */
function PrimaryCta({
  isMvp,
  onWaitlist,
  className = "",
}: {
  isMvp: boolean
  onWaitlist: () => void
  className?: string
}) {
  const classes = `inline-flex items-center justify-center gap-2 rounded-xl bg-[#d1870b] px-6 py-3.5 text-base font-bold text-white transition-colors hover:bg-[#9a6200] ${className}`;

  return isMvp ? (
    <Link href="/login" className={classes}>
      Get started — it&apos;s free
    </Link>
  ) : (
    <button type="button" onClick={onWaitlist} className={`${classes} cursor-pointer`}>
      Join the waitlist
    </button>
  );
}

export default function LandingPage() {
  const is_MVP = process.env.NEXT_PUBLIC_IS_MVP === "true";
  const [waitlistOpen, setWaitlistOpen] = useState(false);
  const openWaitlist = () => setWaitlistOpen(true);

  return (
    <div
      className={`${nightfallDisplay.variable} ${nightfallBody.variable} min-h-svh bg-[#fdfcf9] text-[#1b1a17] [font-family:var(--font-nightfall-body)]`}
    >
      <Navbar is_MVP={is_MVP} setWaitlistOpen={setWaitlistOpen} />
      <WaitlistModal open={waitlistOpen} onClose={() => setWaitlistOpen(false)} source="hero" />

      {/* HERO */}
      <header className="px-5 pt-14 sm:pt-20">
        <div className="mx-auto flex max-w-[1040px] flex-col items-center gap-5 text-center">
          <h1 className="max-w-[14ch] text-balance [font-family:var(--font-nightfall-display)] text-[clamp(2.5rem,6.2vw,4rem)] font-extrabold leading-[1.04]">
            Your life is a game. Time to start playing.
          </h1>
          <p className="max-w-[40ch] text-[clamp(1.05rem,2.2vw,1.22rem)] leading-relaxed text-[#6f6b63]">
            A journal, your habits and your tasks in one place — and a game underneath that
            makes you come back tomorrow.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <PrimaryCta isMvp={is_MVP} onWaitlist={openWaitlist} />
            <a
              href="#how"
              className="inline-flex items-center justify-center rounded-xl border border-[#eae5da] bg-white px-6 py-3.5 text-base font-bold transition-colors hover:border-[#d9d2c4]"
            >
              See how it works
            </a>
          </div>
          <p className="text-sm text-[#6f6b63]">
            {is_MVP ? "Free forever. No card needed." : "Free forever when it launches. No card needed."}
          </p>
        </div>

        {/* Narrower than the page's own column: at full width the rows stretch
            and the card stops reading as a screen of the app. */}
        <div className="mx-auto mt-10 max-w-[820px] sm:mt-16">
          <DashboardPanel />
        </div>
      </header>

      {/* HOW IT WORKS */}
      <section id="how" className="px-5 py-16 sm:py-[5.75rem]">
        <div className="mx-auto max-w-[1040px]">
          <div className="max-w-[720px]">
            <h2 className="[font-family:var(--font-nightfall-display)] text-[clamp(1.8rem,3.8vw,2.4rem)] font-extrabold leading-tight">
              How it works
            </h2>
            <p className="mt-3 text-[#6f6b63]">Three things, every day. Two minutes is enough.</p>
          </div>

          <ol className="mt-11 grid gap-7 sm:grid-cols-3 sm:gap-8">
            {STEPS.map((step, index) => (
              <li key={step.title} className="flex flex-col gap-2.5">
                <span className="grid size-9 place-items-center rounded-full bg-[#fdf4e2] [font-family:var(--font-nightfall-display)] text-[0.95rem] font-extrabold text-[#9a6200]">
                  {index + 1}
                </span>
                <h3 className="text-[1.1rem] font-bold">{step.title}</h3>
                <p className="text-[0.97rem] text-[#6f6b63]">{step.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" className="border-t border-[#f3efe6] px-5 py-16 sm:py-[5.75rem]">
        <div className="mx-auto flex max-w-[1040px] flex-col gap-16 sm:gap-24">
          <div className="grid items-center gap-8 md:grid-cols-2 md:gap-16">
            <div className="flex flex-col gap-3.5">
              <p className="text-[0.74rem] font-bold uppercase tracking-[0.12em] text-[#9a6200]">Journal</p>
              <h2 className="text-balance [font-family:var(--font-nightfall-display)] text-[clamp(1.7rem,3.4vw,2.2rem)] font-extrabold leading-tight">
                A journal shaped like your life, not a form
              </h2>
              <p className="text-[#6f6b63]">
                Start with the built-in templates, then build your own out of sixteen field
                types — moods, sliders, ratings, checklists, even a habit tracker and a day
                planner inside the entry.
              </p>
              <p className="text-[#6f6b63]">
                Every template carries its own XP, so a two-minute check-in and a full weekly
                review are both worth doing.
              </p>
            </div>
            <TemplatesPanel />
          </div>

          <div className="grid items-center gap-8 md:grid-cols-2 md:gap-16">
            <div className="md:order-2 flex flex-col gap-3.5">
              <p className="text-[0.74rem] font-bold uppercase tracking-[0.12em] text-[#9a6200]">Habits</p>
              <h2 className="text-balance [font-family:var(--font-nightfall-display)] text-[clamp(1.7rem,3.4vw,2.2rem)] font-extrabold leading-tight">
                A streak that forgives you
              </h2>
              <p className="text-[#6f6b63]">
                Miss a day and a freeze covers it — nothing you earned gets taken away. The XP
                per habit grows with your streak, up to double, so consistency pays more than
                any single good day.
              </p>
            </div>
            <div className="md:order-1">
              <StreakPanel />
            </div>
          </div>

          <div className="grid items-center gap-8 md:grid-cols-2 md:gap-16">
            <div className="flex flex-col gap-3.5">
              <p className="text-[0.74rem] font-bold uppercase tracking-[0.12em] text-[#9a6200]">
                Daily reflection
              </p>
              <h2 className="text-balance [font-family:var(--font-nightfall-display)] text-[clamp(1.7rem,3.4vw,2.2rem)] font-extrabold leading-tight">
                One question a day
              </h2>
              <p className="text-[#6f6b63]">
                A new question every morning, and one tap from reading it to writing about it.
                No blank page, no deciding what to write about.
              </p>
            </div>
            <ReflectionPanel />
          </div>
        </div>
      </section>

      {/* EVERYTHING IN ONE PLACE */}
      <section className="border-t border-[#f3efe6] px-5 py-16 sm:py-[5.75rem]">
        <div className="mx-auto max-w-[1040px]">
          <div className="max-w-[720px]">
            <h2 className="[font-family:var(--font-nightfall-display)] text-[clamp(1.8rem,3.8vw,2.4rem)] font-extrabold leading-tight">
              Everything in one place
            </h2>
            <p className="mt-3 text-[#6f6b63]">
              So you stop keeping your life in four apps that don&apos;t talk to each other.
            </p>
          </div>

          <div className="mt-10 grid gap-px overflow-hidden rounded-2xl border border-[#eae5da] bg-[#eae5da] sm:grid-cols-2 lg:grid-cols-3">
            {EVERYTHING.map((item) => (
              <div key={item.title} className="flex flex-col gap-1.5 bg-white px-6 py-5">
                <b className="text-base font-bold">{item.title}</b>
                <span className="text-[0.9rem] leading-relaxed text-[#6f6b63]">{item.body}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* MISSION */}
      <section className="border-t border-[#f3efe6] px-5 py-16 sm:py-[5.75rem]">
        <div className="mx-auto flex max-w-[720px] flex-col gap-5">
          <p className="text-[0.74rem] font-bold uppercase tracking-[0.12em] text-[#9a6200]">
            Why this exists
          </p>
          <blockquote className="text-balance [font-family:var(--font-nightfall-display)] text-[clamp(1.4rem,3vw,1.9rem)] font-bold leading-snug">
            &ldquo;Journaling and self-reflection are the most powerful tools for personal
            growth — but they only work if you actually do them. So I made a game out of
            it.&rdquo;
          </blockquote>
          <p className="text-[#6f6b63]">
            Every habit app I tried punished me for missing a day, and I stopped opening all of
            them. LifeQuest is built the other way round: the streak can be frozen, nothing you
            earned gets taken away, and the only pressure is a character standing there in gear
            you paid for with real days.
          </p>
          <p className="text-sm text-[#6f6b63]">
            <span className="font-bold text-[#1b1a17]">Patrick Eger</span> · Founder of LifeQuest
          </p>
        </div>
      </section>

      <Roadmap />

      {/* PRICING */}
      <section id="pricing" className="border-t border-[#f3efe6] px-5 py-16 sm:py-[5.75rem]">
        <div className="mx-auto flex max-w-[720px] flex-col items-start gap-3.5">
          <h2 className="[font-family:var(--font-nightfall-display)] text-[clamp(1.8rem,3.8vw,2.4rem)] font-extrabold leading-tight">
            Free. All of it.
          </h2>
          <p className="text-[#6f6b63]">
            Every template, every field type, every habit, the whole game. No trial, no card,
            nothing held back behind a tier that doesn&apos;t exist yet.
          </p>
          <PrimaryCta isMvp={is_MVP} onWaitlist={openWaitlist} className="mt-2" />
        </div>
      </section>

      {/* CLOSING */}
      <section className="border-t border-[#eae5da] bg-[#fdf4e2] px-5 py-16 sm:py-[5.75rem]">
        <div className="mx-auto flex max-w-[720px] flex-col items-center gap-4 text-center">
          <h2 className="[font-family:var(--font-nightfall-display)] text-[clamp(1.9rem,4.2vw,2.6rem)] font-extrabold leading-tight">
            Two minutes tonight.
          </h2>
          <p className="max-w-[34ch] text-[#6f6b63]">
            Tomorrow there&apos;s a streak to keep, and that turns out to be enough.
          </p>
          <PrimaryCta isMvp={is_MVP} onWaitlist={openWaitlist} className="mt-1" />
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-[#f3efe6] px-5">
        <div className="mx-auto flex max-w-[1040px] flex-wrap items-center justify-between gap-4 py-7 text-sm text-[#6f6b63]">
          <span>
            <span className="[font-family:var(--font-nightfall-display)] text-[1.05rem] font-extrabold text-[#1b1a17]">
              Life<span className="text-[#d1870b]">Quest</span>
            </span>
            <span className="ml-3">© 2026</span>
          </span>
          <nav className="flex flex-wrap gap-6">
            <Link href="/privacy" className="hover:text-[#1b1a17]">Privacy</Link>
            <Link href="/terms" className="hover:text-[#1b1a17]">Terms</Link>
            <Link href="/contact" className="hover:text-[#1b1a17]">Contact</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}

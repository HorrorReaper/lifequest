"use client";

import { useState } from "react";
import Link from "next/link";
import WaitlistModal from "@/components/waitlist/WaitlistModal";
import Roadmap from "@/components/marketing/Roadmap";
import Navbar from "@/components/layout/Navbar";
import { DashboardPanel } from "@/components/marketing/ProductPanels";
import Features from "@/components/marketing/Features";
import HowItWorks from "@/components/marketing/HowItWorks";
import Mission from "@/components/marketing/Mission";
import Pricing from "@/components/marketing/Pricing";
import { PrimaryCta } from "@/components/marketing/PrimaryCta";
import { TypedHeading } from "@/components/marketing/TypedHeading";
import { StickyCta } from "@/components/marketing/StickyCta";
import { nightfallBody, nightfallDisplay } from "@/lib/marketing-fonts";

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
        {/* Stacked and centred until there is room for two columns; from lg the
            copy sits left and the panel beside it. Wider than the page's other
            sections, because two columns need the room. */}
        <div className="mx-auto flex max-w-[1040px] flex-col items-center gap-10 lg:max-w-[1180px] lg:flex-row lg:items-center lg:gap-14">
          <div className="flex flex-col items-center gap-5 text-center lg:flex-1 lg:items-start lg:text-left">
            <TypedHeading
              text={"Your life is a game.\nTime to start playing!"}
              className="max-w-[14ch] text-balance [font-family:var(--font-nightfall-display)] text-[clamp(2.5rem,6.2vw,4rem)] font-extrabold leading-[1.04]"
            />
            <p className="max-w-[40ch] text-[clamp(1.05rem,2.2vw,1.22rem)] leading-relaxed text-[#6f6b63]">
              Your journal, habits, daily plan and tasks all in one place. <br></br>Get rewarded for showing up and becoming the best version of yourself, one day at a time.
            </p>
            <div className="flex flex-wrap justify-center gap-3 lg:justify-start">
              <PrimaryCta isMvp={is_MVP} onWaitlist={openWaitlist} />
              <a
                href="#how"
                className="inline-flex items-center justify-center rounded-xl border border-[#eae5da] bg-white px-6 py-3.5 text-base font-bold transition-colors hover:border-[#d9d2c4]"
              >
                See how it works
              </a>
            </div>
          </div>

          {/* Capped below the column it sits in: stretched to the full half the
              rows spread out and the card stops reading as a screen of the app. */}
          <div className="w-full max-w-[820px] lg:max-w-[560px] lg:flex-1">
            <DashboardPanel />
          </div>
        </div>
      </header>

      <HowItWorks />

      <Features />

      <Mission />

      <Roadmap />

      <Pricing isMvp={is_MVP} onWaitlist={openWaitlist} />

      {/* CLOSING 
      <section className="border-t border-[#eae5da] bg-[#fdf4e2] px-5 py-16 sm:py-[5.75rem]">
        <Reveal className="mx-auto flex max-w-[720px] flex-col items-center gap-4 text-center">
          <h2 className="[font-family:var(--font-nightfall-display)] text-[clamp(2.2rem,4.8vw,3rem)] font-extrabold leading-tight">
            Two minutes tonight.
          </h2>
          <p className="max-w-[34ch] text-[#6f6b63]">
            Tomorrow there&apos;s a streak to keep, and that turns out to be enough.
          </p>
          <PrimaryCta isMvp={is_MVP} onWaitlist={openWaitlist} className="mt-1" />
        </Reveal>
      </section>*/}

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

      <StickyCta isMvp={is_MVP} onWaitlist={openWaitlist} />
    </div>
  );
}

"use client";
import { useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  Check,
} from "lucide-react";
import WaitlistModal from "@/components/waitlist/WaitlistModal";
import Roadmap from "@/components/marketing/Roadmap";
import Navbar from "@/components/layout/Navbar";
import { NightfallHero } from "@/components/marketing/NightfallHero";
import { nightfallBody, nightfallDisplay } from "@/lib/marketing-fonts";

export default function LandingPage() {
  const is_MVP = process.env.NEXT_PUBLIC_IS_MVP === "true";
  const [waitlistOpen, setWaitlistOpen] = useState(false);

  return (
    <div className={`${nightfallDisplay.variable} ${nightfallBody.variable} min-h-svh bg-[#060a14] [font-family:var(--font-nightfall-body)]`}>
      {/* NAV */}
      <Navbar is_MVP={is_MVP} setWaitlistOpen={setWaitlistOpen} />

      <NightfallHero isMvp={is_MVP} onWaitlistOpen={() => setWaitlistOpen(true)} />
      <WaitlistModal
        open={waitlistOpen}
        onClose={() => setWaitlistOpen(false)}
        source="hero"
      />

      {/* SOCIAL PROOF */}


      {/* FEATURES */}
      {/*<section id="features" className="container mx-auto px-4 py-24 max-w-6xl">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight">
            Game mechanics
          </h2>
          <p className="text-lg text-muted-foreground mt-4 max-w-2xl mx-auto">
            Most journaling apps die in the drawer of forgotten tools. Ours rewards you for showing up every single day.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[
            { icon: BookOpen, title: "Build Your Own Templates", desc: "Design your own journal templates with 14+ field types like moods, sliders, ratings, prompts and many more. Make journaling yours.", color: "text-blue-500" },
            { icon: Hammer, title: "Your City, Your Progress", desc: "Every entry earns you coins and XP. Spend them on houses, parks, stadiums and watch your city grow as you do.", color: "text-purple-500" },
            { icon: Flame, title: "Streaks That Hit Different", desc: "Streak multipliers stack your rewards. Miss a day and you reset, because consistency is the whole game.", color: "text-orange-500" },
            { icon: Calendar, title: "Plan Tomorrow Tonight", desc: "Time-block your next day during your evening journal. Wake up knowing exactly what to do.", color: "text-green-500" },
            { icon: ListTodo, title: "Tasks Without the App-Switching", desc: "Capture to-dos in your journal. They land on your dashboard automatically. No Notion, no Todoist, no chaos.", color: "text-pink-500" },
            { icon: BarChart3, title: "See Your Patterns", desc: "Mood trends, activity heatmaps, habit streaks. Find out what actually makes you feel good.", color: "text-yellow-500" },
          ].map((f, i) => (
            <motion.div
              key={i}
              initial={{ y: 16, opacity: 0 }}
              whileInView={{ y: 0, opacity: 1 }}
              viewport={{ once: true, amount: 0.25 }}
              transition={{ duration: 0.5, delay: i * 0.08, ease: "easeOut" }}
              className="rounded-xl border p-6 hover:border-primary/50 hover:shadow-md transition-all"
            >
              <f.icon className={`h-8 w-8 ${f.color} mb-3`} />
              <h3 className="font-semibold text-lg mb-2">{f.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>*/}
      <section id="features" className="container mx-auto px-4 py-24 max-w-6xl">
  <div className="text-left md:text-center mb-14">

    <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight text-[#f3f5fb] [font-family:var(--font-nightfall-display)]">
      A journal that gives something back
    </h2>
    <p className="text-lg text-[#93a3c4] mt-4 max-w-2xl md:mx-auto">
      LifeQuest turns small daily check-ins into visible progress with XP, streaks,
      coins, and your virtual city that grows with you.
    </p>
  </div>

  <div className="grid md:grid-cols-6 gap-6">
    {[
      {
        tile: "🏙️",
        title: "Every entry adds to your city",
        desc: "Complete a journal entry, earn coins, place buildings, and watch your map fill up with amazing buildings.",
        className: "md:col-span-4",
        preview: "city",
      },
      {
        tile: "🔥",
        title: "Protect your streak",
        desc: "Show up daily to keep your streak alive. Miss a day and your multiplier resets.",
        className: "md:col-span-2",
        preview: "streak",
      },
      {
        tile: "📓",
        title: "Turn any journal into a quest",
        desc: "Build templates for morning check-ins, evening reviews, habits, workouts, or whatever you want to track.",
        className: "md:col-span-2",
        preview: "xp",
      },
      {
        tile: "🌙",
        title: "Plan tomorrow before bed",
        desc: "Use your evening review to set priorities and time-block tomorrow before the next day begins.",
        className: "md:col-span-2",
        preview: "plan",
      },
      {
        tile: "📊",
        title: "Spot what improves your days",
        desc: "Track mood, energy, habits, and activity over time so your patterns become obvious.",
        className: "md:col-span-2",
        preview: "analytics",
      },
    ].map((f) => (
      <div
        key={f.title}
        className={`
          group relative overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0d1626] p-6
          transition-all duration-300 hover:-translate-y-1 hover:border-[rgba(247,185,85,0.35)]
          ${f.className}
        `}
      >
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[rgba(247,185,85,0.6)] to-transparent opacity-0 transition-opacity group-hover:opacity-100" />

        <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl border border-white/[0.08] bg-[#111d33] text-2xl shadow-inner">
          {f.tile}
        </div>

        <h3 className="font-semibold text-xl mb-2 text-[#f3f5fb]">{f.title}</h3>
        <p className="text-sm text-[#93a3c4] leading-relaxed max-w-xl">
          {f.desc}
        </p>

        {f.preview === "city" && (
          <div className="mt-6 grid grid-cols-10 gap-1 max-w-sm">
            {["", "", "🏠", "🌳", "", "🏪", "", "🌳", "", "🏫",
              "", "🌷", "", "", "☕", "", "🏢", "", "", ""].map((tile, i) => (
              <div
                key={i}
                className="aspect-square rounded bg-[#111d33] border border-white/[0.06] flex items-center justify-center text-sm"
              >
                {tile}
              </div>
            ))}
          </div>
        )}

        {f.preview === "streak" && (
          <div className="mt-6 flex gap-1.5">
            {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
              <div
                key={`${d}-${i}`}
                className={`flex h-8 w-8 items-center justify-center rounded-md text-xs font-semibold ${
                  i < 5
                    ? "bg-[rgba(247,185,85,0.14)] text-[#f7b955] border border-[rgba(247,185,85,0.3)]"
                    : "bg-[#111d33] text-[#93a3c4] border border-white/[0.06]"
                }`}
              >
                {d}
              </div>
            ))}
          </div>
        )}

        {f.preview === "xp" && (
          <div className="mt-6 flex flex-wrap gap-2 text-xs">
            <span className="rounded-full border border-[rgba(247,185,85,0.25)] bg-[rgba(247,185,85,0.14)] px-2.5 py-1 text-[#f7b955]">
              +25 XP
            </span>
            <span className="rounded-full border border-[rgba(247,185,85,0.25)] bg-[rgba(247,185,85,0.14)] px-2.5 py-1 text-[#f7b955]">
              +10 coins
            </span>
            <span className="rounded-full border border-[rgba(143,160,255,0.25)] bg-[rgba(143,160,255,0.14)] px-2.5 py-1 text-[#8fa0ff]">
              Level progress
            </span>
          </div>
        )}

        {f.preview === "plan" && (
          <div className="mt-6 space-y-2 text-xs">
            {["07:30 Morning review", "18:00 Gym", "21:30 Evening quest"].map((item) => (
              <div
                key={item}
                className="rounded-lg border border-white/[0.06] bg-[#111d33] px-3 py-2 text-[#93a3c4]"
              >
                {item}
              </div>
            ))}
          </div>
        )}

        {f.preview === "analytics" && (
          <div className="mt-6 flex items-end gap-1.5 h-16">
            {[35, 52, 44, 70, 58, 82, 64].map((h, i) => (
              <div
                key={i}
                className="w-6 rounded-t bg-[rgba(247,185,85,0.14)] border border-[rgba(247,185,85,0.25)]"
                style={{ height: `${h}%` }}
              />
            ))}
          </div>
        )}
      </div>
    ))}
  </div>
</section>


      {/* HOW IT WORKS */}
      <section id="how-it-works" className="bg-[#0d1626] py-24">
        <div className="container mx-auto px-4 max-w-5xl">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight text-[#f3f5fb] [font-family:var(--font-nightfall-display)]">
              How it works
            </h2>
          </div>

          <div className="space-y-12">
            {[
              { step: "1", title: "Pick or build a template", desc: "Start with our morning, evening, or weekly review templates — or build your own with drag-and-drop.", emoji: "🎨", image:"/images/Step1.png" },
              { step: "2", title: "Journal for 2 minutes", desc: "Open the app, fill in your fields, hit submit. That's it. Earn coins, XP, and grow your streak.", emoji: "✍️", image:"/images/Step2.png" },
              { step: "3", title: "Watch your city grow", desc: "Spend coins on buildings. Unlock new ones at higher levels. Your discipline becomes a skyline.", emoji: "🏙️", image:"/images/Step3.png" },
            ].map((s, i) => {
              const isReversed = i % 2 === 1;
              return (
              <div
                key={i}
                className={`flex flex-col md:flex-row items-center gap-8 ${isReversed ? "md:flex-row-reverse" : ""}`}
              >
                <motion.div
                  initial={{ x: isReversed ? 100 : -100, opacity: 0 }}
                  whileInView={{ x: 0, opacity: 1 }}
                  viewport={{ once: true, amount: 0.35 }}
                  transition={{ duration: 0.6, ease: "easeOut" }}
                  className="w-full md:w-1/2 mt-10"
                >
                  <Image src={s.image} alt={s.title} width={900} height={506} className="object-cover rounded-2xl border border-white/[0.08] shadow-md" />
                </motion.div>

                <motion.div
                  initial={{ x: isReversed ? -100 : 100, opacity: 0 }}
                  whileInView={{ x: 0, opacity: 1 }}
                  viewport={{ once: true, amount: 0.35 }}
                  transition={{ duration: 0.6, ease: "easeOut" }}
                  className="w-full md:w-1/2 text-left"
                >
                  <div className="inline-flex items-center justify-center h-10 w-10 rounded-full bg-[rgba(247,185,85,0.14)] text-[#f7b955] font-bold text-sm mb-4">
                    {s.step}
                  </div>
                  <h3 className="font-semibold text-2xl mb-3 text-[#f3f5fb]">{s.title}</h3>
                  <p className="text-sm text-[#93a3c4]">{s.desc}</p>
                </motion.div>
              </div>
            )})}
          </div>
        </div>
      </section>
      

      {/* Our Mission */}
      <section className="container mx-auto px-4 py-24 max-w-4xl text-center">
        <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight text-[#f3f5fb] [font-family:var(--font-nightfall-display)]">
          My mission.
        </h2>
        <p className="text-lg text-[#93a3c4] mt-4">
          I believe that journaling and self-reflection are the most powerful tools for personal growth, but they only work if you actually do them. So I made a game out of it that holds you accountable and makes it fun to show up every day. My mission is to help millions of people turn journaling into the most addictive, rewarding habit they've ever had, and in doing so, become the best versions of themselves.
        </p>
        <p className="text-sm text-[#93a3c4] mt-6">
          - Patrick Eger, Founder of LifeQuest
        </p>
        <Roadmap />
      </section>

      {/* TESTIMONIAL */}
      {/*<section className="container mx-auto px-4 py-24 max-w-4xl">
        <div className="rounded-2xl border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-purple-500/5 p-10 md:p-16 text-center">
          <p className="text-2xl md:text-3xl font-medium leading-relaxed">
            "I've tried every journaling app out there. This is the first one I've actually opened
            for 30 days straight. The city builder is genius — I literally <em>want</em> to journal now. I love to gamify my life"
          </p>
          <div className="mt-6 flex items-center justify-center gap-3">
            <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary to-purple-500" />
            <div className="text-left">
              <p className="font-semibold text-sm">Patrick Eger</p>
              <p className="text-xs text-muted-foreground">Founder, LifeQuest</p>
            </div>
          </div>
        </div>
      </section>*/}

      {/* PRICING */}
      <section id="pricing" className="container mx-auto px-4 py-24 max-w-4xl">
        <div className="text-center mb-12">
          <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight text-[#f3f5fb] [font-family:var(--font-nightfall-display)]">
            Free to start. Forever.
          </h2>
          <p className="text-lg text-[#93a3c4] mt-4">
            We believe great habits shouldn't be paywalled.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <motion.div
            initial={{ x: -100, opacity: 0 }}
            whileInView={{ x: 0, opacity: 1 }}
            viewport={{ once: true, amount: 0.35 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="rounded-2xl border border-white/[0.08] bg-[#0d1626] p-8"
          >
            <h3 className="text-xl font-bold text-[#f3f5fb]">Free</h3>
            <p className="text-[#93a3c4] text-sm mt-1">For everyone</p>
            <p className="text-4xl font-extrabold mt-6 text-[#f3f5fb] [font-family:var(--font-nightfall-display)]">$0<span className="text-base font-normal text-[#93a3c4]">/forever</span></p>
            <ul className="space-y-3 mt-6 text-sm">
              {[
                "Unlimited journal entries",
                "All 14+ field types",
                "City builder with all buildings",
                "Streaks, XP & analytics",
                "Day planner & tasks",
              ].map((f) => (
                <li key={f} className="flex items-center gap-2 text-[#f3f5fb]">
                  <Check className="h-4 w-4 text-[#f7b955]" /> {f}
                </li>
              ))}
            </ul>
            {is_MVP ? (
            <Button className="w-full mt-8 bg-[linear-gradient(180deg,#ffc873,#f7b955)] text-[#1a1204] hover:opacity-90" asChild>
              <Link href="/login">Get started for free</Link>
            </Button>):(
              <Button variant="outline" className="w-full mt-8 border-white/[0.08] dark:border-white/[0.08] text-[#f3f5fb] hover:bg-white/10 bg-transparent" onClick={() => setWaitlistOpen(true)}>
                Join the waitlist
              </Button>
            )}
          </motion.div>

          <motion.div
            initial={{ x: 100, opacity: 0 }}
            whileInView={{ x: 0, opacity: 1 }}
            viewport={{ once: true, amount: 0.35 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="rounded-2xl border-2 border-[rgba(143,160,255,0.35)] p-8 relative bg-[linear-gradient(180deg,#0d1626,rgba(143,160,255,0.14))]"
          >
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#8fa0ff] text-[#0c1230] text-xs font-semibold px-3 py-1 rounded-full">
              COMING SOON
            </div>
            <h3 className="text-xl font-bold text-[#f3f5fb]">Pro</h3>
            <p className="text-[#93a3c4] text-sm mt-1">For the real ones.</p>
            <p className="text-4xl font-extrabold mt-6 text-[#f3f5fb] [font-family:var(--font-nightfall-display)]">$5<span className="text-base font-normal text-[#93a3c4]">/month</span></p>
            <ul className="space-y-3 mt-6 text-sm">
              {[
                "Everything in Free",
                "AI-powered weekly summaries",
                "Export to PDF / Markdown",
                "Custom city themes",
                "Priority support",
              ].map((f) => (
                <li key={f} className="flex items-center gap-2 text-[#f3f5fb]">
                  <Check className="h-4 w-4 text-[#8fa0ff]" /> {f}
                </li>
              ))}
            </ul>
            <Button variant="outline" className="w-full mt-8 border-white/[0.08] dark:border-white/[0.08] text-[#93a3c4] bg-transparent" disabled>
              Join the waitlist
            </Button>
          </motion.div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="container mx-auto px-4 py-24 max-w-4xl text-center">
        <motion.div
          initial={{ y: 40, opacity: 0 }}
          whileInView={{ y: 0, opacity: 1 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="rounded-2xl border border-white/[0.08] p-8 bg-[#0d1626] group transform-gpu hover:scale-103 hover:-translate-y-1 hover:shadow-xl transition-all duration-200 ease-out mx-auto max-w-3xl overflow-hidden"
        >
          <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight mb-2 text-[#f3f5fb] [font-family:var(--font-nightfall-display)]">
            Your future self is waiting.
          </h2>
          <p className="text-base text-[#93a3c4] mt-2 max-w-xl mx-auto">
            Join the players turning daily journaling into the most addictive habit they've ever had.
          </p>
          <div className="mt-6">
            {is_MVP ? (
              <Button
                size="lg"
                asChild
                className="mt-4 group-hover:scale-102 transform transition-transform duration-150 inline-flex items-center justify-center bg-[linear-gradient(180deg,#ffc873,#f7b955)] text-[#1a1204] hover:opacity-90"
              >
                <Link href="/login">
                  Start your quest <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            ) : (
              <Button
                size="lg"
                onClick={() => setWaitlistOpen(true)}
                className="mt-4 group-hover:scale-102 transform transition-transform duration-150 inline-flex items-center justify-center hover:cursor-pointer bg-[linear-gradient(180deg,#ffc873,#f7b955)] text-[#1a1204] hover:opacity-90"
              >
                Join the waitlist now <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            )}
          </div>
          <div className="mt-10 flex items-end justify-center gap-1 h-[70px] opacity-70" aria-hidden="true">
            {[18, 30, 22, 38, 16, 44, 26].map((h, i) => (
              <span
                key={i}
                className="w-4 rounded-t-[3px] bg-[linear-gradient(180deg,#1a2740,#0d1626)]"
                style={{ height: h }}
              />
            ))}
          </div>
        </motion.div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-white/[0.08]">
        <div className="container mx-auto px-4 py-8 max-w-6xl flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-[#93a3c4]">
          <div className="flex items-center gap-2">
            <Link href="/" className="flex  gap-2 font-bold ">
            <Image src="/images/logo2.png" alt="LifeQuest logo" width={170} height={80} className="rounded-sm" />
          </Link>
            <span>© 2026 LifeQuest</span>
          </div>
          <div className="flex gap-6">
            <Link href="/privacy" className="hover:text-[#f3f5fb]">Privacy</Link>
            <Link href="/terms" className="hover:text-[#f3f5fb]">Terms</Link>
            <Link href="/contact" className="hover:text-[#f3f5fb]">Contact</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

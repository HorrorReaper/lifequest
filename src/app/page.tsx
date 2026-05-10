"use client";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import {
  BookOpen,
  Building2,
  Sparkles,
  Flame,
  ListTodo,
  Calendar,
  BarChart3,
  Hammer,
  ArrowRight,
  Check,
} from "lucide-react";

function TypewriterText({ text, speed = 35, className = "", start = true, onComplete, hideCursorAfter = 5000 }) {
  const [pos, setPos] = useState(0);
  const [showCursor, setShowCursor] = useState(true);

  useEffect(() => {
    if (!start) return;
    if (pos >= text.length) {
      // when complete, schedule cursor hide
      const h = setTimeout(() => setShowCursor(false), hideCursorAfter);
      if (onComplete) onComplete();
      return () => clearTimeout(h);
    }
    const t = setTimeout(() => setPos((p) => p + 1), speed);
    return () => clearTimeout(t);
  }, [pos, text, speed, start, hideCursorAfter, onComplete]);

  useEffect(() => {
    // reset if text or start changes
    setPos(0);
    setShowCursor(true);
  }, [text, start]);

  return (
    <span className={className}>
      {text.slice(0, pos)}
      {showCursor && <span className="ml-1 opacity-80 inline-block">|</span>}
    </span>
  );
}

function HeroTitle() {
  const [firstDone, setFirstDone] = useState(false);
  return (
    <>
      <TypewriterText text={"Your life is a game."} className="block" onComplete={() => setFirstDone(true)} />
      <br />
      <span className="bg-gradient-to-r from-primary to-purple-500 bg-clip-text text-transparent">
        <TypewriterText text={"Time to start playing."} className="block" start={firstDone} />
      </span>
    </>
  );
}

export default function LandingPage() {
  return (
    <div className="min-h-svh bg-gradient-to-b from-background via-background to-primary/5">
      {/* NAV */}
      <header className="sticky top-0 z-50 backdrop-blur-md bg-background/80 border-b">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between max-w-6xl">
          <Link href="/" className="flex items-center gap-2 font-bold text-lg">
            <Image src="/images/logo2.png" alt="LifeQuest logo" width={170} height={170} className="rounded-sm" />
          </Link>
          <nav className="hidden md:flex items-center gap-6 text-sm">
            <a href="#features" className="text-muted-foreground hover:text-foreground">Features</a>
            <a href="#how-it-works" className="text-muted-foreground hover:text-foreground">How it works</a>
            <a href="#pricing" className="text-muted-foreground hover:text-foreground">Pricing</a>
          </nav>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/login">Log in</Link>
            </Button>
            <Button size="sm" asChild>
              <Link href="/login">Get started</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* HERO */}
      <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="container mx-auto px-4 pt-20 pb-24 max-w-6xl text-center">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
          <Sparkles className="h-4 w-4" />
          The self-improvement app that plays like a game. Journal, earn rewards, and build your dream life one day at a time.
        </div>
        <h1 className="text-5xl md:text-7xl font-bold tracking-tight leading-tight">
          <HeroTitle />
        </h1>
        <p className="text-lg md:text-xl text-muted-foreground mt-6 max-w-2xl mx-auto">
          Earn XP and coins for every journal entry, task, and habit. Spend them building a city that grows as you grow. Journaling has never been this addictive.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-8">
          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="w-full sm:w-auto">
            <Button size="lg" asChild className="w-full sm:w-auto">
              <Link href="/login">
                Start your quest <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </motion.div>
          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="w-full sm:w-auto">
            <Button size="lg" variant="outline" asChild className="w-full sm:w-auto">
              <a href="#how-it-works">See how it works</a>
            </Button>
          </motion.div>
        </div>
        <p className="text-xs text-muted-foreground mt-4">
          Free forever • No credit card required • Build your first building in 60 seconds
        </p>

        {/* Hero visual */}
        <div className="mt-16 relative">
          <div className="absolute inset-0 bg-gradient-to-t from-background to-transparent z-10 h-1/3 bottom-0 top-auto" />
          <div className="rounded-2xl border-2 border-primary/20 shadow-2xl bg-card p-6 max-w-4xl mx-auto">
            <div className="grid md:grid-cols-3 gap-4 text-left">
              <div className="rounded-lg border p-4 bg-gradient-to-br from-orange-50 to-yellow-50 dark:from-orange-950/30 dark:to-yellow-950/30">
                <Flame className="h-6 w-6 text-orange-500 mb-2" />
                <p className="text-2xl font-bold">12 days</p>
                <p className="text-xs text-muted-foreground">Current streak</p>
              </div>
              <div className="rounded-lg border p-4 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-950/30 dark:to-pink-950/30">
                <Sparkles className="h-6 w-6 text-purple-500 mb-2" />
                <p className="text-2xl font-bold">Level 4</p>
                <p className="text-xs text-muted-foreground">325 / 500 XP</p>
              </div>
              <div className="rounded-lg border p-4 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30">
                <Building2 className="h-6 w-6 text-green-500 mb-2" />
                <p className="text-2xl font-bold">23 buildings</p>
                <p className="text-xs text-muted-foreground">Population: 184</p>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-10 gap-1 max-w-md mx-auto">
              {["🏠","🌳","🏪","🌷","☕","🌳","🏫","⛲","📚","🏢",
                "🌳","🏥","🏞️","🍽️","🎭","🏨","🗽","🏟️","🏙️","🏰"].map((e, i) => (
                <div key={i} className="aspect-square rounded bg-white dark:bg-gray-800 flex items-center justify-center text-lg shadow-sm">
                  {e}
                </div>
              ))}
            </div>
          </div>
        </div>
      </motion.section>

      {/* SOCIAL PROOF */}
      

      {/* FEATURES */}
      <section id="features" className="container mx-auto px-4 py-24 max-w-6xl">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight">
            Every feature is designed to make you come back tomorrow
          </h2>
          <p className="text-lg text-muted-foreground mt-4 max-w-2xl mx-auto">
            Most journaling apps die in the drawer of forgotten tools. Ours rewards you for showing up.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[
            { icon: BookOpen, title: "Build Your Own Quests", desc: "Design journal templates with 14+ field types — moods, sliders, ratings, prompts. Make journaling yours.", color: "text-blue-500" },
            { icon: Hammer, title: "Your City, Your Progress", desc: "Every entry drops coins and XP. Spend them on houses, parks, stadiums — and watch your skyline rise as you do.", color: "text-purple-500" },
            { icon: Flame, title: "Streaks That Hit Different", desc: "Streak multipliers stack your rewards. Miss a day and you reset — because consistency is the whole game.", color: "text-orange-500" },
            { icon: Calendar, title: "Plan Tomorrow Tonight", desc: "Time-block your next day during your evening journal. Wake up knowing exactly what to crush.", color: "text-green-500" },
            { icon: ListTodo, title: "Tasks Without the App-Switching", desc: "Capture to-dos mid-journal. They land on your dashboard automatically. No Notion, no Todoist, no chaos.", color: "text-pink-500" },
            { icon: BarChart3, title: "See Your Patterns", desc: "Mood trends, activity heatmaps, habit streaks. Find out what actually makes you feel alive.", color: "text-yellow-500" },
          ].map((f, i) => (
            <div key={i} className="rounded-xl border p-6 hover:border-primary/50 hover:shadow-md transition-all">
              <f.icon className={`h-8 w-8 ${f.color} mb-3`} />
              <h3 className="font-semibold text-lg mb-2">{f.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how-it-works" className="bg-muted/30 py-24">
        <div className="container mx-auto px-4 max-w-5xl">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight">
              How it works
            </h2>
            <p className="text-lg text-muted-foreground mt-4">
              Three steps to a journaling habit that actually sticks.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              { step: "1", title: "Pick or build a template", desc: "Start with our morning, evening, or weekly review templates — or build your own with drag-and-drop.", emoji: "🎨" },
              { step: "2", title: "Journal for 2 minutes", desc: "Open the app, fill in your fields, hit save. That's it. Earn coins, XP, and grow your streak.", emoji: "✍️" },
              { step: "3", title: "Watch your city grow", desc: "Spend coins on buildings. Unlock new ones at higher levels. Your discipline becomes a skyline.", emoji: "🏙️" },
            ].map((s, i) => (
              <div key={i} className="text-center">
                <div className="text-6xl mb-4">{s.emoji}</div>
                <div className="inline-flex items-center justify-center h-8 w-8 rounded-full bg-primary text-primary-foreground font-bold text-sm mb-3">
                  {s.step}
                </div>
                <h3 className="font-semibold text-lg mb-2">{s.title}</h3>
                <p className="text-sm text-muted-foreground">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
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
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight">
            Free to start. Forever.
          </h2>
          <p className="text-lg text-muted-foreground mt-4">
            We believe great habits shouldn't be paywalled.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="rounded-2xl border p-8">
            <h3 className="text-xl font-bold">Free</h3>
            <p className="text-muted-foreground text-sm mt-1">For everyone</p>
            <p className="text-4xl font-bold mt-6">$0<span className="text-base font-normal text-muted-foreground">/forever</span></p>
            <ul className="space-y-3 mt-6 text-sm">
              {[
                "Unlimited journal entries",
                "All 14+ field types",
                "City builder with all buildings",
                "Streaks, XP & analytics",
                "Day planner & tasks",
              ].map((f) => (
                <li key={f} className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-primary" /> {f}
                </li>
              ))}
            </ul>
            <Button className="w-full mt-8" asChild>
              <Link href="/login">Get started for free</Link>
            </Button>
          </div>

          <div className="rounded-2xl border-2 border-primary p-8 relative bg-primary/5">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-xs font-semibold px-3 py-1 rounded-full">
              COMING SOON
            </div>
            <h3 className="text-xl font-bold">Pro</h3>
            <p className="text-muted-foreground text-sm mt-1">For the real ones.</p>
            <p className="text-4xl font-bold mt-6">$5<span className="text-base font-normal text-muted-foreground">/month</span></p>
            <ul className="space-y-3 mt-6 text-sm">
              {[
                "Everything in Free",
                "AI-powered weekly summaries",
                "Export to PDF / Markdown",
                "Custom city themes",
                "Priority support",
              ].map((f) => (
                <li key={f} className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-primary" /> {f}
                </li>
              ))}
            </ul>
            <Button variant="outline" className="w-full mt-8" disabled>
              Join the waitlist
            </Button>
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="container mx-auto px-4 py-24 max-w-4xl text-center">
        <div className="rounded-2xl bg-gradient-to-br from-primary to-purple-600 text-white p-12 md:p-20">
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight">
            Your future self is waiting.
          </h2>
          <p className="text-lg opacity-90 mt-4 max-w-xl mx-auto">
            Join the players turning daily journaling into the most addictive habit they've ever had.
          </p>
          <Button size="lg" variant="secondary" asChild className="mt-8">
            <Link href="/login">
              Start your city today <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t">
        <div className="container mx-auto px-4 py-8 max-w-6xl flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Link href="/" className="flex  gap-2 font-bold ">
            <Image src="/images/logo2.png" alt="LifeQuest logo" width={170} height={80} className="rounded-sm" />
          </Link>
            <span>© 2026 LifeQuest</span>
          </div>
          <div className="flex gap-6">
            <a href="#" className="hover:text-foreground">Privacy</a>
            <a href="#" className="hover:text-foreground">Terms</a>
            <a href="#" className="hover:text-foreground">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

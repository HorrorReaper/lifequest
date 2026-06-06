"use client";
import { motion } from "framer-motion";
import { ArrowUpRight, BookOpen, Brain, Dumbbell, Leaf, Mail, Rocket, Sparkles, TerminalSquare, Waves, Zap } from "lucide-react";

type NavItem = {
  label: string;
  href: string;
};

type SocialLink = {
  label: string;
  href: string;
  description: string;
};

type FocusArea = {
  title: string;
  eyebrow: string;
  description: string;
  icon: any;
};

type Insight = {
  title: string;
  category: string;
  description: string;
  meta: string;
};

const navItems: NavItem[] = [
  { label: "Philosophie", href: "#philosophy" },
  { label: "Fokus", href: "#focus" },
  { label: "Inhalte", href: "#content" },
  { label: "LifeQuest", href: "#lifequest" },
];

const socialLinks: SocialLink[] = [
  {
    label: "Medium",
    href: "https://medium.com/@pe.business007",
    description: "Längere Essays über Wachstum, Tools, Entrepreneurship und Umsetzung.",
  },
  {
    label: "Substack",
    href: "https://substack.com/@patricke3",
    description: "Newsletter, Gedanken und persönliche Learnings in kuratierter Form.",
  },
  {
    label: "X",
    href: "https://x.com/HorrorReaper07",
    description: "Build-in-public, kurze Beobachtungen, Tools und tägliche Impulse.",
  },
  {
    label: "Threads",
    href: "#",
    description: "Folgt bald: Alltag, Experimente und kurze Reflexionen.",
  },
];

const focusAreas: FocusArea[] = [
  {
    title: "Self-Development",
    eyebrow: "01 / Wachstum",
    description: "Prinzipien, Routinen und Reflexionen für ein bewussteres, stärkeres und klareres Leben.",
    icon: Brain,
  },
  {
    title: "Fitness & Ernährung",
    eyebrow: "02 / Fundament",
    description: "Gesundheit, Energie und körperliche Leistungsfähigkeit als Basis für ambitioniertes Handeln.",
    icon: Dumbbell,
  },
  {
    title: "AI & digitale Tools",
    eyebrow: "03 / Hebel",
    description: "Technologie als Verstärker für Fokus, Lernen, Produktivität und bessere Entscheidungen.",
    icon: Sparkles,
  },
  {
    title: "Entrepreneurship",
    eyebrow: "04 / Umsetzung",
    description: "Building, Experimente und echte Produkte statt abstrakter Theorie oder leeren Ideen.",
    icon: Rocket,
  },
];

const insights: Insight[] = [
  {
    title: "Warum persönliche Entwicklung ein System braucht",
    category: "Essay",
    description: "Ein Blick darauf, warum Wachstum selten durch Motivation entsteht — sondern durch wiederholbare Strukturen.",
    meta: "Coming soon",
  },
  {
    title: "AI als persönlicher Hebel, nicht als Abkürzung",
    category: "Reflection",
    description: "Wie digitale Tools helfen können, klarer zu denken, schneller zu lernen und bessere Routinen aufzubauen.",
    meta: "Draft",
  },
  {
    title: "Building in Public als Trainingsform",
    category: "Learning log",
    description: "Was passiert, wenn man nicht wartet, bis etwas perfekt ist, sondern beim Bauen sichtbar lernt.",
    meta: "In progress",
  },
];

const experiments = [
  "Personal OS für Routinen, Ziele und Reflexion",
  "AI-gestützte Workflows für Content und Lernen",
  "Fitness- und Ernährungs-Systeme für mehr Energie",
];

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0 },
};

const stagger = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.11,
    },
  },
};

function SectionLabel({ children }: { children: string }) {
  return (
    <div className="mb-6 inline-flex items-center gap-3 rounded-full border border-[#D8CEC0]/80 bg-[#F7F4EE]/70 px-4 py-2 text-[11px] font-medium uppercase tracking-[0.28em] text-[#5E6B63] shadow-sm backdrop-blur">
      <span className="h-1.5 w-1.5 rounded-full bg-[#7A856E]" />
      {children}
    </div>
  );
}

function PrimaryButton({ href, children }: { href: string; children: any }) {
  return (
    <a
      href={href}
      className="group inline-flex items-center justify-center gap-2 rounded-full bg-[#2E2C29] px-6 py-3 text-sm font-semibold text-[#F7F4EE] shadow-[0_18px_45px_rgba(46,44,41,0.18)] transition duration-300 hover:-translate-y-0.5 hover:bg-[#4E5B56] focus:outline-none focus:ring-2 focus:ring-[#7A856E] focus:ring-offset-4 focus:ring-offset-[#F7F4EE]"
    >
      {children}
      <ArrowUpRight className="h-4 w-4 transition duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
    </a>
  );
}

function SecondaryButton({ href, children }: { href: string; children: any }) {
  return (
    <a
      href={href}
      className="group inline-flex items-center justify-center gap-2 rounded-full border border-[#B7B09C]/80 bg-[#F7F4EE]/70 px-6 py-3 text-sm font-semibold text-[#2E2C29] transition duration-300 hover:-translate-y-0.5 hover:border-[#7A856E] hover:bg-[#EFE8DD] focus:outline-none focus:ring-2 focus:ring-[#7A856E] focus:ring-offset-4 focus:ring-offset-[#F7F4EE]"
    >
      {children}
      <ArrowUpRight className="h-4 w-4 opacity-70 transition duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
    </a>
  );
}

function Header() {
  return (
    <header className="fixed left-0 right-0 top-0 z-50 border-b border-[#D8CEC0]/45 bg-[#F7F4EE]/78 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-6 lg:px-8">
        <a href="#top" className="group flex items-center gap-3 focus:outline-none focus:ring-2 focus:ring-[#7A856E] focus:ring-offset-4 focus:ring-offset-[#F7F4EE]">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#2E2C29] text-xs font-semibold text-[#F7F4EE] shadow-sm transition duration-300 group-hover:bg-[#4E5B56]">PE</span>
          <span className="hidden text-sm font-semibold tracking-wide text-[#2E2C29] sm:block">Patrick Eger</span>
        </a>
        <nav className="hidden items-center gap-8 md:flex" aria-label="Hauptnavigation">
          {navItems.map((item) => (
            <a key={item.href} href={item.href} className="text-sm font-medium text-[#5E6B63] transition hover:text-[#2E2C29] focus:outline-none focus:ring-2 focus:ring-[#7A856E] focus:ring-offset-4 focus:ring-offset-[#F7F4EE]">
              {item.label}
            </a>
          ))}
        </nav>
        <a href="https://substack.com/@patricke3" className="inline-flex items-center gap-2 rounded-full border border-[#D8CEC0] bg-[#EFE8DD]/60 px-4 py-2 text-sm font-semibold text-[#2E2C29] transition hover:border-[#7A856E] hover:bg-[#EFE8DD] focus:outline-none focus:ring-2 focus:ring-[#7A856E] focus:ring-offset-4 focus:ring-offset-[#F7F4EE]">
          <Mail className="h-4 w-4" />
          <span className="hidden sm:inline">Newsletter</span>
        </a>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section id="top" className="relative isolate overflow-hidden px-5 pb-24 pt-32 sm:px-6 lg:px-8 lg:pb-32 lg:pt-40">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_20%_10%,rgba(183,176,156,0.34),transparent_32%),radial-gradient(circle_at_85%_20%,rgba(122,133,110,0.18),transparent_28%),linear-gradient(180deg,#F7F4EE_0%,#EFE8DD_100%)]" />
      <div className="absolute left-1/2 top-28 -z-10 h-[520px] w-[520px] -translate-x-1/2 rounded-full border border-[#D8CEC0]/50 opacity-60" />
      <div className="absolute right-10 top-40 hidden h-36 w-36 rounded-full border border-[#B7B09C]/50 lg:block" />
      <motion.div variants={stagger} initial="hidden" animate="show" className="mx-auto grid max-w-7xl items-end gap-14 lg:grid-cols-[1.08fr_0.92fr]">
        <div>
          <motion.div variants={fadeUp} className="mb-7 inline-flex items-center gap-3 rounded-full border border-[#D8CEC0] bg-[#F7F4EE]/70 px-4 py-2 text-xs font-medium text-[#5E6B63] shadow-sm backdrop-blur">
            <Waves className="h-4 w-4" />
            Personal development × AI × Building
          </motion.div>
          <motion.h1 variants={fadeUp} className="max-w-4xl font-serif text-5xl font-medium leading-[0.98] tracking-[-0.055em] text-[#2E2C29] sm:text-6xl md:text-7xl lg:text-[86px]">
            Persönliche Entwicklung, verstärkt durch Technologie.
          </motion.h1>
          <motion.p variants={fadeUp} className="mt-8 max-w-2xl text-lg leading-8 text-[#5E6B63] sm:text-xl sm:leading-9">
            Ich bin Patrick Eger. Ich erforsche, baue und teile Systeme für ein gesünderes, fokussierteres und ambitionierteres Leben — an der Schnittstelle von Self-Development, AI, Fitness und Entrepreneurship.
          </motion.p>
          <motion.div variants={fadeUp} className="mt-10 flex flex-col gap-4 sm:flex-row">
            <PrimaryButton href="https://substack.com/@patricke3">Newsletter abonnieren</PrimaryButton>
            <SecondaryButton href="https://lifequest-bice-beta.vercel.app/">LifeQuest ansehen</SecondaryButton>
          </motion.div>
        </div>
        <motion.div variants={fadeUp} className="relative">
          <div className="rounded-[2.2rem] border border-[#D8CEC0] bg-[#F7F4EE]/72 p-4 shadow-[0_28px_80px_rgba(46,44,41,0.12)] backdrop-blur">
            <div className="rounded-[1.7rem] bg-[#2E2C29] p-6 text-[#F7F4EE]">
              <div className="flex items-center justify-between border-b border-[#F7F4EE]/10 pb-5">
                <div>
                  <p className="text-xs uppercase tracking-[0.28em] text-[#D8CEC0]">Current thesis</p>
                  <p className="mt-2 text-lg font-semibold">Life as a system</p>
                </div>
                <Leaf className="h-6 w-6 text-[#B7B09C]" />
              </div>
              <div className="mt-8 space-y-5">
                {[
                  ["Body", "Fitness, Ernährung, Energie"],
                  ["Mind", "Fokus, Reflexion, Lernen"],
                  ["Tools", "AI, Workflows, digitale Hebel"],
                  ["Build", "Produkte, Experimente, Umsetzung"],
                ].map(([label, value]) => (
                  <div key={label} className="grid grid-cols-[88px_1fr] items-center gap-4">
                    <p className="text-sm text-[#B7B09C]">{label}</p>
                    <div className="rounded-2xl border border-[#F7F4EE]/10 bg-[#F7F4EE]/6 px-4 py-3 text-sm text-[#EFE8DD]">{value}</div>
                  </div>
                ))}
              </div>
              <div className="mt-8 rounded-3xl bg-[#F7F4EE] p-5 text-[#2E2C29]">
                <p className="text-sm font-semibold">Notiz</p>
                <p className="mt-2 text-sm leading-6 text-[#5E6B63]">Wachstum wird greifbar, wenn aus Ideen Systeme werden — und aus Systemen echte Handlungen.</p>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </section>
  );
}

function Philosophy() {
  return (
    <section id="philosophy" className="px-5 py-24 sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[0.78fr_1.22fr]">
        <motion.div variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true, margin: "-120px" }}>
          <SectionLabel>Philosophie</SectionLabel>
          <h2 className="font-serif text-4xl font-medium tracking-[-0.04em] text-[#2E2C29] sm:text-5xl">Wachstum ist kein einzelner Hack. Es ist ein System aus Energie, Klarheit und Umsetzung.</h2>
        </motion.div>
        <motion.div variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true, margin: "-120px" }} className="space-y-7 text-lg leading-8 text-[#5E6B63]">
          <motion.p variants={fadeUp}>
            Meine Arbeit beginnt mit einer einfachen Beobachtung: Die besten Veränderungen entstehen selten aus mehr Information. Sie entstehen, wenn Wissen in Routinen, Entscheidungen, Produkte und Feedback-Loops übersetzt wird.
          </motion.p>
          <motion.p variants={fadeUp}>
            Deshalb verbinde ich persönliche Entwicklung mit Technologie. AI, digitale Tools und smarte Workflows sind keine Ersatzhandlung — sie sind Hebel, um fokussierter zu lernen, klarer zu denken und konsequenter zu handeln.
          </motion.p>
          <motion.p variants={fadeUp}>
            LifeQuest und meine Inhalte sind Ausdruck dieser Haltung: weniger Theorie als Selbstzweck, mehr praktische Systeme für Menschen, die ernsthaft an sich, ihren Projekten und einem ambitionierten Leben bauen.
          </motion.p>
        </motion.div>
      </div>
    </section>
  );
}

function Focus() {
  return (
    <section id="focus" className="bg-[#EFE8DD]/72 px-5 py-24 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <motion.div variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true, margin: "-120px" }} className="max-w-3xl">
          <SectionLabel>Focus Areas</SectionLabel>
          <h2 className="font-serif text-4xl font-medium tracking-[-0.04em] text-[#2E2C29] sm:text-5xl">Die Themenfelder, aus denen mein persönliches Betriebssystem entsteht.</h2>
        </motion.div>
        <motion.div variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true, margin: "-120px" }} className="mt-14 grid gap-5 md:grid-cols-2">
          {focusAreas.map((area) => {
            const Icon = area.icon;
            return (
              <motion.article key={area.title} variants={fadeUp} className="group rounded-[2rem] border border-[#D8CEC0] bg-[#F7F4EE]/72 p-7 shadow-sm transition duration-300 hover:-translate-y-1 hover:border-[#B7B09C] hover:bg-[#F7F4EE] hover:shadow-[0_24px_70px_rgba(46,44,41,0.08)]">
                <div className="mb-12 flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#7A856E]">{area.eyebrow}</p>
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#EFE8DD] text-[#4E5B56] transition group-hover:bg-[#D8CEC0]">
                    <Icon className="h-5 w-5" />
                  </span>
                </div>
                <h3 className="text-2xl font-semibold tracking-[-0.03em] text-[#2E2C29]">{area.title}</h3>
                <p className="mt-4 max-w-xl leading-7 text-[#5E6B63]">{area.description}</p>
              </motion.article>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
}

function ContentHub() {
  return (
    <section id="content" className="px-5 py-24 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-end">
          <motion.div variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true, margin: "-120px" }}>
            <SectionLabel>Content Hub</SectionLabel>
            <h2 className="font-serif text-4xl font-medium tracking-[-0.04em] text-[#2E2C29] sm:text-5xl">Ein Zuhause für Ideen — und ein Wegweiser zu den richtigen Plattformen.</h2>
          </motion.div>
          <motion.p variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true, margin: "-120px" }} className="text-lg leading-8 text-[#5E6B63]">
            Die Website ersetzt meine Kanäle nicht. Sie bündelt sie. Hier entsteht der Kontext: welche Themen mich beschäftigen, woran ich baue und wo du tiefer einsteigen kannst.
          </motion.p>
        </div>
        <motion.div variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true, margin: "-120px" }} className="mt-14 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          {socialLinks.map((link) => (
            <motion.a key={link.label} variants={fadeUp} href={link.href} className="group min-h-[240px] rounded-[2rem] border border-[#D8CEC0] bg-[#F7F4EE]/70 p-6 transition duration-300 hover:-translate-y-1 hover:border-[#7A856E] hover:bg-[#F7F4EE] focus:outline-none focus:ring-2 focus:ring-[#7A856E] focus:ring-offset-4 focus:ring-offset-[#F7F4EE]">
              <div className="flex items-start justify-between">
                <h3 className="text-xl font-semibold tracking-[-0.03em] text-[#2E2C29]">{link.label}</h3>
                <ArrowUpRight className="h-5 w-5 text-[#7A856E] transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </div>
              <p className="mt-16 text-sm leading-6 text-[#5E6B63]">{link.description}</p>
            </motion.a>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

function FeaturedInsights() {
  return (
    <section className="px-5 py-24 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl border-y border-[#D8CEC0] py-20">
        <motion.div variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true, margin: "-120px" }} className="mb-12 flex flex-col justify-between gap-8 md:flex-row md:items-end">
          <div className="max-w-2xl">
            <SectionLabel>Featured Insights</SectionLabel>
            <h2 className="font-serif text-4xl font-medium tracking-[-0.04em] text-[#2E2C29] sm:text-5xl">Gedanken, Essays und Learnings mit Substanz.</h2>
          </div>
          <SecondaryButton href="https://medium.com/@pe.business007">Alle Texte lesen</SecondaryButton>
        </motion.div>
        <motion.div variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true, margin: "-120px" }} className="divide-y divide-[#D8CEC0]">
          {insights.map((insight) => (
            <motion.article key={insight.title} variants={fadeUp} className="grid gap-6 py-8 md:grid-cols-[160px_1fr_120px] md:items-start">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#7A856E]">{insight.category}</p>
              <div>
                <h3 className="text-2xl font-semibold tracking-[-0.035em] text-[#2E2C29]">{insight.title}</h3>
                <p className="mt-3 max-w-2xl leading-7 text-[#5E6B63]">{insight.description}</p>
              </div>
              <p className="text-sm text-[#7A856E] md:text-right">{insight.meta}</p>
            </motion.article>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

function LifeQuest() {
  return (
    <section id="lifequest" className="px-5 py-24 sm:px-6 lg:px-8">
      <motion.div variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true, margin: "-120px" }} className="mx-auto grid max-w-7xl overflow-hidden rounded-[2.4rem] bg-[#2E2C29] text-[#F7F4EE] shadow-[0_28px_90px_rgba(46,44,41,0.18)] lg:grid-cols-[0.95fr_1.05fr]">
        <div className="p-8 sm:p-10 lg:p-14">
          <div className="mb-7 inline-flex items-center gap-3 rounded-full border border-[#F7F4EE]/12 bg-[#F7F4EE]/7 px-4 py-2 text-xs font-medium uppercase tracking-[0.24em] text-[#D8CEC0]">
            <Zap className="h-4 w-4" />
            Startup / LifeQuest
          </div>
          <h2 className="font-serif text-4xl font-medium tracking-[-0.04em] sm:text-5xl">Ein Produkt für Menschen, die Wachstum praktischer machen wollen.</h2>
          <p className="mt-6 max-w-xl text-lg leading-8 text-[#D8CEC0]">
            LifeQuest übersetzt persönliche Entwicklung in eine greifbare Produktidee: Ziele, Routinen und Fortschritt sollen nicht abstrakt bleiben, sondern sichtbar, spielbar und umsetzbar werden.
          </p>
          <div className="mt-10">
            <a href="https://lifequest-bice-beta.vercel.app/" className="group inline-flex items-center justify-center gap-2 rounded-full bg-[#F7F4EE] px-6 py-3 text-sm font-semibold text-[#2E2C29] transition duration-300 hover:-translate-y-0.5 hover:bg-[#EFE8DD] focus:outline-none focus:ring-2 focus:ring-[#B7B09C] focus:ring-offset-4 focus:ring-offset-[#2E2C29]">
              LifeQuest ausprobieren
              <ArrowUpRight className="h-4 w-4 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </a>
          </div>
        </div>
        <div className="relative min-h-[420px] border-t border-[#F7F4EE]/10 bg-[#4E5B56] p-8 sm:p-10 lg:border-l lg:border-t-0 lg:p-14">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_20%,rgba(247,244,238,0.18),transparent_34%),radial-gradient(circle_at_80%_80%,rgba(216,206,192,0.16),transparent_32%)]" />
          <div className="relative rounded-[2rem] border border-[#F7F4EE]/18 bg-[#F7F4EE]/10 p-5 backdrop-blur">
            <div className="flex items-center justify-between border-b border-[#F7F4EE]/12 pb-4">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-[#D8CEC0]">Quest board</p>
                <h3 className="mt-2 text-2xl font-semibold">Build your next loop</h3>
              </div>
              <TerminalSquare className="h-6 w-6 text-[#EFE8DD]" />
            </div>
            <div className="mt-6 space-y-4">
              {[
                ["Daily quest", "30 min training + focused work block", "78%"],
                ["Weekly review", "Reflect, adjust, recommit", "42%"],
                ["Long-term arc", "Become healthier, sharper, more capable", "61%"],
              ].map(([label, text, percent]) => (
                <div key={label} className="rounded-2xl bg-[#F7F4EE] p-4 text-[#2E2C29]">
                  <div className="flex justify-between gap-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#7A856E]">{label}</p>
                      <p className="mt-2 text-sm font-medium">{text}</p>
                    </div>
                    <p className="text-sm font-semibold text-[#4E5B56]">{percent}</p>
                  </div>
                  <div className="mt-4 h-2 overflow-hidden rounded-full bg-[#EFE8DD]">
                    <div className="h-full rounded-full bg-[#7A856E]" style={{ width: percent }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </motion.div>
    </section>
  );
}

function Projects() {
  return (
    <section className="bg-[#EFE8DD]/62 px-5 py-24 sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[0.85fr_1.15fr]">
        <motion.div variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true, margin: "-120px" }}>
          <SectionLabel>Projects / Experiments</SectionLabel>
          <h2 className="font-serif text-4xl font-medium tracking-[-0.04em] text-[#2E2C29] sm:text-5xl">Raum für das, was aus Ideen wird.</h2>
        </motion.div>
        <motion.div variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true, margin: "-120px" }} className="space-y-4">
          {experiments.map((experiment, index) => (
            <motion.div key={experiment} variants={fadeUp} className="flex items-center gap-5 rounded-[1.6rem] border border-[#D8CEC0] bg-[#F7F4EE]/72 p-5">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#EFE8DD] text-sm font-semibold text-[#5E6B63]">0{index + 1}</span>
              <p className="text-lg font-medium tracking-[-0.02em] text-[#2E2C29]">{experiment}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

function FinalCTA() {
  return (
    <footer className="px-5 py-24 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl rounded-[2.4rem] border border-[#D8CEC0] bg-[#F7F4EE]/76 p-8 shadow-sm sm:p-10 lg:p-14">
        <div className="grid gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
          <div>
            <SectionLabel>Bleib verbunden</SectionLabel>
            <h2 className="max-w-3xl font-serif text-4xl font-medium tracking-[-0.04em] text-[#2E2C29] sm:text-5xl">Wenn du an persönlichem Wachstum, AI und Building interessiert bist, bist du hier richtig.</h2>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-[#5E6B63]">
              Folge meinen Gedanken, lies längere Essays oder teste LifeQuest. Die Website bleibt der ruhige Hub für alles, was daraus entsteht.
            </p>
          </div>
          <div className="flex flex-col gap-4 sm:flex-row lg:flex-col lg:items-start">
            <PrimaryButton href="https://substack.com/@patricke3">Newsletter abonnieren</PrimaryButton>
            <SecondaryButton href="https://lifequest-bice-beta.vercel.app/">LifeQuest ansehen</SecondaryButton>
          </div>
        </div>
        <div className="mt-14 flex flex-col justify-between gap-6 border-t border-[#D8CEC0] pt-8 sm:flex-row sm:items-center">
          <p className="text-sm text-[#5E6B63]">© 2026 Patrick Eger. Personal development, technology and building.</p>
          <div className="flex flex-wrap gap-4">
            <a href="https://medium.com/@pe.business007" className="text-sm font-medium text-[#5E6B63] transition hover:text-[#2E2C29]">Medium</a>
            <a href="https://substack.com/@patricke3" className="text-sm font-medium text-[#5E6B63] transition hover:text-[#2E2C29]">Substack</a>
            <a href="https://x.com/HorrorReaper07" className="text-sm font-medium text-[#5E6B63] transition hover:text-[#2E2C29]">X</a>
          </div>
        </div>
      </div>
    </footer>
  );
}

export default function App() {
  return (
    <main className="min-h-screen bg-[#F7F4EE] font-sans text-[#2E2C29] antialiased selection:bg-[#B7B09C] selection:text-[#2E2C29]">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Newsreader:opsz,wght@6..72,400;6..72,500;6..72,600&display=swap');
        html { scroll-behavior: smooth; }
        body { margin: 0; background: #F7F4EE; }
        .font-serif { font-family: 'Newsreader', Georgia, serif; }
        .font-sans { font-family: 'Inter', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
      `}</style>
      <Header />
      <Hero />
      <Philosophy />
      <Focus />
      <ContentHub />
      <FeaturedInsights />
      <LifeQuest />
      <Projects />
      <FinalCTA />
    </main>
  );
}

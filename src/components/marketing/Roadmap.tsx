import { motion } from "framer-motion";

type RoadmapItem = {
  quarter: string;
  title: string;
  desc: string;
  status?: string;
};

const items: RoadmapItem[] = [
  { quarter: "Q2 2026", title: "Landing Page", desc: "Waitlist, landing page.", status: "Live" },
  { quarter: "Q3 2026", title: "Functional MVP", desc: "Core functionality (6 default journal templates, create your own templates, city builder), user onboarding.", status: "Work in Progress" },
  { quarter: "Q4 2026", title: "Habit Tracker, Tasks, Daily Planner", desc: "Integrate habit tracking, task management, and daily planning features.", status: "Planned" },
  { quarter: "Q2 2027", title: "Mobile Apps & Social", desc: "iOS & Android app, friend leaderboards, communities.", status: "Planned" },
  { quarter: "Q4 2027", title: "AI Coach & Personalization", desc: "AI-powered journaling prompts, insights, and personalized recommendations.", status: "Planned" },
  { quarter: "Q2 2028", title: "Integrations & Expansion", desc: "Integrate with popular health and productivity apps, expand to new platforms.", status: "Planned" },
  { quarter: "Q4 2028", title: "LifeQuest 2.0", desc: "Major update with new features, improved UX, and expanded content. LifeQuest as a all-around personal development platform.", status: "Planned" },
];

export default function Roadmap() {
  return (
    <section id="roadmap" className="container mx-auto px-4 py-24 max-w-6xl">
      <div className="text-center mb-12">
        <h2 className="text-4xl md:text-5xl font-bold tracking-tight">Roadmap</h2>
        <p className="text-lg text-muted-foreground mt-4 max-w-2xl mx-auto">Here is what I will build next:</p>
      </div>

      <div className="space-y-8">
        {items.map((it, i) => (
          <motion.div
            key={i}
            initial={{ y: 12, opacity: 0 }}
            whileInView={{ y: 0, opacity: 1 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.5, delay: i * 0.08, ease: "easeOut" }}
            className="flex flex-col md:flex-row items-start gap-6"
          >
            <div className="w-28 shrink-0">
              <div className="text-sm text-muted-foreground font-medium">{it.quarter}</div>
              <div className="mt-2 inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-muted/30">
                {it.status}
              </div>
            </div>

            <div className="flex-1 rounded-xl border p-6 bg-card">
              <h3 className="font-semibold text-lg mb-1">{it.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{it.desc}</p>
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

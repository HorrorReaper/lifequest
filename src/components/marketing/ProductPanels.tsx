import { Check } from "lucide-react";

// The product shots, drawn rather than photographed.
//
// A screenshot of this app would be a screenshot of one theme, would go stale
// the first time a surface changes, and would have to be re-cut for phone
// width. These panels are the same surfaces rebuilt from the same numbers the
// app really pays out, so they stay honest, stay on palette, and reflow at
// 400px like everything else on the page.
//
// Colours are literal on purpose: this page sits outside (app) and must not
// follow the in-app theme.

const CARD = "rounded-[1.25rem] border border-[#eae5da] bg-white p-5 shadow-[0_1px_2px_rgba(27,26,23,0.04)]";
const ROW = "flex items-center gap-3 rounded-xl border border-[#f3efe6] px-3.5 py-3";
const PILL = "shrink-0 rounded-full bg-[#fdf4e2] px-2.5 py-1 text-[0.76rem] font-bold text-[#9a6200]";
const PILL_GREEN = "shrink-0 rounded-full bg-[#eaf3ed] px-2.5 py-1 text-[0.76rem] font-bold text-[#3f7d5b]";

function Tick({ done = false }: { done?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={
        done
          ? "grid size-6 shrink-0 place-items-center rounded-full bg-[#3f7d5b] text-white"
          : "size-6 shrink-0 rounded-full border-[1.5px] border-[#eae5da]"
      }
    >
      {done && <Check className="size-3.5" strokeWidth={3} />}
    </span>
  );
}

function Row({
  emoji,
  label,
  sub,
  trailing,
}: {
  emoji?: string
  label: string
  sub?: string
  trailing?: React.ReactNode
}) {
  return (
    <div className={ROW}>
      {emoji && <span aria-hidden="true" className="shrink-0 text-lg">{emoji}</span>}
      <span className="min-w-0 flex-1">
        <span className="block text-[0.95rem] font-semibold text-[#1b1a17]">{label}</span>
        {sub && <span className="block text-[0.8rem] font-medium text-[#6f6b63]">{sub}</span>}
      </span>
      {trailing}
    </div>
  );
}

/** The hero shot: a dashboard part-way through an ordinary evening. */
export function DashboardPanel() {
  return (
    <div
      className={`${CARD} sm:p-7`}
      role="img"
      aria-label="The LifeQuest dashboard: level 6 with 1,240 XP, a 24-day streak, two habits, a task, and today's reflection question"
    >
      <div className="flex items-baseline justify-between gap-3">
        <div className="min-w-0">
          <p className="[font-family:var(--font-nightfall-display)] text-lg font-extrabold text-[#1b1a17]">
            Good evening, Patrick
          </p>
          <p className="text-[0.82rem] tabular-nums text-[#6f6b63]">
            Level 6 · 24-day streak · 86 coins
          </p>
        </div>
        <span className={PILL}>+25 XP today</span>
      </div>

      <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-[#f3efe6]">
        <div className="h-full rounded-full bg-[#d1870b]" style={{ width: "67%" }} />
      </div>
      <p className="mt-2 text-[0.82rem] tabular-nums text-[#6f6b63]">1,240 / 1,850 XP to level 7</p>

      <div className="mt-5 flex flex-col gap-2.5">
        <Row emoji="💧" label="Drink 2L of water" sub="Habit · 24 days running" trailing={<Tick done />} />
        <Row emoji="🏃" label="Move for 20 minutes" sub="Habit · +12 XP, +3 coins" trailing={<Tick />} />
        <Row emoji="📋" label="Send the project update" sub="Task · due today" trailing={<Tick />} />
      </div>

      <div className="mt-3.5 rounded-[0.9rem] border border-[#eae5da] px-4 py-4">
        <p className="text-[0.7rem] font-bold uppercase tracking-[0.14em] text-[#9a6200]">
          Today&apos;s question
        </p>
        <p className="mt-2 [font-family:var(--font-nightfall-display)] text-[1.1rem] font-bold leading-snug text-[#1b1a17]">
          What gave you energy today, and what quietly drained it?
        </p>
        <p className="mt-3 text-[0.88rem] font-bold text-[#9a6200]">Write about it →</p>
      </div>
    </div>
  );
}

/** Templates, with the XP each one actually pays. */
export function TemplatesPanel() {
  const templates = [
    { emoji: "🌅", name: "Morning Reflection", sub: "Gratitude, intention, energy", xp: "+25 XP" },
    { emoji: "🌙", name: "Evening Review", sub: "Win, challenge, tomorrow's focus", xp: "+25 XP" },
    { emoji: "📝", name: "Weekly Review", sub: "Look back, plan ahead", xp: "+50 XP" },
    { emoji: "💡", name: "Quick Insight", sub: "One thought, ten seconds", xp: "+5 XP" },
  ];

  return (
    <div className={CARD}>
      <div className="flex flex-col gap-2.5">
        {templates.map((template) => (
          <Row
            key={template.name}
            emoji={template.emoji}
            label={template.name}
            sub={template.sub}
            trailing={<span className={PILL}>{template.xp}</span>}
          />
        ))}
      </div>
    </div>
  );
}

/** A week of habits, with the freeze that covers the day that got away. */
export function StreakPanel() {
  const week = [
    { day: "M", state: "done" },
    { day: "T", state: "done" },
    { day: "W", state: "done" },
    { day: "T", state: "frozen" },
    { day: "F", state: "done" },
    { day: "S", state: "today" },
    { day: "S", state: "open" },
  ] as const;

  const dotClass = {
    done: "bg-[#eaf3ed] text-[#3f7d5b]",
    frozen: "bg-[#eef1fb] text-[#5a6bb8]",
    today: "bg-[#d1870b] text-white",
    open: "bg-[#f3efe6] text-[#6f6b63]",
  };

  return (
    <div className={CARD}>
      <div className="flex items-baseline justify-between gap-3">
        <p className="[font-family:var(--font-nightfall-display)] text-lg font-extrabold text-[#1b1a17]">
          This week
        </p>
        <p className="text-[0.82rem] tabular-nums text-[#6f6b63]">24 days running</p>
      </div>

      <div className="mt-4 flex gap-1.5">
        {week.map((entry, index) => (
          <span
            key={index}
            className={`grid size-8 flex-1 place-items-center rounded-lg text-[0.7rem] font-bold ${dotClass[entry.state]}`}
          >
            {entry.day}
          </span>
        ))}
      </div>
      <p className="mt-2.5 text-[0.8rem] text-[#6f6b63]">
        Thursday was covered by a freeze. The streak held.
      </p>

      <div className="mt-4 flex flex-col gap-2.5">
        <Row emoji="💧" label="Drink 2L of water" trailing={<span className={PILL_GREEN}>+20 XP</span>} />
        <Row emoji="📖" label="Read 10 pages" trailing={<span className={PILL_GREEN}>+20 XP</span>} />
        <Row emoji="🏃" label="Move for 20 minutes" trailing={<span className={PILL}>+3 coins</span>} />
      </div>
    </div>
  );
}

/** The day's question, and the empty box under it. */
export function ReflectionPanel() {
  return (
    <div className={CARD}>
      <p className="text-[0.7rem] font-bold uppercase tracking-[0.14em] text-[#9a6200]">
        Today&apos;s question
      </p>
      <p className="mt-2 [font-family:var(--font-nightfall-display)] text-[1.3rem] font-bold leading-snug text-[#1b1a17]">
        What are you avoiding right now, and what is the first two-minute step into it?
      </p>

      <div className="mt-4 rounded-xl border border-dashed border-[#eae5da] px-3.5 py-4">
        <p className="text-[0.92rem] text-[#6f6b63]">
          Whatever comes to mind. No one else reads this.
        </p>
      </div>

      <p className="mt-3.5 w-full rounded-xl bg-[#d1870b] px-5 py-3 text-center text-[0.92rem] font-bold text-white">
        Write about it
      </p>
    </div>
  );
}

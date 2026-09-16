"use client";

import { useEffect, useId, useState } from "react";
import { Check, RefreshCw } from "lucide-react";
import {
  REFLECTION_PROMPTS,
  randomReflectionPrompt,
  type ReflectionPrompt,
} from "@/lib/daily-reflection";
import { useCountUp } from "./useCountUp";

// The product shots, drawn rather than photographed, and clickable where the
// app itself is clickable.
//
// A screenshot of this app would be a screenshot of one theme, would go stale
// the first time a surface changes, and would have to be re-cut for phone
// width. These panels are the same surfaces rebuilt from the numbers the app
// really pays out, so a visitor who ticks a habit here sees the reward they
// would get for ticking it after signing up.
//
// Colours are literal on purpose: this page sits outside (app) and must not
// follow the in-app theme.

const CARD =
  "rounded-[1.25rem] border border-[#eae5da] bg-white p-5 shadow-[0_1px_2px_rgba(27,26,23,0.04)]";
const ROW = "flex items-center gap-3 rounded-xl border border-[#f3efe6] px-3.5 py-3";
const PILL = "shrink-0 rounded-full bg-[#fdf4e2] px-2.5 py-1 text-[0.76rem] font-bold text-[#9a6200]";
const PILL_GREEN =
  "shrink-0 rounded-full bg-[#eaf3ed] px-2.5 py-1 text-[0.76rem] font-bold text-[#3f7d5b]";

// ── The numbers, taken from the app rather than invented ─────────────────
//
// Level bands come from xpForLevel(level) = 25·level² + 25·level, so level 6
// runs from 1,050 to 1,400 XP. A habit pays round(10 × min(2, 1 + streak×0.02))
// XP and a flat 3 coins (src/lib/habit-xp.ts); a completed task pays 5 XP
// (src/lib/tasks.ts). Change one of those and this panel has to change too.
const LEVEL = 6;
const LEVEL_FLOOR = 1050;
const LEVEL_CEILING = 1400;
const BASE_XP = 1240;
const BASE_COINS = 86;

interface Checkable {
  id: string
  emoji: string
  label: string
  sub: string
  xp: number
  coins: number
}

const CHECKABLE: Checkable[] = [
  {
    id: "move",
    emoji: "🏃",
    label: "Move for 20 minutes",
    sub: "Habit · 12-day streak",
    xp: 12,
    coins: 3,
  },
  {
    id: "update",
    emoji: "📋",
    label: "Send the project update",
    sub: "Task · due today",
    xp: 5,
    coins: 0,
  },
];

function Tick({ done }: { done: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`grid size-6 shrink-0 place-items-center rounded-full transition-colors duration-200 ${
        done ? "bg-[#3f7d5b] text-white" : "border-[1.5px] border-[#eae5da]"
      }`}
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

/**
 * The hero shot, and the only thing on the page a visitor can actually play
 * with: tick a habit and the reward lands exactly as it would in the app.
 */
export function DashboardPanel() {
  const [done, setDone] = useState<string[]>([]);
  // Keyed so the same badge can replay on a second tick.
  const [burst, setBurst] = useState<{ key: number; xp: number; coins: number } | null>(null);

  const earnedXp = CHECKABLE.filter((item) => done.includes(item.id)).reduce(
    (total, item) => total + item.xp,
    0
  );
  const earnedCoins = CHECKABLE.filter((item) => done.includes(item.id)).reduce(
    (total, item) => total + item.coins,
    0
  );

  const xp = BASE_XP + earnedXp;
  const coins = BASE_COINS + earnedCoins;
  const shownXp = useCountUp(xp);
  const shownCoins = useCountUp(coins);
  // 25 for the evening review already written today, plus whatever gets
  // ticked here.
  const shownToday = useCountUp(25 + earnedXp);
  const percent = Math.round(((xp - LEVEL_FLOOR) / (LEVEL_CEILING - LEVEL_FLOOR)) * 100);

  useEffect(() => {
    if (!burst) return;
    const timer = window.setTimeout(() => setBurst(null), 1100);
    return () => window.clearTimeout(timer);
  }, [burst]);

  function toggle(item: Checkable) {
    setDone((current) => {
      if (current.includes(item.id)) return current.filter((id) => id !== item.id);
      setBurst({ key: Date.now(), xp: item.xp, coins: item.coins });
      return [...current, item.id];
    });
  }

  return (
    <div className={`${CARD} relative sm:p-7`}>
      <div className="flex items-baseline justify-between gap-3">
        <div className="min-w-0">
          <p className="[font-family:var(--font-nightfall-display)] text-lg font-extrabold text-[#1b1a17]">
            Good evening, Patrick
          </p>
          <p className="text-[0.82rem] tabular-nums text-[#6f6b63]">
            Level {LEVEL} · 24-day streak · {shownCoins} coins
          </p>
        </div>

        <span className={`${PILL} relative`}>
          {shownToday} XP today
          {burst && (
            <span
              key={burst.key}
              aria-hidden="true"
              className="pointer-events-none absolute -top-1 right-0 whitespace-nowrap text-[0.8rem] font-extrabold text-[#3f7d5b] motion-safe:animate-[lq-rise_1.1s_ease-out_forwards] motion-reduce:hidden"
            >
              +{burst.xp} XP{burst.coins > 0 && ` · +${burst.coins}`}
            </span>
          )}
        </span>
      </div>

      <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-[#f3efe6]">
        <div
          className="h-full rounded-full bg-[#d1870b] transition-[width] duration-700 ease-out motion-reduce:transition-none"
          style={{ width: `${percent}%` }}
        />
      </div>
      <p className="mt-2 text-[0.82rem] tabular-nums text-[#6f6b63]">
        {shownXp.toLocaleString("en-US")} / {LEVEL_CEILING.toLocaleString("en-US")} XP to level{" "}
        {LEVEL + 1}
      </p>

      <div className="mt-5 flex flex-col gap-2.5">
        <Row
          emoji="💧"
          label="Drink 2L of water"
          sub="Habit · 24 days running"
          trailing={<Tick done />}
        />

        {CHECKABLE.map((item) => {
          const checked = done.includes(item.id);
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => toggle(item)}
              aria-pressed={checked}
              className={`${ROW} w-full cursor-pointer text-left transition-colors hover:border-[#e0d8c6] hover:bg-[#fdfcf9] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d1870b]`}
            >
              <span aria-hidden="true" className="shrink-0 text-lg">{item.emoji}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-[0.95rem] font-semibold text-[#1b1a17]">
                  {item.label}
                </span>
                <span className="block text-[0.8rem] font-medium text-[#6f6b63]">
                  {item.sub} · +{item.xp} XP{item.coins > 0 && `, +${item.coins} coins`}
                </span>
              </span>
              <Tick done={checked} />
            </button>
          );
        })}
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

      <p className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.8rem] text-[#6f6b63]">
        {done.length > 0 ? (
          <>
            <span>That is real: the app pays exactly this.</span>
            <button
              type="button"
              onClick={() => setDone([])}
              className="cursor-pointer font-bold text-[#9a6200] underline underline-offset-2"
            >
              Reset
            </button>
          </>
        ) : (
          <span>Tick something. This panel pays out like the real one.</span>
        )}
      </p>
    </div>
  );
}

// ── Templates ────────────────────────────────────────────────────────────
//
// Evening Review's fields are the ones it really ships with. The other three
// list the kinds of field each is built from rather than quoting wording that
// would go stale the first time a system template is edited.

interface TemplateTab {
  id: string
  emoji: string
  name: string
  xp: number
  fields: string[]
}

const TEMPLATES: TemplateTab[] = [
  {
    id: "morning",
    emoji: "🌅",
    name: "Morning Reflection",
    xp: 25,
    fields: ["Gratitude", "Today's intention", "Energy level", "Mood"],
  },
  {
    id: "evening",
    emoji: "🌙",
    name: "Evening Review",
    xp: 25,
    fields: [
      "What was my biggest win today?",
      "What challenge did I face?",
      "What did I learn today?",
      "Tomorrow I will focus on…",
      "Rate your day",
      "Evening energy level",
    ],
  },
  {
    id: "weekly",
    emoji: "📝",
    name: "Weekly Review",
    xp: 50,
    fields: ["The week in review", "What worked", "Next week's checklist", "Rate the week"],
  },
  {
    id: "quick",
    emoji: "💡",
    name: "Quick Insight",
    xp: 5,
    fields: ["One thought worth keeping"],
  },
];

/** Templates, switchable, with the XP each one actually pays. */
export function TemplatesPanel() {
  const [activeId, setActiveId] = useState(TEMPLATES[1].id);
  const active = TEMPLATES.find((template) => template.id === activeId) ?? TEMPLATES[0];
  const panelId = useId();

  return (
    <div className={CARD}>
      <div role="tablist" aria-label="Journal templates" className="flex flex-wrap gap-1.5">
        {TEMPLATES.map((template) => {
          const selected = template.id === active.id;
          return (
            <button
              key={template.id}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={panelId}
              onClick={() => setActiveId(template.id)}
              className={`cursor-pointer rounded-full px-3 py-1.5 text-[0.78rem] font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d1870b] ${
                selected
                  ? "bg-[#1b1a17] text-white"
                  : "bg-[#f3efe6] text-[#6f6b63] hover:text-[#1b1a17]"
              }`}
            >
              <span aria-hidden="true" className="mr-1">{template.emoji}</span>
              {template.name}
            </button>
          );
        })}
      </div>

      <div id={panelId} role="tabpanel" className="mt-4">
        <div className="flex items-baseline justify-between gap-3">
          <p className="[font-family:var(--font-nightfall-display)] text-lg font-extrabold text-[#1b1a17]">
            {active.name}
          </p>
          <span className={PILL}>+{active.xp} XP</span>
        </div>

        <div key={active.id} className="mt-3 flex flex-col gap-2 motion-safe:animate-[lq-fade_260ms_ease-out]">
          {active.fields.map((field) => (
            <p
              key={field}
              className="rounded-xl border border-[#f3efe6] px-3.5 py-2.5 text-[0.88rem] text-[#6f6b63]"
            >
              {field}
            </p>
          ))}
        </div>
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

/**
 * The day's question — and the same "give me a different one" the dashboard
 * has, drawing on the same authored list rather than a marketing copy of it.
 */
export function ReflectionPanel() {
  const [prompt, setPrompt] = useState<ReflectionPrompt>(REFLECTION_PROMPTS[2]);

  return (
    <div className={CARD}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-[0.7rem] font-bold uppercase tracking-[0.14em] text-[#9a6200]">
          Today&apos;s question
        </p>
        <button
          type="button"
          onClick={() => setPrompt((current) => randomReflectionPrompt(current.id))}
          className="-mt-1 flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full border border-[#eae5da] px-2.5 py-1 text-[0.72rem] font-bold text-[#6f6b63] transition-colors hover:border-[#d9d2c4] hover:text-[#1b1a17] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d1870b]"
        >
          <RefreshCw className="size-3" aria-hidden="true" />
          Another one
        </button>
      </div>

      <p
        key={prompt.id}
        className="mt-2 min-h-[3.4em] [font-family:var(--font-nightfall-display)] text-[1.3rem] font-bold leading-snug text-[#1b1a17] motion-safe:animate-[lq-fade_260ms_ease-out]"
      >
        {prompt.text}
      </p>

      <div className="mt-4 rounded-xl border border-dashed border-[#eae5da] px-3.5 py-4">
        <p className="text-[0.92rem] text-[#6f6b63]">
          Whatever comes to mind. No one else reads this.
        </p>
      </div>

      <p className="mt-3.5 w-full rounded-xl bg-[#d1870b] px-5 py-3 text-center text-[0.92rem] font-bold text-white">
        Write about it
      </p>
      <p className="mt-2.5 text-center text-[0.78rem] text-[#6f6b63]">
        {REFLECTION_PROMPTS.length} questions, one a day, in a fixed rotation.
      </p>
    </div>
  );
}

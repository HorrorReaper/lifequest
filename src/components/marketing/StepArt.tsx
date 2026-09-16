// The three pictures over "How it works".
//
// Drawn rather than photographed, like the rest of the page: the app's own
// screenshots are dark-theme, would need re-cutting for phone width, and the
// one that used to sit here showed the retired city grid.
//
// Each shows the step's own moment and nothing the page already showed
// elsewhere — writing an entry, the payout landing, and the character the
// coins are for, which until now the page only mentioned in a list.
//
// Colours are literal: this page sits outside (app) and must not follow the
// in-app theme.

const FRAME =
  "flex h-[176px] flex-col justify-center gap-3 overflow-hidden rounded-[1.25rem] border border-[#eae5da] bg-white px-5 shadow-[0_1px_2px_rgba(27,26,23,0.04)]";
const LABEL = "text-[0.7rem] font-bold uppercase tracking-[0.12em] text-[#9a6200]";

/** Step 1 — an Evening Review part-way through being answered. */
export function WriteArt() {
  return (
    <div className={FRAME} role="img" aria-label="An evening review being answered, worth 25 XP">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[0.85rem] font-bold text-[#1b1a17]">🌙 Evening Review</span>
        <span className="shrink-0 rounded-full bg-[#fdf4e2] px-2 py-0.5 text-[0.68rem] font-bold text-[#9a6200]">
          +25 XP
        </span>
      </div>

      <div>
        <p className="text-[0.72rem] font-semibold text-[#6f6b63]">
          What was my biggest win today?
        </p>
        <div className="mt-1.5 rounded-lg border border-[#f3efe6] px-2.5 py-2">
          <span className="block h-1.5 w-[86%] rounded-full bg-[#eae5da]" />
          <span className="mt-1.5 block h-1.5 w-[54%] rounded-full bg-[#eae5da]" />
        </div>
      </div>

      <div className="flex items-center justify-between gap-2">
        <span className="text-[0.72rem] font-semibold text-[#6f6b63]">Rate your day</span>
        <span className="flex gap-0.5" aria-hidden="true">
          {[0, 1, 2, 3, 4].map((index) => (
            <Star key={index} filled={index < 4} />
          ))}
        </span>
      </div>
    </div>
  );
}

function Star({ filled }: { filled: boolean }) {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M12 2.6l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.4l-5.8 3.1 1.1-6.5L2.6 9.4l6.5-.9z"
        fill={filled ? "#d1870b" : "#f3efe6"}
      />
    </svg>
  );
}

/** Step 2 — the payout, in the two currencies the app really pays. */
export function EarnArt() {
  const week = ["M", "T", "W", "T", "F", "S", "S"];

  return (
    <div
      className={FRAME}
      role="img"
      aria-label="The reward for one day: 25 XP for the entry, 3 coins for a habit, and a 25-day streak"
    >
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="[font-family:var(--font-nightfall-display)] text-[2rem] font-extrabold leading-none text-[#d1870b]">
          +25
        </span>
        <span className="text-[0.8rem] font-semibold text-[#6f6b63]">XP for the entry</span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-[#eaf3ed] px-2.5 py-1 text-[0.72rem] font-bold text-[#3f7d5b]">
          +3 coins · habit
        </span>
        <span className="rounded-full bg-[#fdf4e2] px-2.5 py-1 text-[0.72rem] font-bold text-[#9a6200]">
          Streak 25
        </span>
      </div>

      <div className="flex gap-1" aria-hidden="true">
        {week.map((day, index) => (
          <span
            key={index}
            className={`grid h-6 flex-1 place-items-center rounded-md text-[0.62rem] font-bold ${
              index < 5
                ? "bg-[#eaf3ed] text-[#3f7d5b]"
                : index === 5
                  ? "bg-[#d1870b] text-white"
                  : "bg-[#f3efe6] text-[#6f6b63]"
            }`}
          >
            {day}
          </span>
        ))}
      </div>
    </div>
  );
}

/**
 * Step 3 — the character the coins are for.
 *
 * Drawn from the same 120×160 coordinate space as
 * src/components/profile/AvatarFigure.tsx, wearing the trail cap, trail vest,
 * hiking pack and hiking boots, in those items' own colours. The body is
 * lightened for a white page; the gear keeps the hues it has in the app so it
 * stays recognisable as the same equipment.
 */
export function LevelUpArt() {
  return (
    <div
      className={FRAME}
      role="img"
      aria-label="A hiker wearing a trail cap, trail vest, hiking pack and hiking boots, beside a level bar filling towards level 7"
    >
      <div className="flex items-center gap-4">
        <svg viewBox="26 6 68 146" className="h-[132px] w-auto shrink-0" aria-hidden="true">
          {/* hiking-pack, behind the body */}
          <g fill="hsl(28 42% 42%)" stroke="hsl(26 44% 26%)" strokeWidth="2" strokeLinejoin="round">
            <rect x="40" y="57" width="40" height="38" rx="10" />
            <rect x="46" y="76" width="28" height="12" rx="4" fill="hsl(28 42% 34%)" />
          </g>

          {/* base body */}
          <g
            fill="#f0ebe0"
            stroke="#a8a094"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="60" cy="36" r="15" />
            <g strokeWidth="1.8">
              <circle cx="55" cy="33" r="0.9" fill="#6f6b63" stroke="none" />
              <circle cx="65" cy="33" r="0.9" fill="#6f6b63" stroke="none" />
              <path d="M 54.5 40 Q 60 45 65.5 40" fill="none" stroke="#6f6b63" />
            </g>
            <path d="M 45 58 Q 60 53 75 58 L 73 99 Q 60 103 47 99 Z" />
            <path d="M 46 63 L 35 89" fill="none" />
            <path d="M 74 63 L 85 89" fill="none" />
            <path d="M 54 101 L 52 134" fill="none" />
            <path d="M 66 101 L 68 134" fill="none" />
          </g>

          {/* trail-vest */}
          <g fill="hsl(28 48% 50%)" stroke="hsl(26 46% 32%)" strokeWidth="2" strokeLinejoin="round">
            <path d="M 49 58 Q 60 54 71 58 L 70 98 Q 60 101 50 98 Z" />
            <rect x="52" y="76" width="7" height="8" rx="1.5" fill="hsl(26 46% 38%)" />
            <rect x="61" y="76" width="7" height="8" rx="1.5" fill="hsl(26 46% 38%)" />
          </g>

          {/* pack straps */}
          <g stroke="hsl(30 25% 30%)" strokeWidth="3" strokeLinecap="round" fill="none">
            <path d="M 52 58 L 50 84" />
            <path d="M 68 58 L 70 84" />
          </g>

          {/* hiking-boots */}
          <g fill="hsl(24 40% 34%)" stroke="hsl(24 44% 20%)" strokeWidth="2" strokeLinejoin="round">
            <rect x="45" y="123" width="15" height="18" rx="3" />
            <rect x="61" y="123" width="15" height="18" rx="3" />
            <g stroke="hsl(38 40% 72%)" strokeWidth="1.5">
              <path d="M 47 129 L 58 129" />
              <path d="M 63 129 L 74 129" />
            </g>
          </g>

          {/* trail-cap */}
          <g fill="hsl(152 32% 38%)" stroke="hsl(152 32% 24%)" strokeWidth="2" strokeLinejoin="round">
            <path d="M 47 28 Q 60 14 73 28 Z" />
            <path d="M 68 28 Q 80 27 86 30 Q 79 32 68 31 Z" />
          </g>
        </svg>

        <div className="min-w-0 flex-1">
          <p className={LABEL}>Level 6 → 7</p>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#f3efe6]">
            <div className="h-full w-[54%] rounded-full bg-[#d1870b]" />
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            <span className="rounded-full bg-[#fdf4e2] px-2 py-0.5 text-[0.66rem] font-bold text-[#9a6200]">
              Trail Cap 10
            </span>
            <span className="rounded-full bg-[#fdf4e2] px-2 py-0.5 text-[0.66rem] font-bold text-[#9a6200]">
              Hiking Pack 35
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";
import {
  buildParkShrubs,
  buildParkTrees,
  buildSkylineBuildings,
  buildStarField,
} from "@/lib/nightfall-scene";

interface NightfallHeroProps {
  isMvp: boolean;
  onWaitlistOpen: () => void;
}

const CITY_TREE_AFTER = [3, 9, 12];
const MOUNTAIN_CLIP =
  "polygon(0% 100%, 0% 58%, 9% 32%, 18% 50%, 27% 16%, 36% 44%, 47% 8%, 58% 40%, 67% 20%, 78% 46%, 88% 24%, 100% 54%, 100% 100%)";

export function NightfallHero({ isMvp, onWaitlistOpen }: NightfallHeroProps) {
  const buildings = buildSkylineBuildings();
  const stars = buildStarField();
  const trees = buildParkTrees();
  const shrubs = buildParkShrubs();

  return (
    <header
      className="relative overflow-hidden bg-[#060a14] [font-family:var(--font-nightfall-body)]"
      style={{ minHeight: "max(92vh, 720px)" }}
    >
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="absolute inset-0 animate-[nc-day-cycle_46s_ease-in-out_infinite] bg-[linear-gradient(180deg,#3c5f86_0%,#4f7593_40%,#a3714f_68%,#1c2634_100%)]" />
        <div className="absolute inset-0 animate-[nc-sunset-cycle_46s_ease-in-out_infinite] bg-[radial-gradient(circle_at_32%_22%,rgba(255,196,120,0.35),transparent_30%),linear-gradient(180deg,#2c3c5e_0%,#5a4864_38%,#a5613f_66%,#141c2b_100%)]" />
        <div className="absolute inset-0 animate-[nc-night-cycle_46s_ease-in-out_infinite] bg-[radial-gradient(circle_at_72%_15%,rgba(158,185,224,0.14),transparent_24%),linear-gradient(180deg,#060c1c_0%,#0f1c33_46%,#1c2338_68%,#05070f_100%)]" />

        <div className="absolute inset-0 animate-[nc-stars-cycle_46s_ease-in-out_infinite]">
          {stars.map((star, i) => (
            <span
              key={i}
              className="absolute animate-[nc-star-glimmer_4.4s_ease-in-out_infinite] rounded-full bg-white"
              style={{ left: star.left, top: star.top, width: star.size, height: star.size }}
            />
          ))}
        </div>

        <div className="absolute left-0 top-[30%] size-[58px] animate-[nc-sun-orbit_46s_linear_infinite] rounded-full bg-[#ffe7a0] shadow-[0_0_55px_16px_rgba(255,204,94,0.32)]" />
        <div className="absolute left-0 top-[26%] size-[46px] animate-[nc-moon-orbit_46s_linear_infinite] rounded-full bg-[radial-gradient(circle_at_34%_30%,#fff8ea,#e7eef8_65%)] shadow-[0_0_42px_12px_rgba(185,211,242,0.22)]" />

        <div className="absolute top-[16%] h-[14px] w-[130px] animate-[nc-cloud-drift_38s_linear_infinite] rounded-full bg-white/10 blur-[1px]" />
        <div className="absolute top-[27%] h-[10px] w-[90px] animate-[nc-cloud-drift_52s_linear_infinite] [animation-delay:-18s] rounded-full bg-white/[0.07] blur-[1px]" />
        <div className="absolute left-0 top-[22%] h-px w-[60px] animate-[nc-flight-crossing_24s_linear_infinite] [animation-delay:-6s] bg-[linear-gradient(90deg,transparent,rgba(255,222,168,0.6),#fff)]" />

        <div className="absolute -left-[12vw] -top-[14vw] size-[46vw] max-h-[520px] max-w-[520px] animate-[nc-sky-breathe_13s_ease-in-out_infinite_alternate] rounded-full bg-[rgba(252,196,110,0.14)] blur-[80px]" />

        <div
          className="absolute bottom-[336px] left-0 h-[150px] w-full bg-[linear-gradient(180deg,#3a4d72,#263757)] opacity-85"
          style={{ clipPath: MOUNTAIN_CLIP }}
        />

        <div className="absolute bottom-[124px] left-0 h-[260px] w-full overflow-hidden">
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(58,96,128,0.35)_0%,rgba(30,60,86,0.62)_28%,rgba(13,30,48,0.88)_100%)]" />
          <div
            className="absolute inset-x-0 -top-[2px] h-[96px] origin-top scale-y-[-1] bg-[linear-gradient(180deg,#3a4d72,transparent)] opacity-30 blur-[1.5px]"
            style={{ clipPath: MOUNTAIN_CLIP }}
          />
          <div className="absolute inset-x-0 top-0 h-[2px] bg-[linear-gradient(90deg,transparent,rgba(255,222,168,0.5)_45%,rgba(255,222,168,0.65)_55%,transparent)]" />
          {[
            { left: "38%", top: 20, width: 46 },
            { left: "46%", top: 32, width: 30 },
            { left: "52%", top: 14, width: 60 },
            { left: "58%", top: 38, width: 22 },
          ].map((glint, i) => (
            <span
              key={i}
              className="absolute h-[2px] animate-[nc-sea-glint_3.6s_ease-in-out_infinite] rounded-full bg-[rgba(255,232,190,0.7)]"
              style={{
                left: glint.left,
                top: glint.top,
                width: glint.width,
                animationDelay: `-${(i * 0.8).toFixed(1)}s`,
              }}
            />
          ))}
        </div>

        <div className="absolute inset-x-0 bottom-0 h-[220px]">
          <svg
            className="absolute bottom-0 left-0 h-full w-full"
            viewBox="0 0 800 220"
            preserveAspectRatio="none"
          >
            <path
              d="M -10 220 C 90 190, 120 160, 200 150 S 320 130, 380 108 S 470 90, 560 78"
              fill="none"
              stroke="rgba(226,204,166,0.35)"
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeDasharray="1 11"
            />
            <circle
              cx={120}
              cy={168}
              r={4.5}
              className="animate-[nc-beacon-pulse_3.2s_ease-in-out_infinite] fill-[#f7b955]"
              style={{ transformOrigin: "center" }}
            />
            <circle cx={300} cy={132} r={3.5} className="fill-[#f7b955] opacity-55" />
            <circle cx={470} cy={92} r={3.5} className="fill-[#f7b955] opacity-55" />
          </svg>

          <div className="absolute inset-0">
            {trees.map((tree, i) => (
              <div
                key={`tree-${i}`}
                className="absolute bottom-[34px]"
                style={{ [tree.side]: `${tree.pct}%` }}
              >
                <span
                  className="absolute bottom-0 left-1/2 h-[22px] w-1 origin-bottom -translate-x-1/2 animate-[nc-trunk-flex_9s_ease-in-out_infinite] rounded-[3px] bg-[#263f30]"
                  style={{ animationDelay: tree.alt ? "-5.5s" : "0s" }}
                />
                <span
                  className="absolute left-1/2 top-0 size-[34px] origin-bottom -translate-x-1/2 animate-[nc-tree-sway_9s_ease-in-out_infinite] rounded-[52%_48%_46%_54%]"
                  style={{
                    backgroundColor: tree.alt ? "#3d6a4a" : "#315b43",
                    animationDelay: tree.alt ? "-5.5s" : "0s",
                  }}
                />
              </div>
            ))}
            {shrubs.map((shrub, i) => (
              <span
                key={`shrub-${i}`}
                className="absolute bottom-[30px] h-[14px] animate-[nc-shrub-breathe_8s_ease-in-out_infinite_alternate] rounded-[70%_70%_20%_20%] bg-[#2f513d]"
                style={{
                  [shrub.side]: `${shrub.pct}%`,
                  width: shrub.width,
                  animationDelay: `-${(i * 1.3).toFixed(1)}s`,
                }}
              />
            ))}
          </div>

          <div className="absolute inset-x-0 bottom-0 flex h-[190px] items-end justify-center gap-[5px]">
            {buildings.map((building, index) => (
              <div key={index} className="flex flex-col items-stretch">
                <div
                  className="grid animate-[nc-windows-cycle_46s_ease-in-out_infinite] grid-cols-3 gap-[3px] rounded-t-[4px] bg-[linear-gradient(180deg,#1a2740,#0d1626)] p-[6px] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
                  style={{ width: 34, height: building.height }}
                >
                  {building.windows.map((lit, i) => (
                    <div
                      key={i}
                      className={
                        lit
                          ? "size-[5px] animate-[nc-window-twinkle_6s_ease-in-out_infinite] rounded-[1px] bg-[#f7b955] shadow-[0_0_4px_1px_rgba(247,185,85,0.7)]"
                          : "size-[5px] rounded-[1px] bg-white/[0.06]"
                      }
                    />
                  ))}
                </div>
                {CITY_TREE_AFTER.includes(index) && (
                  <div className="relative mt-[3px] h-[32px] w-[20px]">
                    <span
                      className="absolute bottom-0 left-1/2 h-[10px] w-1 origin-bottom -translate-x-1/2 animate-[nc-trunk-flex_9s_ease-in-out_infinite] rounded-[3px] bg-[#263f30]"
                      style={{ animationDelay: `-${(index * 1.7).toFixed(1)}s` }}
                    />
                    <span
                      className="absolute left-1/2 top-0 size-[22px] origin-bottom -translate-x-1/2 animate-[nc-tree-sway_9s_ease-in-out_infinite] rounded-[52%_48%_46%_54%]"
                      style={{
                        backgroundColor: index % 2 === 1 ? "#3d6a4a" : "#315b43",
                        animationDelay: `-${(index * 1.7).toFixed(1)}s`,
                      }}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="absolute inset-x-0 bottom-0 h-[70px] bg-[linear-gradient(180deg,transparent_0%,rgba(4,7,14,0.88)_55%,#04070e_100%)]" />
        </div>

        <div className="absolute inset-0 bg-[linear-gradient(100deg,rgba(5,8,17,0.92)_0%,rgba(5,8,17,0.62)_42%,rgba(5,8,17,0.12)_78%)]" />
      </div>

      <div className="relative z-10 mx-auto max-w-[1180px] px-6 pb-20 pt-24">
        <div className="max-w-[640px]">
          <h1 className="max-w-[15ch] text-[clamp(2.4rem,6vw,4.2rem)] font-extrabold leading-[1.03] text-[#f3f5fb] [font-family:var(--font-nightfall-display)]">
            Your life is a game.
            <br />
            Time to start{" "}
            <em className="bg-[linear-gradient(90deg,#f7b955,#ffdca0)] bg-clip-text not-italic text-transparent">
              playing
            </em>
            .
          </h1>
          <p className="mt-5 max-w-[42ch] text-[1.08rem] leading-relaxed text-[#93a3c4]">
            Earn XP and coins for every journal entry, task and habit you complete. Spend them
            building a city that grows as you grow.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            {isMvp ? (
              <Link
                href="/login"
                className="rounded-xl bg-[linear-gradient(180deg,#ffc873,#f7b955)] px-6 py-3 font-bold text-[#1a1204] shadow-[0_8px_24px_rgba(247,185,85,0.25)]"
              >
                Start your quest &rarr;
              </Link>
            ) : (
              <button
                type="button"
                onClick={onWaitlistOpen}
                className="rounded-xl bg-[linear-gradient(180deg,#ffc873,#f7b955)] px-6 py-3 font-bold text-[#1a1204] shadow-[0_8px_24px_rgba(247,185,85,0.25)] hover:cursor-pointer"
              >
                Join the waitlist &rarr;
              </button>
            )}
            <a
              href="#how-it-works"
              className="rounded-xl border border-white/10 px-6 py-3 font-semibold text-[#f3f5fb]"
            >
              See how it works
            </a>
          </div>
          <p className="mt-10 text-xs uppercase tracking-wider text-[#93a3c4]">
            The skyline grows &mdash; and lights up &mdash; as you scroll through the page
          </p>
        </div>
      </div>
    </header>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { Reveal } from "./Reveal";
import { StepShot } from "./StepArt";
import { prefersReducedMotion } from "./useCountUp";

type Step = {
  title: string;
  body: string;
  image: string;
  alt: string;
};

const STEPS: Step[] = [
  {
    title: "Write",
    body: "Choose your template and answer the fields: Morning briefing, evening review, weekly review,... or create your own template with 14 different fields available.",
    image: "/images/how-write.png",
    alt: "The Morning Reflection entry: a mood picker, and a bar showing one of its four required fields answered.",
  },
  {
    title: "Finish",
    body: "Finish your entries, tasks, habits and earn xp for doing that. So you earn xp while also getting better in real life, isn't that amazing?!",
    image: "/images/how-earn.png",
    alt: "The confirmation after saving an entry, showing the XP it paid.",
  },
  {
    title: "Level up",
    body: "Achieve higher levels with your character, level up his skills and get motivated to stay consistent! You can also spend coins to customize your character.",
    image: "/images/how-levelup.png",
    alt: "The dashboard: level 10, 1,150 coins, a one-day streak, and 206 XP to level 11.",
  },
];

/** The trail's shape, in the track's own pixel coordinates. */
type Trail = { segments: string[]; width: number; height: number };

export default function HowItWorks() {
  const trackRef = useRef<HTMLDivElement>(null);
  const shotsRef = useRef<(HTMLDivElement | null)[]>([]);
  const drawnRef = useRef<(SVGPathElement | null)[]>([]);
  const [trail, setTrail] = useState<Trail | null>(null);

  // Where the trail runs. Measured rather than written by hand: it has to
  // land on the screenshots wherever the layout puts them, and they swap
  // sides, change width and change height between breakpoints.
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    const measure = () => {
      const shots = shotsRef.current.filter((el): el is HTMLDivElement => el !== null);
      if (shots.length < 2) return;

      // offsetLeft/offsetTop rather than getBoundingClientRect: Reveal holds
      // a translate on any row still below the fold, and this wants where the
      // layout put the screenshot, not where the fade currently has it.
      const anchors = shots.map((el) => ({
        x: el.offsetLeft + el.offsetWidth / 2,
        top: el.offsetTop,
        bottom: el.offsetTop + el.offsetHeight,
      }));

      // One column: every screenshot shares a centre line, and a trail between
      // them would have to cross the copy that sits in between. Nothing to draw.
      if (anchors.every((a) => Math.abs(a.x - anchors[0].x) < 1)) {
        setTrail(null);
        return;
      }

      const segments = anchors.slice(0, -1).map((from, index) => {
        const to = anchors[index + 1];
        // Vertical control points, so the trail leaves one screenshot and
        // arrives at the next going straight down, and does its travelling
        // across the page in between.
        const bend = Math.max((to.top - from.bottom) * 0.55, 28);
        return `M ${from.x} ${from.bottom} C ${from.x} ${from.bottom + bend}, ${to.x} ${to.top - bend}, ${to.x} ${to.top}`;
      });

      setTrail({ segments, width: track.offsetWidth, height: track.offsetHeight });
    };

    measure();
    if (typeof ResizeObserver === "undefined") return;
    // The track's height moves whenever a row reflows -- a breakpoint, the
    // display font landing, a zoom -- and that is every case the trail has to
    // be re-measured for.
    const observer = new ResizeObserver(measure);
    observer.observe(track);
    return () => observer.disconnect();
  }, []);

  // How much of it has been walked. Written straight to the nodes, the way
  // Reveal does it: no render depends on the scroll position.
  useEffect(() => {
    if (!trail) return;
    const paths = drawnRef.current.filter((el): el is SVGPathElement => el !== null);
    if (paths.length === 0) return;

    const lengths = paths.map((path) => path.getTotalLength());
    const total = lengths.reduce((sum, length) => sum + length, 0);
    if (total === 0) return;

    paths.forEach((path, index) => {
      path.style.strokeDasharray = `${lengths[index]}`;
      path.style.strokeDashoffset = `${lengths[index]}`;
      path.style.opacity = "1";
    });

    const draw = (progress: number) => {
      let walked = progress * total;
      paths.forEach((path, index) => {
        const shown = Math.min(Math.max(walked, 0), lengths[index]);
        walked -= lengths[index];
        path.style.strokeDashoffset = `${lengths[index] - shown}`;
      });
    };

    if (prefersReducedMotion()) {
      draw(1);
      return;
    }

    let frame = 0;
    const update = () => {
      frame = 0;
      const track = trackRef.current;
      if (!track) return;
      const rect = track.getBoundingClientRect();
      // The trail keeps pace with a line a little below the middle of the
      // screen: a step is joined up by the time the reader is looking at it.
      draw((window.innerHeight * 0.6 - rect.top) / rect.height);
    };

    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [trail]);

  return (
    <section id="how" className="px-5 py-16 sm:py-[5.75rem]">
      <div className="mx-auto flex max-w-[1040px] flex-col gap-16 sm:gap-24">
        <Reveal className="mx-auto max-w-[720px] text-center">
          <h2 className="[font-family:var(--font-nightfall-display)] text-[clamp(2.1rem,4.4vw,2.8rem)] font-extrabold leading-tight">
            How it works
          </h2>
        </Reveal>

        <div ref={trackRef} className="relative flex flex-col gap-16 sm:gap-24">
          {trail ? (
            <svg
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 h-full w-full"
              viewBox={`0 0 ${trail.width} ${trail.height}`}
              fill="none"
            >
              {/* The whole route, so the trail reads as a route rather than as
                  a line that stops wherever the reader stopped. */}
              {trail.segments.map((d, index) => (
                <path
                  key={`route-${index}`}
                  d={d}
                  stroke="#e4ddcf"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeDasharray="5 7"
                />
              ))}
              {/* And the part of it already walked. Hidden until the effect
                  has measured it, so it never flashes in fully drawn. */}
              {trail.segments.map((d, index) => (
                <path
                  key={`walked-${index}`}
                  ref={(el) => {
                    drawnRef.current[index] = el;
                  }}
                  d={d}
                  stroke="#d1870b"
                  strokeWidth={2}
                  strokeLinecap="round"
                  opacity={0}
                />
              ))}
            </svg>
          ) : null}

          {STEPS.map((step, index) => {
            const reversed = index % 2 === 1;
            return (
              <Reveal
                key={step.title}
                delay={60}
                className="grid items-center gap-8 md:grid-cols-2 md:gap-16"
              >
                <div className={`flex flex-col gap-3.5 ${reversed ? "md:order-2" : ""}`}>
                  <p className="text-[0.74rem] font-bold uppercase tracking-[0.12em] text-[#9a6200]">
                    Step {index + 1}
                  </p>
                  <h3 className="text-balance [font-family:var(--font-nightfall-display)] text-[clamp(1.35rem,2.6vw,1.75rem)] font-extrabold leading-tight">
                    {step.title}
                  </h3>
                  <p className="text-[#6f6b63]">{step.body}</p>
                </div>
                <div
                  ref={(el) => {
                    shotsRef.current[index] = el;
                  }}
                  className={reversed ? "md:order-1" : ""}
                >
                  <StepShot src={step.image} alt={step.alt} />
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}

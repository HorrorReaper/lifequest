"use client";

import { useEffect, useRef, useState } from "react";

export function prefersReducedMotion() {
  // matchMedia is missing in some rendering environments (jsdom without the
  // visual flag, older embedded webviews). Treating that as "no preference
  // expressed" keeps the page working rather than throwing on load.
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * Counts from the previous value to the next one when `value` changes.
 *
 * Starts at `value` rather than zero, so the number is already correct in the
 * first painted frame and only *changes* animate — a counter that ticks up
 * from nothing on load reads as a loading state, and would be wrong for the
 * fraction of a second before it finishes.
 *
 * Under prefers-reduced-motion it jumps straight to the new value.
 */
export function useCountUp(value: number, duration = 600) {
  const [display, setDisplay] = useState(value);
  const shownRef = useRef(value);

  useEffect(() => {
    const from = shownRef.current;
    if (from === value) return;

    // Reduced motion lands on the value in the first frame rather than
    // skipping the loop, so the write still happens in a callback instead of
    // synchronously inside this effect.
    const ms = prefersReducedMotion() ? 0 : duration;
    let frame = 0;
    const started = performance.now();

    const step = (now: number) => {
      const progress = ms === 0 ? 1 : Math.min((now - started) / ms, 1);
      // Ease out cubic: fast enough to feel like a reward, settled by the
      // time the eye gets back to it.
      const eased = 1 - Math.pow(1 - progress, 3);
      const next = Math.round(from + (value - from) * eased);

      shownRef.current = next;
      setDisplay(next);

      if (progress < 1) frame = requestAnimationFrame(step);
      else shownRef.current = value;
    };

    frame = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(frame);
      shownRef.current = value;
    };
  }, [value, duration]);

  return display;
}

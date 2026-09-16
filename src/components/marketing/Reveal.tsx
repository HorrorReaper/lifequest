"use client";

import { useEffect, useRef } from "react";
import { prefersReducedMotion } from "./useCountUp";

/**
 * A short rise-and-fade the first time something scrolls into view.
 *
 * Deliberately opt-in from JavaScript rather than the usual
 * `initial={{ opacity: 0 }}`: the server renders the finished state, so the
 * page reads completely in its first frame, with JavaScript broken, and for
 * a crawler. Only once this mounts does it hide anything, and only for
 * elements still below the fold — animating something the reader is already
 * looking at would be a flash, not a reveal.
 *
 * Written straight to the node rather than through state, because none of it
 * is state: no render depends on whether the fade has run, and nothing below
 * needs to re-render when it does.
 */
export function Reveal({
  children,
  delay = 0,
  className = "",
}: {
  children: React.ReactNode
  delay?: number
  className?: string
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (prefersReducedMotion()) return;
    if (typeof IntersectionObserver === "undefined") return;

    // Already on screen when we mounted: leave it exactly as rendered.
    if (node.getBoundingClientRect().top < window.innerHeight * 0.92) return;

    node.style.opacity = "0";
    node.style.transform = "translateY(10px)";
    node.style.transition = `opacity 350ms ease-out ${delay}ms, transform 350ms ease-out ${delay}ms`;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          node.style.opacity = "1";
          node.style.transform = "none";
          observer.disconnect();
        }
      },
      { rootMargin: "0px 0px -8% 0px" }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [delay]);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}

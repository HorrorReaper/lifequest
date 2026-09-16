"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

/**
 * The call to action, again, once the hero's own has scrolled away.
 *
 * Only appears after a real commitment to the page — roughly one screen and a
 * half — so it never covers the opening, and it hides again near the footer
 * where the closing CTA already sits.
 */
export function StickyCta({
  isMvp,
  onWaitlist,
}: {
  isMvp: boolean
  onWaitlist: () => void
}) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const update = () => {
      const past = window.scrollY > window.innerHeight * 1.4;
      const nearEnd =
        window.scrollY + window.innerHeight > document.body.scrollHeight - window.innerHeight * 0.9;
      setShow(past && !nearEnd);
    };

    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  const label = isMvp ? "Get started — it's free" : "Join the waitlist";
  const classes =
    "pointer-events-auto inline-flex items-center justify-center rounded-full bg-[#d1870b] px-6 py-3 text-[0.95rem] font-bold text-white shadow-lg shadow-[#1b1a17]/10 transition-colors hover:bg-[#9a6200]";

  return (
    <div
      aria-hidden={!show}
      className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-5 pb-[calc(env(safe-area-inset-bottom,0px)+1rem)]"
      style={{
        opacity: show ? 1 : 0,
        transform: show ? "none" : "translateY(12px)",
        transition: "opacity 220ms ease-out, transform 220ms ease-out",
        visibility: show ? "visible" : "hidden",
      }}
    >
      {/* Without this the pill floats over whatever line of text happens to be
          behind it. A short fade to the page's own ground separates the two
          without drawing a bar across the page. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-24 bg-gradient-to-t from-[#fdfcf9] via-[#fdfcf9]/85 to-transparent"
      />

      {isMvp ? (
        <Link href="/login" tabIndex={show ? 0 : -1} className={classes}>
          {label}
        </Link>
      ) : (
        <button
          type="button"
          onClick={onWaitlist}
          tabIndex={show ? 0 : -1}
          className={`${classes} cursor-pointer`}
        >
          {label}
        </button>
      )}
    </div>
  );
}

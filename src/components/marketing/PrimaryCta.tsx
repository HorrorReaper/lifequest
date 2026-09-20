"use client";

import Link from "next/link";

/**
 * The page's one call to action, in both of the states the build can be in:
 * a link to sign-up once the app is live, the waitlist dialog before that.
 * Defined at module scope so it is one component rather than a new one on
 * every render.
 */
export function PrimaryCta({
  isMvp,
  onWaitlist,
  className = "",
}: {
  isMvp: boolean
  onWaitlist: () => void
  className?: string
}) {
  const classes = `inline-flex items-center justify-center gap-2 rounded-xl bg-[#d1870b] px-6 py-3.5 text-base font-bold text-[#1b1a17] transition-colors hover:bg-[#c07b08] ${className}`;

  return isMvp ? (
    <Link href="/login" className={classes}>
      Get started — it&apos;s free
    </Link>
  ) : (
    <button type="button" onClick={onWaitlist} className={`${classes} cursor-pointer`}>
      Join the waitlist
    </button>
  );
}

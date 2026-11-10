"use client";

import Link from "next/link";
import { trackLandingCta, type LandingCta } from "@/lib/landing-tracker";

/**
 * The page's one call to action, in both of the states the build can be in:
 * a link to sign-up once the app is live, the waitlist dialog before that.
 * Defined at module scope so it is one component rather than a new one on
 * every render.
 *
 * `cta` names where on the page this copy sits; a click is counted under
 * that name in the landing-traffic view (docs/features/landing-traffic.md).
 */
export function PrimaryCta({
  isMvp,
  onWaitlist,
  cta,
  className = "",
}: {
  isMvp: boolean
  cta: LandingCta
  onWaitlist: () => void
  className?: string
}) {
  const classes = `inline-flex items-center justify-center gap-2 rounded-xl bg-[#d1870b] px-6 py-3.5 text-base font-bold text-[#1b1a17] transition-colors hover:bg-[#c07b08] ${className}`;

  return isMvp ? (
    <Link href="/login" onClick={() => trackLandingCta(cta)} className={classes}>
      Get started — it&apos;s free
    </Link>
  ) : (
    <button
      type="button"
      onClick={() => {
        trackLandingCta(cta);
        onWaitlist();
      }}
      className={`${classes} cursor-pointer`}
    >
      Join the waitlist
    </button>
  );
}

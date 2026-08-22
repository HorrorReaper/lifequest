import { Baloo_2, Manrope } from "next/font/google";

// Scoped to the marketing landing page only — applied via `.variable` on the
// page's root wrapper in page.tsx. Must never be applied to src/app/layout.tsx,
// which owns the app-wide Inter/font-sans setup for every other route.
export const nightfallDisplay = Baloo_2({
  subsets: ["latin"],
  weight: "800",
  variable: "--font-nightfall-display",
});

export const nightfallBody = Manrope({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-nightfall-body",
});

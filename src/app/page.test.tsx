import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import LandingPage from "./page";

// next/font/google requires network access to fetch font files, which isn't
// available (or desirable) under jsdom/vitest — stub it with the shape the
// rest of the app relies on (`.variable`).
vi.mock("next/font/google", () => ({
  Baloo_2: () => ({ variable: "--font-nightfall-display", className: "" }),
  Manrope: () => ({ variable: "--font-nightfall-body", className: "" }),
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    rpc: () => Promise.resolve({ data: null }),
  }),
}));

// jsdom has no IntersectionObserver, which framer-motion needs at mount time.
// The page itself no longer animates, but the waitlist dialog still does.
class MockIntersectionObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
// @ts-expect-error -- test stub, not a full IntersectionObserver implementation
global.IntersectionObserver = MockIntersectionObserver;

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});

function pricingSection() {
  const section = document.querySelector("#pricing") as HTMLElement | null;
  expect(section).toBeTruthy();
  return section as HTMLElement;
}

describe("LandingPage is_MVP branches", () => {
  it("sends every call to action to /login when NEXT_PUBLIC_IS_MVP is true", () => {
    vi.stubEnv("NEXT_PUBLIC_IS_MVP", "true");
    render(<LandingPage />);

    // The page repeats one CTA — nav, hero, pricing, closing. Asserting over
    // all of them rather than by section means moving a section around cannot
    // quietly leave one of them pointing nowhere.
    const ctas = screen.getAllByRole("link", { name: /get started/i });
    expect(ctas.length).toBeGreaterThanOrEqual(4);
    for (const cta of ctas) {
      expect(cta.getAttribute("href")).toBe("/login");
    }

    expect(
      within(pricingSection()).getByRole("link", { name: /get started/i })
    ).toBeTruthy();

    // Nothing may offer the waitlist once the app is reachable.
    expect(screen.queryByRole("button", { name: /join the waitlist/i })).toBeNull();
  });

  it("offers the waitlist as a real button when NEXT_PUBLIC_IS_MVP is false", () => {
    vi.stubEnv("NEXT_PUBLIC_IS_MVP", "false");
    render(<LandingPage />);

    const waitlistButtons = screen.getAllByRole("button", { name: /join the waitlist/i });
    expect(waitlistButtons.length).toBeGreaterThanOrEqual(4);
    for (const button of waitlistButtons) {
      expect(button.tagName).toBe("BUTTON");
      expect((button as HTMLButtonElement).disabled).toBe(false);
    }

    const pricingCta = within(pricingSection()).getByRole("button", {
      name: /join the waitlist/i,
    });
    expect(() => pricingCta.click()).not.toThrow();

    // No sign-up route exists yet, so nothing may link to one.
    expect(screen.queryByRole("link", { name: /get started/i })).toBeNull();
    expect(
      screen.queryAllByRole("link").filter((link) => link.getAttribute("href") === "/login")
    ).toHaveLength(0);
  });
});

describe("LandingPage hero and call to action", () => {
  it("opens on the streak, not on the game", () => {
    vi.stubEnv("NEXT_PUBLIC_IS_MVP", "true");
    render(<LandingPage />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(
      "Two minutes a night. A streak worth keeping."
    );
  });

  it("never sets white text on the amber call to action", () => {
    // White on #d1870b is 2.9:1, under the 4.5:1 WCAG AA needs for 16px
    // bold. Dark text on the same amber is 5.9:1. The CTA repeats across the
    // page, so this walks every copy rather than trusting one.
    vi.stubEnv("NEXT_PUBLIC_IS_MVP", "true");
    render(<LandingPage />);
    const ctas = screen.getAllByRole("link", { name: /get started/i });
    expect(ctas.length).toBeGreaterThanOrEqual(4);
    for (const cta of ctas) {
      expect(cta.className).toContain("bg-[#d1870b]");
      expect(cta.className).not.toContain("text-white");
    }
  });
});

describe("LandingPage promises only what ships", () => {
  it("never mentions a streak freeze", () => {
    // Freezes are spent in the entry pipeline but nothing ever grants one, so
    // the page must not sell them. This walks the whole rendered page, panels
    // and roadmap included, rather than one section that could be rewritten
    // while a mention survives elsewhere.
    vi.stubEnv("NEXT_PUBLIC_IS_MVP", "true");
    render(<LandingPage />);
    expect(document.body.textContent).not.toMatch(/freez|frozen|forgives/i);
  });
});

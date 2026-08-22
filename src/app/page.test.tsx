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

// jsdom has no IntersectionObserver, which framer-motion's `whileInView`
// (used throughout the page's sections) requires at mount time.
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

describe("LandingPage is_MVP branches", () => {
  it("links the Pricing Free tier CTA and the Final CTA to /login when NEXT_PUBLIC_IS_MVP is true", () => {
    vi.stubEnv("NEXT_PUBLIC_IS_MVP", "true");
    render(<LandingPage />);

    const pricingSection = document.querySelector("#pricing") as HTMLElement;
    expect(pricingSection).toBeTruthy();

    const freeTierLinks = within(pricingSection).getAllByRole("link", {
      name: /get started for free/i,
    });
    expect(freeTierLinks.length).toBeGreaterThan(0);
    for (const link of freeTierLinks) {
      expect(link.getAttribute("href")).toBe("/login");
    }

    const finalCtaLinks = screen.getAllByRole("link", { name: /start your quest/i });
    expect(finalCtaLinks.length).toBeGreaterThan(0);
    for (const link of finalCtaLinks) {
      expect(link.getAttribute("href")).toBe("/login");
    }
  });

  it("renders a clickable 'Join the waitlist' button (not a link) for the Pricing Free tier when NEXT_PUBLIC_IS_MVP is false", () => {
    vi.stubEnv("NEXT_PUBLIC_IS_MVP", "false");
    render(<LandingPage />);

    const pricingSection = document.querySelector("#pricing") as HTMLElement;
    expect(pricingSection).toBeTruthy();

    const waitlistButtons = within(pricingSection).getAllByRole("button", {
      name: /join the waitlist/i,
    });
    const freeTierButton = waitlistButtons.find(
      (btn) => !(btn as HTMLButtonElement).disabled
    ) as HTMLButtonElement | undefined;

    expect(freeTierButton).toBeTruthy();
    expect(freeTierButton?.tagName).toBe("BUTTON");
    expect(() => freeTierButton?.click()).not.toThrow();
  });
});

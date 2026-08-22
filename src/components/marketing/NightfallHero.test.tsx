import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NightfallHero } from "./NightfallHero";

afterEach(cleanup);

describe("NightfallHero", () => {
  it("renders identical markup across repeated renders (no non-deterministic content)", () => {
    const { container: first } = render(
      <NightfallHero isMvp={false} onWaitlistOpen={() => undefined} />
    );
    const firstHtml = first.innerHTML;
    cleanup();
    const { container: second } = render(
      <NightfallHero isMvp={false} onWaitlistOpen={() => undefined} />
    );
    expect(second.innerHTML).toBe(firstHtml);
  });

  it("links the primary CTA to /login when isMvp is true", () => {
    render(<NightfallHero isMvp onWaitlistOpen={() => undefined} />);
    const link = screen.getByRole("link", { name: /start your quest/i });
    expect(link.getAttribute("href")).toBe("/login");
  });

  it("calls onWaitlistOpen instead of linking to /login when isMvp is false", () => {
    const onWaitlistOpen = vi.fn();
    render(<NightfallHero isMvp={false} onWaitlistOpen={onWaitlistOpen} />);
    screen.getByRole("button", { name: /join the waitlist/i }).click();
    expect(onWaitlistOpen).toHaveBeenCalledTimes(1);
  });

  it("renders the subheading copy", () => {
    render(<NightfallHero isMvp={false} onWaitlistOpen={() => undefined} />);
    expect(
      screen.getByText(/earn xp and coins for every journal entry/i)
    ).toBeTruthy();
  });
});

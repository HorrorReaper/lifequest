import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import Navbar from "./Navbar";

afterEach(cleanup);

describe("Navbar", () => {
  it("links both CTAs to /login when is_MVP is true", () => {
    render(<Navbar is_MVP setWaitlistOpen={() => undefined} />);
    const links = screen.getAllByRole("link", { name: /log in|get started/i });
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) {
      expect(link.getAttribute("href")).toBe("/login");
    }
  });

  it("opens the waitlist instead of linking to /login when is_MVP is false", () => {
    const setWaitlistOpen = vi.fn();
    render(<Navbar is_MVP={false} setWaitlistOpen={setWaitlistOpen} />);
    screen.getByRole("button", { name: /join the waitlist/i }).click();
    expect(setWaitlistOpen).toHaveBeenCalledWith(true);
  });
});

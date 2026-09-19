import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { TypedHeading } from "@/components/marketing/TypedHeading";

afterEach(cleanup);

const TEXT = "Two minutes a night. A streak worth keeping.";

describe("TypedHeading", () => {
  it("renders the whole heading, not an empty one waiting to be filled", () => {
    // The original typed into an empty <h1> from state, so the server-rendered
    // HTML carried no headline at all. Everything here ships in the markup and
    // is only hidden until its turn.
    render(<TypedHeading text={TEXT} />);

    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading.textContent).toBe(TEXT);
  });

  it("keeps the heading one string for a screen reader", () => {
    render(<TypedHeading text={TEXT} />);

    // Split across a span per character, some readers announce it letter by
    // letter without this.
    expect(screen.getByRole("heading", { level: 1, name: TEXT })).toBeTruthy();
  });

  it("staggers each character, and leaves spaces to flow as text", () => {
    render(<TypedHeading text="ab c" />);

    const spans = screen
      .getByRole("heading", { level: 1 })
      .querySelectorAll<HTMLElement>("span");

    // Three glyphs, and the space is a text node rather than a fourth span, so
    // the line can still break there.
    expect(spans).toHaveLength(3);
    expect([...spans].map((span) => span.textContent)).toEqual(["a", "b", "c"]);
    expect(spans[0].style.animationDelay).toBe("0ms");
    expect(spans[1].style.animationDelay).toBe("35ms");
    // The space costs a step of its own, so "c" lands at 3 × 35.
    expect(spans[2].style.animationDelay).toBe("105ms");
  });

  it("waits a beat after a sentence ends", () => {
    render(<TypedHeading text="a. b" />);

    const spans = screen
      .getByRole("heading", { level: 1 })
      .querySelectorAll<HTMLElement>("span");

    // a at 0, the full stop at 35, then 35 + 260 for the pause, plus 35 for
    // the space, puts b at 365.
    expect(spans[2].textContent).toBe("b");
    expect(spans[2].style.animationDelay).toBe("365ms");
  });

  it("carries the caller's classes alongside its own hook", () => {
    render(<TypedHeading text="hi" className="text-balance" />);

    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading.className).toContain("lq-typed");
    expect(heading.className).toContain("text-balance");
  });
});

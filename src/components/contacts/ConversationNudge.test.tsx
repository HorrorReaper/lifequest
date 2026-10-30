import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ConversationNudge } from "./ConversationNudge";
import { CONVERSATION_NUDGES } from "@/lib/contacts/conversation-nudges";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("contact conversation nudge", () => {
  it("opens from Contacts, switches question pools and remembers the shown prompt when reopened", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const user = userEvent.setup();
    render(<ConversationNudge contactName="Anna" />);
    await user.click(
      screen.getByRole("button", { name: "Gesprächs-Nudge öffnen" }),
    );
    const dialog = screen.getByRole("dialog");
    expect(
      within(dialog).getByText("Eine Frage für dein Gespräch mit Anna."),
    ).toBeDefined();
    expect(within(dialog).getByRole("status").textContent).toContain(
      CONVERSATION_NUDGES.starter[0].question,
    );
    await user.click(
      within(dialog).getByRole("button", { name: "Tiefes Gespräch" }),
    );
    expect(
      within(dialog)
        .getByRole("button", { name: "Tiefes Gespräch" })
        .getAttribute("aria-pressed"),
    ).toBe("true");
    expect(within(dialog).getByRole("status").textContent).toContain(
      CONVERSATION_NUDGES.deep[0].question,
    );
    await user.click(
      within(dialog).getByRole("button", { name: "Andere Frage" }),
    );
    const question = within(dialog).getByRole("status").textContent;
    expect(question).toContain(CONVERSATION_NUDGES.deep[1].question);
    await user.keyboard("{Escape}");
    await user.click(
      screen.getByRole("button", { name: "Gesprächs-Nudge öffnen" }),
    );
    expect(screen.getByRole("status").textContent).toBe(question);
  });

  it("does not repeat a question until the pool is exhausted, including across switches", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const user = userEvent.setup();
    render(<ConversationNudge />);
    await user.click(
      screen.getByRole("button", { name: "Gesprächs-Nudge öffnen" }),
    );
    const shown = new Set<string>();
    for (let i = 0; i < CONVERSATION_NUDGES.starter.length; i++) {
      const text = screen.getByRole("status").textContent!;
      expect(shown.has(text)).toBe(false);
      shown.add(text);
      if (i === 0) {
        await user.click(
          screen.getByRole("button", { name: "Tiefes Gespräch" }),
        );
        await user.click(
          screen.getByRole("button", { name: "Gesprächseinstieg" }),
        );
      } else if (i < CONVERSATION_NUDGES.starter.length - 1) {
        await user.click(screen.getByRole("button", { name: "Andere Frage" }));
      }
    }
    const last = screen.getByRole("status").textContent;
    await user.click(screen.getByRole("button", { name: "Andere Frage" }));
    expect(screen.getByRole("status").textContent).not.toBe(last);
    expect(shown.size).toBe(CONVERSATION_NUDGES.starter.length);
  });
});

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ManagedTask } from "@/lib/tasks";
import { ContactTaskDialog } from "./ContactTaskDialog";
vi.mock("./ContactMultiSelect", () => ({
  ContactMultiSelect: () => <p>Participants selected</p>,
}));
afterEach(cleanup);
it("keeps a failed task draft open and retries with all existing contact assignments", async () => {
  const user = userEvent.setup(),
    onClose = vi.fn(),
    rpc = vi
      .fn()
      .mockResolvedValueOnce({
        data: null,
        error: { message: "Network unavailable" },
      })
      .mockResolvedValue({ data: "task", error: null });
  render(
    <ContactTaskDialog
      client={{ rpc } as unknown as SupabaseClient}
      contactIds={["anna", "ben"]}
      today="2026-10-04"
      task={
        {
          id: "task",
          title: "Old title",
          description: "",
          due_date: "2026-10-06",
          priority: "medium",
          updated_at: "stamp",
        } as ManagedTask
      }
      onClose={onClose}
      onSaved={vi.fn().mockResolvedValue(undefined)}
    />,
  );
  const title = screen.getByLabelText("Task");
  await user.clear(title);
  await user.type(title, "New title");
  await user.click(screen.getByRole("button", { name: /save changes/i }));
  await screen.findByText("Network unavailable");
  expect(onClose).not.toHaveBeenCalled();
  expect((title as HTMLInputElement).value).toBe("New title");
  await user.click(screen.getByRole("button", { name: "Retry save" }));
  await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
  expect(rpc.mock.calls[1][1].p_values.contact_ids).toEqual(["anna", "ben"]);
  expect(rpc.mock.calls[1][1].p_id).toBe("task");
});

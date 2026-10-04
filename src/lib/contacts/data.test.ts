import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  contactNoteHref,
  contactRpc,
  loadContactReminders,
  loadContacts,
  relationshipPerspective,
  saveContactRecord,
} from "./data";
import type { RelationshipType } from "./types";
describe("contact data boundaries", () => {
  it("preserves task identity and existing project metadata when editing contact assignments", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: "same-task", error: null });
    await saveContactRecord(
      { rpc } as unknown as SupabaseClient,
      "task",
      { title: "Call", contact_ids: ["anna", "ben"], due_date: "2026-10-04" },
      { id: "same-task", updated_at: "stamp" },
    );
    expect(rpc).toHaveBeenCalledWith("save_contact_record", {
      p_kind: "task",
      p_id: "same-task",
      p_expected_updated_at: "stamp",
      p_values: {
        title: "Call",
        contact_ids: ["anna", "ben"],
        due_date: "2026-10-04",
      },
    });
    expect(rpc.mock.calls[0][1].p_values).not.toHaveProperty("project_id");
  });
  it("does not turn a failed query into an empty contact list", async () => {
    const client = {
      rpc: vi
        .fn()
        .mockResolvedValue({ data: null, error: { message: "offline" } }),
    } as unknown as SupabaseClient;
    await expect(loadContacts(client, "2026-10-04")).rejects.toThrow("offline");
  });
  it("recognizes optimistic conflicts and supplies the profile timezone", async () => {
    const rpc = vi
      .fn()
      .mockResolvedValueOnce({
        data: null,
        error: { message: "CONTACT_CONFLICT" },
      })
      .mockResolvedValue({ data: { events: [] }, error: null });
    const client = { rpc } as unknown as SupabaseClient;
    await expect(contactRpc(client, "save_contact_record")).rejects.toThrow(
      "Eingaben bleiben erhalten",
    );
    await loadContactReminders(client, "2026-10-04", "Europe/Berlin");
    expect(rpc).toHaveBeenLastCalledWith("contact_reminders", {
      p_today: "2026-10-04",
      p_timezone: "Europe/Berlin",
    });
  });
  it("uses the inverse relationship label and returns Notes to the originating tab", () => {
    const relation = {
      source_id: "anna",
      target_id: "ben",
      source_name: "Anna",
      target_name: "Ben",
      type: {
        forward_label: "Elternteil von",
        reverse_label: "Kind von",
      } as RelationshipType,
    };
    expect(relationshipPerspective("ben", relation)).toEqual({
      id: "anna",
      name: "Anna",
      label: "Kind von",
    });
    const href = new URL(
      contactNoteHref("note", "anna"),
      "https://lifequest.test",
    );
    expect(href.searchParams.get("returnTo")).toBe(
      "/admin/contacts/anna?tab=history",
    );
  });
});

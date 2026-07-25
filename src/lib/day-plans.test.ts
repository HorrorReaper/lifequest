import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { upsertDayPlan } from "@/lib/day-plans";

function fakeClient(capture: (row: Record<string, unknown>) => void) {
  return {
    from: () => ({
      upsert: (row: Record<string, unknown>) => {
        capture(row);
        return {
          select: () => ({
            single: async () => ({
              data: {
                id: "plan-1",
                ...row,
                notes: null,
                entry_id: null,
                field_id: null,
                created_at: "2026-07-25T08:00:00.000Z",
              },
              error: null,
            }),
          }),
        };
      },
    }),
  } as unknown as SupabaseClient;
}

describe("upsertDayPlan", () => {
  it("does not clear planning metadata or journal links when optional values are omitted", async () => {
    let payload: Record<string, unknown> = {};
    const client = fakeClient((row) => {
      payload = row;
    });

    await upsertDayPlan(client, "user-1", {
      plan_date: "2026-07-25",
      blocks: [],
    });

    expect(payload).not.toHaveProperty("notes");
    expect(payload).not.toHaveProperty("entry_id");
    expect(payload).not.toHaveProperty("field_id");
  });

  it("allows callers to clear optional values explicitly", async () => {
    let payload: Record<string, unknown> = {};
    const client = fakeClient((row) => {
      payload = row;
    });

    await upsertDayPlan(client, "user-1", {
      plan_date: "2026-07-25",
      blocks: [],
      notes: null,
      entry_id: null,
      field_id: null,
    });

    expect(payload).toMatchObject({
      notes: null,
      entry_id: null,
      field_id: null,
    });
  });
});


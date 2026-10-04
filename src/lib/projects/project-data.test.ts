import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import {
  allProjectRows,
  createWorkspaceProject,
  loadBoard,
  listProjects,
} from "./project-data";
import { newProjectDraft } from "./project-workspace";

describe("project creation and reads", () => {
  it("persists every offered project field in the atomic creation RPC", async () => {
    const rpc = vi
      .fn()
      .mockResolvedValue({
        data: [{ created_project_id: "project" }],
        error: null,
      });
    const draft = {
      ...newProjectDraft(),
      name: " Project ",
      description: " Context ",
      outcome: " Outcome ",
      start_date: "2026-10-03",
      target_date: "2026-12-01",
      color: "#112233",
      area_id: "area",
      health: "at_risk" as const,
    };
    expect(
      await createWorkspaceProject({ rpc } as unknown as SupabaseClient, draft),
    ).toBe("project");
    expect(rpc).toHaveBeenCalledWith("create_project_with_home_note", {
      p_name: "Project",
      p_outcome: "Outcome",
      p_status: "planned",
      p_priority: "medium",
      p_description: "Context",
      p_health: "at_risk",
      p_start_date: "2026-10-03",
      p_target_date: "2026-12-01",
      p_color: "#112233",
      p_area_id: "area",
    });
  });
  it("reads more than 1000 resources without silently truncating", async () => {
    const source = Array.from({ length: 1205 }, (_, id) => ({ id }));
    const range = vi.fn(async (start: number, end: number) => ({
      data: source.slice(start, end + 1),
      error: null,
    }));
    expect(await allProjectRows({ range })).toEqual(source);
    expect(range).toHaveBeenCalledTimes(7);
  });
  it("rejects failed reads, failed creation and missing RPC results", async () => {
    await expect(
      allProjectRows({
        range: async () => ({ data: null, error: { message: "offline" } }),
      }),
    ).rejects.toThrow("offline");
    const client = {
      rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
    } as unknown as SupabaseClient;
    await expect(
      createWorkspaceProject(client, newProjectDraft()),
    ).rejects.toThrow("no result");
    await expect(loadBoard(client, "project")).rejects.toThrow(
      "could not be loaded",
    );
  });
  it("paginates server-computed summaries and separates archives from active projects", async () => {
    const builder = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      neq: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      or: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      range: vi.fn().mockResolvedValue({ data: [], count: 130, error: null }),
    };
    const client = { from: vi.fn(() => builder) } as unknown as SupabaseClient;
    expect(
      await listProjects(client, "owner", { area: "none", page: 2 }),
    ).toEqual({ projects: [], count: 130 });
    expect(builder.range).toHaveBeenCalledWith(100, 149);
    expect(builder.is).toHaveBeenCalledWith("area_id", null);
    expect(builder.neq).toHaveBeenCalledWith("status", "archived");
    await listProjects(client, "owner", { archived: true });
    expect(builder.eq).toHaveBeenCalledWith("status", "archived");
  });
});

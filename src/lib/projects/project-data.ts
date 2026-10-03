import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  BoardSnapshot,
  ProjectDraft,
  ProjectSummary,
} from "./project-workspace";

export const PROJECT_PAGE_SIZE = 50;
type PageQuery = {
  range: (
    start: number,
    end: number,
  ) => PromiseLike<{
    data: unknown[] | null;
    error: { message: string } | null;
  }>;
};
export async function allProjectRows<T>(query: PageQuery): Promise<T[]> {
  const rows: T[] = [];
  for (let offset = 0; ; offset += 200) {
    const { data, error } = await query.range(offset, offset + 199);
    if (error) throw new Error(error.message);
    const page = (data ?? []) as T[];
    rows.push(...page);
    if (page.length < 200) return rows;
  }
}
export function searchTerm(value: string) {
  return value
    .replace(/[%,_()\\]/g, " ")
    .trim()
    .slice(0, 120);
}
export async function listProjects(
  client: SupabaseClient,
  userId: string,
  options: {
    search?: string;
    area?: string;
    status?: string;
    archived?: boolean;
    page?: number;
  } = {},
) {
  let query = client
    .from("project_overview")
    .select("*", { count: "exact" })
    .eq("user_id", userId);
  query = options.archived
    ? query.eq("status", "archived")
    : query.neq("status", "archived");
  if (options.status && options.status !== "all")
    query = query.eq("status", options.status);
  if (options.area === "none") query = query.is("area_id", null);
  else if (options.area && options.area !== "all")
    query = query.eq("area_id", options.area);
  const term = searchTerm(options.search ?? "");
  if (term)
    query = query.or(
      `name.ilike.%${term}%,outcome.ilike.%${term}%,description.ilike.%${term}%`,
    );
  const start = (options.page ?? 0) * PROJECT_PAGE_SIZE;
  const { data, count, error } = await query
    .order("updated_at", { ascending: false })
    .order("id")
    .range(start, start + PROJECT_PAGE_SIZE - 1);
  if (error) throw new Error(error.message);
  return { projects: (data ?? []) as ProjectSummary[], count: count ?? 0 };
}
export async function loadBoard(
  client: SupabaseClient,
  projectId: string,
): Promise<BoardSnapshot> {
  const { data, error } = await client.rpc("get_project_board", {
    p_project_id: projectId,
  });
  if (error) throw new Error(error.message);
  if (!data || !Array.isArray(data.tasks))
    throw new Error("Project tasks could not be loaded.");
  return data as BoardSnapshot;
}
export async function createWorkspaceProject(
  client: SupabaseClient,
  draft: ProjectDraft,
): Promise<string> {
  const { data, error } = await client.rpc("create_project_with_home_note", {
    p_name: draft.name.trim(),
    p_outcome: draft.outcome.trim(),
    p_status: draft.status,
    p_priority: draft.priority,
    p_description: draft.description.trim(),
    p_health: draft.health,
    p_start_date: draft.start_date,
    p_target_date: draft.target_date,
    p_color: draft.color,
    p_area_id: draft.area_id,
  });
  if (error) throw new Error(error.message);
  const id = data?.[0]?.created_project_id;
  if (!id) throw new Error("Project creation returned no result.");
  return id;
}
export function announceProjectChange() {
  window.dispatchEvent(new Event("lifequest-data-updated"));
}

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, FolderKanban, LayoutGrid, List } from "lucide-react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  allProjectRows,
  createWorkspaceProject,
  listProjects,
} from "@/lib/projects/project-data";
import {
  PROJECT_STATUSES,
  type ProjectArea,
  type ProjectSummary,
} from "@/lib/projects/project-workspace";
import { ProjectEditorDialog } from "./ProjectEditorDialog";
import { WorkspaceFormDialog } from "./WorkspaceFormDialog";

export function ProjectsOverview({ userId }: { userId: string }) {
  const client = useMemo(() => createClient() as unknown as SupabaseClient, []);
  const router = useRouter();
  const [areas, setAreas] = useState<ProjectArea[]>([]);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [search, setSearch] = useState("");
  const [area, setArea] = useState("all");
  const [status, setStatus] = useState("all");
  const [archived, setArchived] = useState(false);
  const [page, setPage] = useState(0);
  const [count, setCount] = useState(0);
  const [view, setView] = useState<"cards" | "list">("cards");
  const [creating, setCreating] = useState(false);
  const [areaEditor, setAreaEditor] = useState<ProjectArea | "new" | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [areaError, setAreaError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const loadAreas = useCallback(async () => {
    setAreaError(null);
    const { error } = await client.rpc("ensure_project_areas");
    if (error) throw new Error(error.message);
    setAreas(
      await allProjectRows<ProjectArea>(
        client
          .from("project_areas")
          .select("*")
          .eq("user_id", userId)
          .order("name")
          .order("id"),
      ),
    );
  }, [client, userId]);
  useEffect(() => {
    queueMicrotask(
      () => void loadAreas().catch((error) => setAreaError(error.message)),
    );
  }, [loadAreas, retry]);
  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      setLoading(true);
      setError(null);
      void listProjects(client, userId, {
        search,
        area,
        status,
        archived,
        page,
      })
        .then((result) => {
          if (active) {
            setProjects(result.projects);
            setCount(result.count);
          }
        })
        .catch((error) => {
          if (active) setError(error.message);
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }, 180);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [client, userId, search, area, status, archived, page, retry]);
  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header className="flex flex-wrap items-center gap-3">
        <div className="mr-auto">
          <p className="text-sm text-muted-foreground">
            Your personal workspace
          </p>
          <h1 className="text-3xl font-semibold">Projects</h1>
          <p className="mt-2 text-muted-foreground">
            Private and professional projects, with everything in one place.
          </p>
        </div>
        <Button variant="outline" onClick={() => setAreaEditor("new")}>
          New area
        </Button>
        <Button onClick={() => setCreating(true)}>
          <Plus /> New project
        </Button>
      </header>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant={!archived ? "default" : "outline"}
          onClick={() => {
            setArchived(false);
            setStatus("all");
            setPage(0);
          }}
        >
          Projects
        </Button>
        <Button
          variant={archived ? "default" : "outline"}
          onClick={() => {
            setArchived(true);
            setStatus("all");
            setPage(0);
          }}
        >
          Archive
        </Button>
        <div className="ml-auto flex gap-1">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Card view"
            aria-pressed={view === "cards"}
            onClick={() => setView("cards")}
          >
            <LayoutGrid />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="List view"
            aria-pressed={view === "list"}
            onClick={() => setView("list")}
          >
            <List />
          </Button>
        </div>
      </div>
      <div className="grid gap-3 rounded-2xl border bg-card p-4 sm:grid-cols-[1fr_12rem_12rem]">
        <Input
          aria-label="Search projects"
          placeholder="Search projects…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(0);
          }}
        />
        <select
          aria-label="Area filter"
          className="h-11 rounded-lg border bg-background px-3 text-sm"
          value={area}
          onChange={(e) => {
            setArea(e.target.value);
            setPage(0);
          }}
        >
          <option value="all">All areas</option>
          <option value="none">Ohne Bereich</option>
          {areas.map((area) => (
            <option key={area.id} value={area.id}>
              {area.name}
            </option>
          ))}
        </select>
        <select
          aria-label="Status filter"
          className="h-11 rounded-lg border bg-background px-3 text-sm"
          value={status}
          disabled={archived}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(0);
          }}
        >
          <option value="all">All statuses</option>
          {PROJECT_STATUSES.filter((status) => status !== "archived").map(
            (status) => (
              <option key={status}>{status}</option>
            ),
          )}
        </select>
      </div>
      {area !== "all" && area !== "none" && (
        <Button
          size="sm"
          variant="ghost"
          onClick={() =>
            setAreaEditor(areas.find((item) => item.id === area) ?? null)
          }
        >
          Rename selected area
        </Button>
      )}
      {(error || areaError) && (
        <div
          role="alert"
          className="rounded-xl border border-destructive/30 p-4 text-destructive"
        >
          {error || areaError}
          <Button
            variant="outline"
            className="ml-3"
            onClick={() => setRetry((value) => value + 1)}
          >
            Retry
          </Button>
        </div>
      )}
      {loading ? (
        <p role="status">Loading projects…</p>
      ) : !projects.length && !error ? (
        <div className="rounded-2xl border border-dashed p-12 text-center">
          <FolderKanban className="mx-auto mb-3 size-8 text-muted-foreground" />
          <h2 className="text-lg font-medium">
            {search || area !== "all" || status !== "all"
              ? "No matching projects"
              : archived
                ? "No archived projects"
                : "Your first project starts here"}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {search || area !== "all" || status !== "all"
              ? "Try another search or filter."
              : "Create a project to collect tasks, notes and useful links."}
          </p>
        </div>
      ) : (
        <div
          className={
            view === "cards"
              ? "grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
              : "space-y-3"
          }
        >
          {projects.map((project) => {
            const percent = project.task_total
              ? Math.round((project.task_completed / project.task_total) * 100)
              : 0;
            return (
              <Link
                key={project.id}
                href={`/admin/work/projects/${project.id}`}
                className="block rounded-2xl border bg-card p-5 transition-colors hover:border-primary/50 focus-visible:ring-2 focus-visible:ring-primary"
              >
                <div className="flex items-center gap-2">
                  <span
                    className="size-3 shrink-0 rounded-full"
                    style={{ backgroundColor: project.color }}
                  />
                  <h2 className="min-w-0 flex-1 truncate text-lg font-semibold">
                    {project.name}
                  </h2>
                  <span className="text-xs text-muted-foreground">
                    {project.status}
                  </span>
                </div>
                <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                  {project.outcome ||
                    project.description ||
                    "Add an outcome to give this project direction."}
                </p>
                <div className="mt-4 flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <span>
                    {areas.find((area) => area.id === project.area_id)?.name ??
                      "Ohne Bereich"}
                  </span>
                  <span>· {project.priority}</span>
                  {project.target_date && <span>· {project.target_date}</span>}
                </div>
                <div className="mt-4 h-1.5 rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${percent}%` }}
                  />
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  {project.task_completed}/{project.task_total} tasks ·{" "}
                  {percent}%
                </p>
              </Link>
            );
          })}
        </div>
      )}
      {!loading && count > 50 && (
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            disabled={!page}
            onClick={() => setPage((value) => value - 1)}
          >
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            {page + 1} / {Math.ceil(count / 50)}
          </span>
          <Button
            variant="outline"
            disabled={(page + 1) * 50 >= count}
            onClick={() => setPage((value) => value + 1)}
          >
            Next
          </Button>
        </div>
      )}
      {creating && (
        <ProjectEditorDialog
          project={null}
          areas={areas}
          onClose={() => setCreating(false)}
          onSave={async (draft) => {
            const id = await createWorkspaceProject(client, draft);
            router.push(`/admin/work/projects/${id}`);
          }}
        />
      )}
      {areaEditor && (
        <WorkspaceFormDialog
          title={areaEditor === "new" ? "New area" : "Rename area"}
          initial={{ name: areaEditor === "new" ? "" : areaEditor.name }}
          fields={[
            { key: "name", label: "Area name", required: true, maxLength: 80 },
          ]}
          onClose={() => setAreaEditor(null)}
          onSave={async (values) => {
            const query =
              areaEditor === "new"
                ? client
                    .from("project_areas")
                    .insert({ user_id: userId, name: values.name.trim() })
                : client
                    .from("project_areas")
                    .update({ name: values.name.trim() })
                    .eq("id", areaEditor.id)
                    .eq("user_id", userId);
            const { error } = await query.select("id").single();
            if (error) throw new Error(error.message);
            await loadAreas();
          }}
        />
      )}
    </div>
  );
}

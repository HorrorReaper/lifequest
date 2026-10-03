"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ProjectMilestoneRow } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { allProjectRows, loadBoard } from "@/lib/projects/project-data";
import type {
  BoardSnapshot,
  ProjectArea,
  WorkspaceProject,
} from "@/lib/projects/project-workspace";
import { projectProgress } from "@/lib/projects/project-metrics";
import { ProjectEditorDialog } from "./ProjectEditorDialog";
import { ProjectTasks } from "./ProjectTasks";
import { ProjectResources } from "./ProjectResources";
import { ProjectMilestones } from "./ProjectMilestones";
import { ProjectConfirmDialog } from "./WorkspaceFormDialog";

const tabs = [
  { id: "overview", label: "Overview" },
  { id: "tasks", label: "Tasks" },
  { id: "notes", label: "Notes" },
  { id: "links", label: "Links" },
];
export function ProjectDetail({
  userId,
  initialProject,
}: {
  userId: string;
  initialProject: WorkspaceProject;
}) {
  const client = useMemo(() => createClient() as unknown as SupabaseClient, []);
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const tab = tabs.some((tab) => tab.id === params.get("tab"))
    ? params.get("tab")!
    : "tasks";
  const view = params.get("view") === "list" ? "list" : "board";
  const [project, setProject] = useState(initialProject);
  const [areas, setAreas] = useState<ProjectArea[]>([]);
  const [board, setBoard] = useState<BoardSnapshot>({
    version: initialProject.board_version,
    tasks: [],
  });
  const [milestones, setMilestones] = useState<ProjectMilestoneRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [archive, setArchive] = useState(false);
  const request = useRef(0);
  const reload = useCallback(async () => {
    const revision = ++request.current;
    setError(null);
    try {
      const [projectResult, nextBoard, nextAreas] = await Promise.all([
        client
          .from("projects")
          .select("*")
          .eq("user_id", userId)
          .eq("id", initialProject.id)
          .single(),
        loadBoard(client, initialProject.id),
        allProjectRows<ProjectArea>(
          client
            .from("project_areas")
            .select("*")
            .eq("user_id", userId)
            .order("name")
            .order("id"),
        ),
      ]);
      if (projectResult.error) throw new Error(projectResult.error.message);
      if (revision === request.current) {
        setProject(projectResult.data as WorkspaceProject);
        setBoard(nextBoard);
        setAreas(nextAreas);
        setLoaded(true);
      }
    } catch (error) {
      if (revision === request.current)
        setError(
          error instanceof Error
            ? error.message
            : "Project could not be loaded.",
        );
    } finally {
      if (revision === request.current) setLoading(false);
    }
  }, [client, userId, initialProject.id]);
  const loadMilestones = useCallback(async () => {
    try {
      setMilestones(
        await allProjectRows<ProjectMilestoneRow>(
          client
            .from("project_milestones")
            .select("*")
            .eq("user_id", userId)
            .eq("project_id", initialProject.id)
            .order("sort_order")
            .order("id"),
        ),
      );
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Milestones could not be loaded.",
      );
    }
  }, [client, userId, initialProject.id]);
  useEffect(() => {
    queueMicrotask(() => void reload());
  }, [reload]);
  useEffect(() => {
    if (tab === "overview") void loadMilestones();
  }, [tab, loadMilestones]);
  function navigate(nextTab: string, nextView = view) {
    const query = new URLSearchParams(params.toString());
    query.set("tab", nextTab);
    query.set("view", nextView);
    router.push(`${pathname}?${query}`, { scroll: false });
  }
  const progress = projectProgress(
    board.tasks.filter((task) => !task.parent_task_id),
  );
  return (
    <div className="mx-auto max-w-[100rem] space-y-5">
      <Link
        href="/admin/work/projects"
        className="text-sm text-muted-foreground hover:text-primary"
      >
        ← All projects
      </Link>
      <header className="flex flex-wrap items-start gap-3 rounded-2xl border bg-card p-5">
        <span
          className="mt-2 size-3 rounded-full"
          style={{ backgroundColor: project.color }}
        />
        <div className="min-w-0 flex-1">
          <h1 className="break-words text-2xl font-semibold">{project.name}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {areas.find((area) => area.id === project.area_id)?.name ??
              "Ohne Bereich"}{" "}
            · {project.status} · {project.priority}
            {project.target_date && ` · ${project.target_date}`}
          </p>
        </div>
        <Button variant="outline" disabled={!loaded} onClick={() => setEditing(true)}>
          Edit project
        </Button>
        <Button variant="ghost" disabled={!loaded} onClick={() => setArchive(true)}>
          {project.status === "archived" ? "Restore project" : "Archive"}
        </Button>
      </header>
      {error && (
        <div
          role="alert"
          className="rounded-xl border border-destructive/30 p-3 text-sm text-destructive"
        >
          {error}
          <Button
            variant="outline"
            className="ml-3"
            onClick={() => void reload()}
          >
            Reload
          </Button>
        </div>
      )}
      <nav aria-label="Project sections" className="flex gap-2 overflow-x-auto">
        {tabs.map((item) => (
          <Button
            key={item.id}
            variant={tab === item.id ? "default" : "outline"}
            aria-current={tab === item.id ? "page" : undefined}
            onClick={() => navigate(item.id)}
          >
            {item.label}
          </Button>
        ))}
      </nav>
      {loading || !loaded ? (
        <p role="status">{loading ? "Loading project…" : "Project data unavailable. Reload to try again."}</p>
      ) : tab === "tasks" ? (
        <ProjectTasks
          client={client}
          userId={userId}
          project={project}
          board={board}
          view={view}
          onView={(view) => navigate("tasks", view)}
          onBoard={setBoard}
          reload={reload}
        />
      ) : tab === "notes" || tab === "links" ? (
        <ProjectResources
          key={tab}
          client={client}
          userId={userId}
          projectId={project.id}
          tab={tab}
        />
      ) : (
        <div className="space-y-5">
          <section className="rounded-2xl border bg-card p-5">
            <h2 className="text-lg font-semibold">Goal / outcome</h2>
            <p className="mt-3 whitespace-pre-wrap text-muted-foreground">
              {project.outcome || "No outcome yet."}
            </p>
            {project.description && (
              <p className="mt-4 whitespace-pre-wrap text-sm">
                {project.description}
              </p>
            )}
            <dl className="mt-5 grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
              <div>
                <dt className="text-muted-foreground">Progress</dt>
                <dd>
                  {progress.completed}/{progress.total} · {progress.percent}%
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Health</dt>
                <dd>{project.health.replaceAll("_", " ")}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Start</dt>
                <dd>{project.start_date ?? "Open"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Target</dt>
                <dd>{project.target_date ?? "Open"}</dd>
              </div>
            </dl>
            <div className="mt-5 flex flex-wrap gap-2">
              <Button variant="outline" asChild>
                <Link href="/admin/work/plan?step=timeline">Plan my day</Link>
              </Button>
              {project.home_note_id && (
                <Button variant="outline" onClick={() => navigate("notes")}>
                  Project notes
                </Button>
              )}
            </div>
          </section>
          <ProjectMilestones
            client={client}
            userId={userId}
            projectId={project.id}
            milestones={milestones}
            reload={loadMilestones}
          />
        </div>
      )}
      {editing && (
        <ProjectEditorDialog
          project={project}
          areas={areas}
          onClose={() => setEditing(false)}
          onSave={async (draft) => {
            const { error } = await client
              .from("projects")
              .update(draft)
              .eq("id", project.id)
              .eq("user_id", userId)
              .eq("updated_at", project.updated_at)
              .select("id")
              .single();
            if (error)
              throw new Error(
                "Project could not be saved. It may have changed elsewhere; reload before retrying.",
              );
            await reload();
          }}
        />
      )}
      <ProjectConfirmDialog
        open={archive}
        title={
          project.status === "archived"
            ? "Restore this project?"
            : "Archive this project?"
        }
        description="Tasks, notes, links and milestones remain intact."
        onCancel={() => setArchive(false)}
        onConfirm={async () => {
          const { error } = await client
            .from("projects")
            .update({
              status:
                project.status === "archived"
                  ? (project.status_before_archive ?? "paused")
                  : "archived",
            })
            .eq("id", project.id)
            .eq("user_id", userId)
            .eq("updated_at", project.updated_at)
            .select("id")
            .single();
          if (error)
            throw new Error(
              "Project changed elsewhere; reload before retrying.",
            );
          await reload();
        }}
      />
    </div>
  );
}

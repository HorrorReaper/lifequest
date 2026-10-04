"use client";

import { useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ProjectMilestoneRow } from "@/lib/supabase/database.types";
import { Button } from "@/components/ui/button";
import {
  ProjectConfirmDialog,
  WorkspaceFormDialog,
} from "./WorkspaceFormDialog";

export function ProjectMilestones({
  client,
  userId,
  projectId,
  milestones,
  reload,
}: {
  client: SupabaseClient;
  userId: string;
  projectId: string;
  milestones: ProjectMilestoneRow[];
  reload: () => Promise<void>;
}) {
  const [editor, setEditor] = useState<ProjectMilestoneRow | "new" | null>(
    null,
  );
  const [remove, setRemove] = useState<ProjectMilestoneRow | null>(null);
  return (
    <section className="space-y-4 rounded-2xl border bg-card p-5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Milestones</h2>
        <Button variant="outline" onClick={() => setEditor("new")}>
          New milestone
        </Button>
      </div>
      {!milestones.length && (
        <p className="text-sm text-muted-foreground">
          Add a meaningful checkpoint for this project.
        </p>
      )}
      {milestones.map((milestone) => (
        <div
          key={milestone.id}
          className="flex flex-wrap items-center gap-2 rounded-xl bg-muted/40 p-3"
        >
          <div className="mr-auto">
            <p
              className={
                milestone.status === "completed"
                  ? "line-through text-muted-foreground"
                  : "font-medium"
              }
            >
              {milestone.title}
            </p>
            <p className="text-xs text-muted-foreground">
              {milestone.status}
              {milestone.target_date && ` · ${milestone.target_date}`}
            </p>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setEditor(milestone)}
          >
            Edit
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setRemove(milestone)}
          >
            Delete
          </Button>
        </div>
      ))}
      {editor && (
        <WorkspaceFormDialog
          title={editor === "new" ? "New milestone" : "Edit milestone"}
          initial={{
            title: editor === "new" ? "" : editor.title,
            target_date: editor === "new" ? "" : (editor.target_date ?? ""),
            status: editor === "new" ? "open" : editor.status,
          }}
          fields={[
            { key: "title", label: "Title", required: true, maxLength: 240 },
            { key: "target_date", label: "Target date", type: "date" },
            {
              key: "status",
              label: "Status",
              type: "select",
              options: ["open", "completed", "cancelled"].map((value) => ({
                value,
                label: value,
              })),
            },
          ]}
          onClose={() => setEditor(null)}
          onSave={async (values) => {
            const patch = {
              title: values.title.trim(),
              target_date: values.target_date || null,
              status: values.status,
              completed_at:
                values.status === "completed"
                  ? editor === "new"
                    ? new Date().toISOString()
                    : (editor.completed_at ?? new Date().toISOString())
                  : null,
              updated_at: new Date().toISOString(),
            };
            const query =
              editor === "new"
                ? client
                    .from("project_milestones")
                    .insert({
                      ...patch,
                      user_id: userId,
                      project_id: projectId,
                      sort_order: milestones.length,
                    })
                : client
                    .from("project_milestones")
                    .update(patch)
                    .eq("id", editor.id)
                    .eq("user_id", userId);
            const { error } = await query.select("id").single();
            if (error) throw new Error(error.message);
            await reload();
          }}
        />
      )}
      {remove && (
        <ProjectConfirmDialog
          open
          title="Delete this milestone?"
          description={`“${remove.title}” will be deleted. Tasks and notes remain intact.`}
          onCancel={() => setRemove(null)}
          onConfirm={async () => {
            const { error } = await client
              .from("project_milestones")
              .delete()
              .eq("id", remove.id)
              .eq("user_id", userId);
            if (error) throw new Error(error.message);
            await reload();
          }}
        />
      )}
    </section>
  );
}

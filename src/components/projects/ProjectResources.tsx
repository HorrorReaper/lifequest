"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { KnowledgeNoteRow } from "@/lib/supabase/database.types";
import { Button } from "@/components/ui/button";
import { allProjectRows, searchTerm } from "@/lib/projects/project-data";
import {
  normalizeLinkUrl,
  type ProjectLink,
} from "@/lib/projects/project-workspace";
import { ProjectPickerDialog } from "./ProjectPickerDialog";
import {
  ProjectConfirmDialog,
  WorkspaceFormDialog,
} from "./WorkspaceFormDialog";

export function ProjectResources({
  client,
  userId,
  projectId,
  tab,
}: {
  client: SupabaseClient;
  userId: string;
  projectId: string;
  tab: "notes" | "links";
}) {
  const [notes, setNotes] = useState<KnowledgeNoteRow[]>([]);
  const [links, setLinks] = useState<ProjectLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [picker, setPicker] = useState(false);
  const [editor, setEditor] = useState<ProjectLink | "link" | "note" | null>(
    null,
  );
  const [remove, setRemove] = useState<{ id: string; title: string } | null>(
    null,
  );
  const [sorting, setSorting] = useState(false);
  const returnHref = `/admin/work/projects/${projectId}?tab=notes`;
  const noteHref = (id: string) =>
    `/admin/notes?note=${encodeURIComponent(id)}&returnTo=${encodeURIComponent(returnHref)}`;
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (tab === "notes") {
        const rows = await allProjectRows<{
          knowledge_notes: KnowledgeNoteRow;
        }>(
          client
            .from("knowledge_note_projects")
            .select("knowledge_notes!inner(*)")
            .eq("user_id", userId)
            .eq("project_id", projectId)
            .order("note_id"),
        );
        setNotes(
          rows
            .map((row) => row.knowledge_notes)
            .sort((a, b) => b.updated_at.localeCompare(a.updated_at)),
        );
      } else
        setLinks(
          await allProjectRows<ProjectLink>(
            client
              .from("project_links")
              .select("*")
              .eq("user_id", userId)
              .eq("project_id", projectId)
              .order("sort_order")
              .order("id"),
          ),
        );
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Could not load resources.",
      );
    } finally {
      setLoading(false);
    }
  }, [client, userId, projectId, tab]);
  useEffect(() => {
    void load();
  }, [load]);
  const noteLoader = useCallback(
    async (search: string, page: number) => {
      let query = client
        .from("knowledge_notes")
        .select("id,title,is_archived", { count: "exact" })
        .eq("user_id", userId);
      const term = searchTerm(search);
      if (term) query = query.ilike("title", `%${term}%`);
      const { data, count, error } = await query
        .order("updated_at", { ascending: false })
        .order("id")
        .range(page * 50, page * 50 + 49);
      if (error) throw new Error(error.message);
      return {
        items: (data ?? []).map((note) => ({
          id: note.id,
          title: note.title,
          description: note.is_archived
            ? "Archived note"
            : notes.some((item) => item.id === note.id)
              ? "Already linked"
              : undefined,
        })),
        more: (page + 1) * 50 < (count ?? 0),
      };
    },
    [client, userId, notes],
  );
  async function reorder(index: number, direction: number) {
    if (sorting) return;
    const next = [...links];
    [next[index], next[index + direction]] = [
      next[index + direction],
      next[index],
    ];
    setSorting(true);
    setError(null);
    try {
      const { error } = await client.rpc("reorder_project_links", {
        p_project_id: projectId,
        p_ids: next.map((link) => link.id),
      });
      if (error) throw new Error(error.message);
      setLinks(next);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Could not reorder links.";
      await load();
      setError(message);
    } finally {
      setSorting(false);
    }
  }
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => setEditor(tab === "notes" ? "note" : "link")}>
          {tab === "notes" ? "New note" : "Add link"}
        </Button>
        {tab === "notes" && (
          <Button variant="outline" onClick={() => setPicker(true)}>
            Link existing note
          </Button>
        )}
      </div>
      {error && (
        <p
          role="alert"
          className="rounded-xl border border-destructive/30 p-3 text-sm text-destructive"
        >
          {error}{" "}
          <Button variant="outline" onClick={() => void load()}>
            Retry
          </Button>
        </p>
      )}
      {loading ? (
        <p role="status">Loading {tab}…</p>
      ) : tab === "notes" ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {!notes.length && !error && (
            <p className="p-8 text-sm text-muted-foreground">
              No linked notes yet. Link an existing note or start a new one.
            </p>
          )}
          {notes.map((note) => (
            <article key={note.id} className="rounded-xl border bg-card p-4">
              <Link
                href={noteHref(note.id)}
                className="font-semibold hover:text-primary"
              >
                {note.title}
              </Link>
              <p className="mt-2 line-clamp-3 whitespace-pre-wrap text-sm text-muted-foreground">
                {note.content || "Empty note"}
              </p>
              <div className="mt-4 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                <span>
                  {note.updated_at.slice(0, 10)}
                  {note.is_archived && " · Archived"}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setRemove(note)}
                >
                  Remove link
                </Button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {!links.length && !error && (
            <p className="p-8 text-sm text-muted-foreground">
              Save useful documents, tools and websites here.
            </p>
          )}
          {links.map((link, index) => (
            <article
              key={link.id}
              className="flex flex-wrap items-center gap-3 rounded-xl border bg-card p-4"
            >
              <div className="min-w-0 flex-1">
                <a
                  href={normalizeLinkUrl(link.url)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="break-words font-semibold hover:text-primary"
                >
                  {link.title}
                </a>
                <p className="mt-1 truncate text-xs text-muted-foreground">
                  {link.url}
                </p>
                {link.description && (
                  <p className="mt-2 text-sm text-muted-foreground">
                    {link.description}
                  </p>
                )}
              </div>
              <div className="flex flex-wrap gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={sorting || index === 0}
                  aria-label={`Move ${link.title} up`}
                  onClick={() => void reorder(index, -1)}
                >
                  ↑
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={sorting || index === links.length - 1}
                  aria-label={`Move ${link.title} down`}
                  onClick={() => void reorder(index, 1)}
                >
                  ↓
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setEditor(link)}
                >
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setRemove(link)}
                >
                  Remove
                </Button>
              </div>
            </article>
          ))}
        </div>
      )}
      {picker && (
        <ProjectPickerDialog
          title="Link an existing note"
          loadPage={noteLoader}
          onClose={() => setPicker(false)}
          onPick={async (item) => {
            const { error } = await client
              .from("knowledge_note_projects")
              .upsert(
                { user_id: userId, project_id: projectId, note_id: item.id },
                { onConflict: "note_id,project_id", ignoreDuplicates: true },
              );
            if (error) throw new Error(error.message);
            await load();
          }}
        />
      )}
      {editor === "note" && (
        <WorkspaceFormDialog
          title="New project note"
          initial={{ title: "" }}
          fields={[
            {
              key: "title",
              label: "Note title",
              required: true,
              maxLength: 160,
            },
          ]}
          onClose={() => setEditor(null)}
          onSave={async (values) => {
            const { data, error } = await client.rpc("create_project_note", {
              p_project_id: projectId,
              p_title: values.title.trim(),
            });
            if (error) throw new Error(error.message);
            window.location.assign(noteHref(data as string));
          }}
        />
      )}
      {editor && editor !== "note" && (
        <WorkspaceFormDialog
          title={editor === "link" ? "Add link" : "Edit link"}
          initial={{
            title: editor === "link" ? "" : editor.title,
            url: editor === "link" ? "" : editor.url,
            description: editor === "link" ? "" : editor.description,
          }}
          fields={[
            { key: "title", label: "Title", required: true, maxLength: 240 },
            {
              key: "url",
              label: "HTTP / HTTPS address",
              type: "url",
              required: true,
              maxLength: 4000,
            },
            {
              key: "description",
              label: "Description",
              type: "textarea",
              maxLength: 4000,
            },
          ]}
          onClose={() => setEditor(null)}
          onSave={async (values) => {
            const patch = {
              title: values.title.trim(),
              url: normalizeLinkUrl(values.url),
              description: values.description.trim(),
              updated_at: new Date().toISOString(),
            };
            const query =
              editor === "link"
                ? client
                    .from("project_links")
                    .insert({
                      ...patch,
                      user_id: userId,
                      project_id: projectId,
                      sort_order: links.length,
                    })
                : client
                    .from("project_links")
                    .update(patch)
                    .eq("id", editor.id)
                    .eq("user_id", userId);
            const { error } = await query.select("id").single();
            if (error) throw new Error(error.message);
            await load();
          }}
        />
      )}
      {remove && (
        <ProjectConfirmDialog
          open
          title={
            tab === "notes"
              ? "Remove this note from the project?"
              : "Remove this link?"
          }
          description={
            tab === "notes"
              ? "The note and all its other project links remain intact."
              : `“${remove.title}” will be removed from this project.`
          }
          onCancel={() => setRemove(null)}
          onConfirm={async () => {
            const query =
              tab === "notes"
                ? client
                    .from("knowledge_note_projects")
                    .delete()
                    .eq("project_id", projectId)
                    .eq("note_id", remove.id)
                : client.from("project_links").delete().eq("id", remove.id);
            const { error } = await query.eq("user_id", userId);
            if (error) throw new Error(error.message);
            await load();
          }}
        />
      )}
    </div>
  );
}

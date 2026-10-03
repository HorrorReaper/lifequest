"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export type PickerItem = { id: string; title: string; description?: string };
export function ProjectPickerDialog({
  title,
  loadPage,
  onPick,
  onClose,
}: {
  title: string;
  loadPage: (
    search: string,
    page: number,
  ) => Promise<{ items: PickerItem[]; more: boolean }>;
  onPick: (item: PickerItem) => Promise<void>;
  onClose: () => void;
}) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [items, setItems] = useState<PickerItem[]>([]);
  const [more, setMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const lock = useRef(false);
  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      setLoading(true);
      setError(null);
      void loadPage(search, page)
        .then((result) => {
          if (active) {
            setItems(result.items);
            setMore(result.more);
          }
        })
        .catch((error) => {
          if (active) {
            setItems([]);
            setMore(false);
            setError(error.message);
          }
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }, 180);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [loadPage, search, page, retry]);
  async function pick(item: PickerItem) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError(null);
    try {
      await onPick(item);
      onClose();
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Could not assign this item.",
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Search and select an existing item.
          </DialogDescription>
        </DialogHeader>
        <Input
          aria-label="Search existing items"
          placeholder="Search…"
          value={search}
          disabled={busy}
          onChange={(e) => {
            setLoading(true);
            setSearch(e.target.value);
            setPage(0);
          }}
        />
        {error && (
          <div role="alert" className="text-sm text-destructive">
            {error}{" "}
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setLoading(true); setRetry((value) => value + 1); }}
            >
              Retry
            </Button>
          </div>
        )}
        <div className="max-h-[45svh] space-y-2 overflow-y-auto">
          {loading ? (
            <p>Loading…</p>
          ) : !items.length && !error ? (
            <p className="text-muted-foreground">No matching items.</p>
          ) : (
            items.map((item) => (
              <button
                type="button"
                key={item.id}
                disabled={busy || loading}
                className="w-full rounded-xl border p-3 text-left hover:bg-muted disabled:opacity-50"
                onClick={() => void pick(item)}
              >
                <span className="block font-medium">{item.title}</span>
                {item.description && (
                  <span className="text-sm text-muted-foreground">
                    {item.description}
                  </span>
                )}
              </button>
            ))
          )}
        </div>
        <div className="flex justify-between">
          <Button
            variant="outline"
            disabled={!page || loading || busy}
            onClick={() => { setLoading(true); setPage((value) => value - 1); }}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            disabled={!more || loading || busy}
            onClick={() => { setLoading(true); setPage((value) => value + 1); }}
          >
            Next
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function useProjectPickerLoader(client: SupabaseClient, userId: string) {
  return useCallback(
    async (search: string, page: number) => {
      const { listProjects } = await import("@/lib/projects/project-data");
      const { projects, count } = await listProjects(client, userId, {
        search,
        page,
      });
      return {
        items: [
          {
            id: "",
            title: "No project",
            description: "Remove the project assignment",
          },
          ...projects.map((project) => ({
            id: project.id,
            title: project.name,
          })),
        ],
        more: (page + 1) * 50 < count,
      };
    },
    [client, userId],
  );
}

"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  contactHref,
  deleteContactRecord,
  loadContactMetadata,
  loadContacts,
} from "@/lib/contacts/data";
import type {
  ContactGroup,
  ContactList,
  RelationshipType,
} from "@/lib/contacts/types";
import { ContactFormDialog } from "./ContactFormDialog";
import { ContactsUpcoming } from "./ContactsUpcoming";
import { ProjectConfirmDialog } from "@/components/ui/workspace-form-dialog";

export function ContactsOverview({
  userId,
  today,
  timezone = "UTC",
}: {
  userId: string;
  today: string;
  timezone?: string;
}) {
  const client = useMemo(() => createClient() as unknown as SupabaseClient, []);
  const router = useRouter(),
    pathname = usePathname(),
    params = useSearchParams();
  const search = params.get("search") ?? "",
    group = params.get("group") ?? "",
    sort = params.get("sort") ?? "name",
    view = params.get("view") ?? "cards";
  const page = Math.max(0, Number(params.get("page")) || 0),
    favorites = params.get("favorites") === "true";
  const [data, setData] = useState<ContactList | null>(null),
    [groups, setGroups] = useState<ContactGroup[]>([]),
    [types, setTypes] = useState<RelationshipType[]>([]);
  const [error, setError] = useState<string | null>(null),
    [loading, setLoading] = useState(true),
    [ready, setReady] = useState(false);
  const [editor, setEditor] = useState<
      "contact" | "group" | ContactGroup | null
    >(null),
    [remove, setRemove] = useState<ContactGroup | null>(null),
    [managing, setManaging] = useState(false);
  const request = useRef(0);
  function navigate(key: string, value: string) {
    const query = new URLSearchParams(params.toString());
    if (value) query.set(key, value);
    else query.delete(key);
    if (key !== "page") query.delete("page");
    router.replace(`${pathname}?${query}`, { scroll: false });
  }
  const reload = useCallback(async () => {
    const revision = ++request.current;
    setLoading(true);
    setError(null);
    try {
      const [list, metadata] = await Promise.all([
        loadContacts(client, today, {
          search,
          group,
          sort,
          archived: view === "archive",
          favorites,
          page,
        }),
        loadContactMetadata(client, userId),
      ]);
      if (revision === request.current) {
        setData(list);
        setGroups(metadata.groups);
        setTypes(metadata.types);
        setReady(true);
      }
    } catch (error) {
      if (revision === request.current)
        setError(
          error instanceof Error
            ? error.message
            : "Kontakte konnten nicht geladen werden.",
        );
    } finally {
      if (revision === request.current) setLoading(false);
    }
  }, [client, today, userId, search, group, sort, view, favorites, page]);
  useEffect(() => {
    const revisions = request;
    const timer = setTimeout(() => void reload(), 150);
    return () => {
      clearTimeout(timer);
      revisions.current++;
    };
  }, [reload]);
  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold">Kontakte</h1>
          <p className="mt-1 text-muted-foreground">
            Menschen, Beziehungen und gemeinsame Geschichte.
          </p>
        </div>
        <Button disabled={!ready} onClick={() => setEditor("contact")}>
          Kontakt erstellen
        </Button>
      </header>
      {data && (
        <div className="grid grid-cols-3 gap-2">
          {[
            ["Anstehende Tage", data.upcoming, "view", "upcoming"],
            ["Fällige Wiedervorlagen", data.due_tasks, "view", "upcoming"],
            ["Favoriten", data.favorites, "favorites", "true"],
          ].map(([label, count, key, value]) => (
            <button
              key={label}
              className="rounded-xl border bg-card p-3 text-left"
              onClick={() => {
                if (key === "favorites") {
                  const query = new URLSearchParams(params.toString());
                  query.set("view", "cards");
                  query.set("favorites", "true");
                  query.delete("page");
                  router.replace(`${pathname}?${query}`, { scroll: false });
                } else navigate(String(key), String(value));
              }}
            >
              <span className="block text-xl font-semibold">{count}</span>
              <span className="text-xs text-muted-foreground">{label}</span>
            </button>
          ))}
        </div>
      )}
      <nav aria-label="Kontaktansichten" className="flex flex-wrap gap-2">
        {[
          ["cards", "Kontakte"],
          ["list", "Liste"],
          ["upcoming", "Anstehend"],
          ["archive", "Archiv"],
        ].map(([id, label]) => (
          <Button
            key={id}
            variant={view === id ? "default" : "outline"}
            onClick={() => navigate("view", id)}
          >
            {label}
          </Button>
        ))}
        <Button
          variant="ghost"
          disabled={!ready}
          onClick={() => setManaging(!managing)}
        >
          Gruppen verwalten
        </Button>
        <Button asChild variant="ghost">
          <Link href="/admin/work/calendar">Kalender</Link>
        </Button>
      </nav>
      {error && (
        <div role="alert" className="rounded-xl border p-3 text-destructive">
          {error}{" "}
          <Button variant="outline" onClick={() => void reload()}>
            Erneut laden
          </Button>
        </div>
      )}
      {managing && (
        <section className="rounded-xl border p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Gruppen</h2>
            <Button variant="outline" onClick={() => setEditor("group")}>
              Gruppe erstellen
            </Button>
          </div>
          {groups.map((item) => (
            <div key={item.id} className="flex items-center gap-2">
              <span className="mr-auto">{item.name}</span>
              <Button variant="ghost" onClick={() => setEditor(item)}>
                Bearbeiten
              </Button>
              <Button variant="ghost" onClick={() => setRemove(item)}>
                Löschen
              </Button>
            </div>
          ))}
        </section>
      )}
      {view === "upcoming" ? (
        <ContactsUpcoming today={today} timezone={timezone} />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <Input
              className="min-w-48 flex-1"
              aria-label="Kontakte suchen"
              placeholder="Name, Organisation oder Gruppe…"
              value={search}
              onChange={(e) => navigate("search", e.target.value)}
            />
            <select
              aria-label="Gruppe filtern"
              className="h-11 rounded-lg border bg-background px-3"
              value={group}
              onChange={(e) => navigate("group", e.target.value)}
            >
              <option value="">Alle Gruppen</option>
              {groups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </select>
            <select
              aria-label="Kontakte sortieren"
              className="h-11 rounded-lg border bg-background px-3"
              value={sort}
              onChange={(e) => navigate("sort", e.target.value)}
            >
              <option value="name">Name</option>
              <option value="last">Letzter Kontakt</option>
              <option value="next">Nächster Anlass</option>
            </select>
            <label className="flex gap-2 text-sm">
              <input
                type="checkbox"
                checked={favorites}
                onChange={(e) =>
                  navigate("favorites", e.target.checked ? "true" : "")
                }
              />
              Favoriten
            </label>
          </div>
          {loading ? (
            <p role="status">Kontakte werden geladen…</p>
          ) : (
            !error &&
            data && (
              <>
                <div
                  className={
                    view === "list"
                      ? "space-y-2"
                      : "grid gap-3 sm:grid-cols-2 xl:grid-cols-3"
                  }
                >
                  {data.contacts.map((person) => (
                    <Link
                      key={person.id}
                      href={contactHref(person.id)}
                      className="min-w-0 space-y-2 rounded-2xl border bg-card p-4 hover:border-primary"
                    >
                      <div className="flex items-center gap-3">
                        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary/10 font-semibold">
                          {person.display_name.slice(0, 2).toUpperCase()}
                        </span>
                        <div className="min-w-0">
                          <h2 className="break-words font-semibold">
                            {person.is_favorite && "★ "}
                            {person.display_name}
                          </h2>
                          <p className="text-sm text-muted-foreground">
                            {[person.organization, person.role]
                              .filter(Boolean)
                              .join(" · ")}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {person.groups.map((group) => (
                          <span
                            key={group.id}
                            className="rounded bg-muted px-2 text-xs"
                          >
                            {group.name}
                          </span>
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Letzter Kontakt:{" "}
                        {person.last_contact ?? "noch nicht erfasst"}
                        <br />
                        Nächster Anlass: {person.next_event_date ?? "keiner"}
                      </p>
                    </Link>
                  ))}
                </div>
                {!data.contacts.length && (
                  <p className="rounded-xl border p-8 text-center text-muted-foreground">
                    Keine passenden Kontakte.
                  </p>
                )}
                <div className="flex items-center justify-between gap-2">
                  <Button
                    variant="outline"
                    disabled={!page}
                    onClick={() => navigate("page", String(page - 1))}
                  >
                    Zurück
                  </Button>
                  <span className="text-sm">
                    {data.count} Kontakte · Seite {page + 1}
                  </span>
                  <Button
                    variant="outline"
                    disabled={(page + 1) * 50 >= data.count}
                    onClick={() => navigate("page", String(page + 1))}
                  >
                    Weiter
                  </Button>
                </div>
              </>
            )
          )}
        </>
      )}
      {editor && (
        <ContactFormDialog
          client={client}
          kind={typeof editor === "object" ? "group" : editor}
          record={typeof editor === "object" ? editor : null}
          today={today}
          groups={groups}
          types={types}
          onClose={() => setEditor(null)}
          onSaved={async (id) => {
            if (editor === "contact") router.push(contactHref(id));
            else await reload();
          }}
        />
      )}
      {remove && (
        <ProjectConfirmDialog
          open
          title="Gruppe löschen?"
          description={`„${remove.name}“ wird entfernt. Kontakte bleiben erhalten.`}
          onCancel={() => setRemove(null)}
          onConfirm={async () => {
            await deleteContactRecord(client, "group", remove);
            await reload();
          }}
        />
      )}
    </div>
  );
}

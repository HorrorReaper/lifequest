"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { ProjectConfirmDialog } from "@/components/ui/workspace-form-dialog";
import { ProjectPickerDialog } from "@/components/projects/ProjectPickerDialog";
import { searchTerm } from "@/lib/projects/project-data";
import { toggleTask } from "@/lib/tasks";
import {
  contactHref,
  contactNoteHref,
  contactRpc,
  deleteContactRecord,
  loadContactDetail,
  loadContactMetadata,
  relationshipPerspective,
  saveContactRecord,
} from "@/lib/contacts/data";
import type {
  Contact,
  ContactDetailData,
  ContactEntity,
  ContactGroup,
  RelationshipType,
} from "@/lib/contacts/types";
import { ContactFormDialog } from "./ContactFormDialog";
import { ContactTaskDialog } from "./ContactTaskDialog";

const tabs = [
  ["overview", "Überblick"],
  ["relationships", "Beziehungen"],
  ["history", "Verlauf & Notes"],
  ["dates", "Termine & Aufgaben"],
];
type RecordForForm = NonNullable<
  React.ComponentProps<typeof ContactFormDialog>["record"]
>;
export function ContactDetail({
  userId,
  contactId,
  today,
}: {
  userId: string;
  contactId: string;
  today: string;
}) {
  const client = useMemo(() => createClient() as unknown as SupabaseClient, []);
  const router = useRouter(),
    pathname = usePathname(),
    params = useSearchParams();
  const tab = tabs.some(([id]) => id === params.get("tab"))
    ? params.get("tab")!
    : "overview";
  const [data, setData] = useState<ContactDetailData | null>(null),
    [groups, setGroups] = useState<ContactGroup[]>([]),
    [types, setTypes] = useState<RelationshipType[]>([]);
  const [error, setError] = useState<string | null>(null),
    [loading, setLoading] = useState(true);
  const [editor, setEditor] = useState<{
    kind: ContactEntity;
    record?: RecordForForm;
  } | null>(null);
  const [confirmation, setConfirmation] = useState<{
    title: string;
    description: string;
    run: () => Promise<void>;
  } | null>(null);
  const [picker, setPicker] = useState<"note" | "task" | null>(null),
    [task, setTask] = useState<
      "new" | ContactDetailData["tasks"][number] | null
    >(null);
  const [historyPage, setHistoryPage] = useState(0),
    [taskPage, setTaskPage] = useState(0),
    [manageTypes, setManageTypes] = useState(false);
  const request = useRef(0),
    taskLock = useRef(false);
  const reload = useCallback(async () => {
    const revision = ++request.current;
    setLoading(true);
    setError(null);
    try {
      const [snapshot, metadata] = await Promise.all([
        loadContactDetail(client, contactId, today),
        loadContactMetadata(client, userId),
      ]);
      if (revision === request.current) {
        setData(snapshot);
        setGroups(metadata.groups);
        setTypes(metadata.types);
      }
    } catch (error) {
      if (revision === request.current)
        setError(
          error instanceof Error
            ? error.message
            : "Kontakt konnte nicht geladen werden.",
        );
    } finally {
      if (revision === request.current) setLoading(false);
    }
  }, [client, contactId, today, userId]);
  useEffect(() => {
    const revisions = request;
    queueMicrotask(() => void reload());
    return () => {
      revisions.current++;
    };
  }, [reload]);
  const resourceLoader = useCallback(
    async (search: string, page: number) => {
      const table = picker === "note" ? "knowledge_notes" : "tasks";
      let query = client
        .from(table)
        .select("id,title", { count: "exact" })
        .eq("user_id", userId);
      if (table === "tasks") query = query.is("parent_task_id", null);
      const term = searchTerm(search);
      if (term) query = query.ilike("title", `%${term}%`);
      const { data, count, error } = await query
        .order("updated_at", { ascending: false })
        .order("id")
        .range(page * 50, page * 50 + 49);
      if (error) throw new Error(error.message);
      return {
        items: (data ?? []).map((row) => ({ id: row.id, title: row.title })),
        more: (page + 1) * 50 < (count ?? 0),
      };
    },
    [client, userId, picker],
  );
  function navigate(next: string) {
    const query = new URLSearchParams(params.toString());
    query.set("tab", next);
    router.push(`${pathname}?${query}`, { scroll: false });
  }
  function remove(
    kind: ContactEntity,
    record: { id: string; updated_at: string },
    name: string,
  ) {
    setConfirmation({
      title: "Eintrag löschen?",
      description: `„${name}“ wird gelöscht. Bei gemeinsamen Anlässen oder Gesprächen betrifft das alle Beteiligten.`,
      run: async () => {
        await deleteContactRecord(client, kind, record);
        await reload();
      },
    });
  }
  function unlink(kind: "note" | "task", id: string) {
    setConfirmation({
      title: "Verknüpfung entfernen?",
      description:
        "Die Note bzw. Aufgabe und ihre anderen Verknüpfungen bleiben erhalten.",
      run: async () => {
        await contactRpc(client, "link_contact_resource", {
          p_contact_id: contactId,
          p_kind: kind,
          p_resource_id: id,
          p_remove: true,
        });
        await reload();
      },
    });
  }
  async function completeTask(id: string, done: boolean) {
    if (taskLock.current) return;
    taskLock.current = true;
    try {
      await toggleTask(client, id, done);
      await reload();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Aufgabe konnte nicht geändert werden.",
      );
    } finally {
      taskLock.current = false;
    }
  }
  function actions(kind: ContactEntity, record: RecordForForm, label: string) {
    return (
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() => setEditor({ kind, record })}
        >
          Bearbeiten
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => remove(kind, record, label)}
        >
          Löschen
        </Button>
      </div>
    );
  }
  function paging(
    page: number,
    count: number,
    setPage: (page: number) => void,
  ) {
    return (
      <div className="flex items-center justify-between gap-3">
        <Button
          variant="outline"
          disabled={!page}
          onClick={() => setPage(page - 1)}
        >
          Zurück
        </Button>
        <span className="text-sm">
          {count} Einträge · Seite {page + 1}
        </span>
        <Button
          variant="outline"
          disabled={(page + 1) * 50 >= count}
          onClick={() => setPage(page + 1)}
        >
          Weiter
        </Button>
      </div>
    );
  }
  const person = data?.contact;
  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <Link href="/admin/contacts" className="text-sm text-primary">
        ← Alle Kontakte
      </Link>
      <header className="flex flex-wrap gap-3 rounded-2xl border bg-card p-5">
        <div className="min-w-0 flex-1">
          <h1 className="break-words text-2xl font-semibold">
            {person
              ? `${person.is_favorite ? "★ " : ""}${person.display_name}`
              : "Kontakt"}
          </h1>
          <p className="mt-2 text-muted-foreground">
            {person &&
              [
                person.organization,
                person.role,
                person.is_archived ? "Archiviert" : "",
              ]
                .filter(Boolean)
                .join(" · ")}
          </p>
        </div>
        <Button
          variant="outline"
          disabled={!data || loading || !!error}
          onClick={() =>
            setEditor({
              kind: "contact",
              record: { ...person, group_ids: data!.group_ids } as Contact,
            })
          }
        >
          Kontakt bearbeiten
        </Button>
        <Button
          variant="ghost"
          disabled={!data || loading || !!error}
          onClick={() =>
            setConfirmation({
              title: person?.is_archived
                ? "Kontakt wiederherstellen?"
                : "Kontakt archivieren?",
              description:
                "Profil und Historie bleiben erhalten. Ausschließlich zugeordnete Anlässe werden im Archiv ausgeblendet.",
              run: async () => {
                await saveContactRecord(
                  client,
                  "contact",
                  { is_archived: !person!.is_archived },
                  person,
                );
                await reload();
              },
            })
          }
        >
          {person?.is_archived ? "Wiederherstellen" : "Archivieren"}
        </Button>
      </header>
      {error && (
        <div role="alert" className="rounded-xl border p-3 text-destructive">
          {error}{" "}
          <Button variant="outline" onClick={() => void reload()}>
            Erneut laden
          </Button>
        </div>
      )}
      <nav aria-label="Kontaktprofil" className="flex gap-2 overflow-x-auto">
        {tabs.map(([id, label]) => (
          <Button
            key={id}
            variant={tab === id ? "default" : "outline"}
            onClick={() => navigate(id)}
          >
            {label}
          </Button>
        ))}
      </nav>
      {loading ? (
        <p role="status">Kontakt wird geladen…</p>
      ) : (
        data &&
        !error && (
          <>
            {tab === "overview" && (
              <div className="grid gap-5 lg:grid-cols-2">
                <section className="space-y-4 rounded-2xl border bg-card p-5">
                  <h2 className="text-lg font-semibold">
                    Persönlicher Kontext
                  </h2>
                  <dl className="space-y-3">
                    {[
                      [
                        "Vollständiger Name",
                        [person!.first_name, person!.last_name]
                          .filter(Boolean)
                          .join(" "),
                      ],
                      ["Spitzname", person!.nickname],
                      ["Ort", person!.city],
                      ["Kennenlernen", person!.context],
                      ["Interessen", person!.interests],
                      ["Merkhilfe", person!.memo],
                      ["Kontaktkanal", person!.preferred_channel],
                      ["Letzter Kontakt", data.last_contact],
                      [
                        "Kontaktabstand",
                        person!.contact_interval_days
                          ? `${person!.contact_interval_days} Tage`
                          : null,
                      ],
                    ].map(([label, value]) => (
                      <div key={label}>
                        <dt className="text-sm text-muted-foreground">
                          {label}
                        </dt>
                        <dd className="whitespace-pre-wrap break-words">
                          {value || "Noch nicht erfasst"}
                        </dd>
                      </div>
                    ))}
                  </dl>
                  <div className="flex flex-wrap gap-2">
                    {groups
                      .filter((group) => data.group_ids.includes(group.id))
                      .map((group) => (
                        <span
                          key={group.id}
                          className="rounded-lg bg-muted px-3 py-1 text-sm"
                        >
                          {group.name}
                        </span>
                      ))}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button onClick={() => setEditor({ kind: "interaction" })}>
                      Kontakt festhalten
                    </Button>
                    <Button variant="outline" onClick={() => setTask("new")}>
                      Wiedervorlage erstellen
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setEditor({ kind: "event" })}
                    >
                      Besonderer Tag
                    </Button>
                  </div>
                </section>
                <section className="space-y-3 rounded-2xl border bg-card p-5">
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="text-lg font-semibold">Erreichbarkeit</h2>
                    <Button
                      variant="outline"
                      onClick={() => setEditor({ kind: "channel" })}
                    >
                      Hinzufügen
                    </Button>
                  </div>
                  {!data.channels.length && (
                    <p className="text-muted-foreground">
                      Noch keine Kontaktmöglichkeiten.
                    </p>
                  )}
                  {data.channels.map((channel) => (
                    <article
                      key={channel.id}
                      className="space-y-2 rounded-xl border p-3"
                    >
                      <p className="text-sm text-muted-foreground">
                        {channel.label || channel.kind}
                      </p>
                      {channel.kind === "link" ? (
                        <a
                          href={channel.value}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="break-all text-primary"
                        >
                          {channel.value}
                        </a>
                      ) : (
                        <p className="break-all">{channel.value}</p>
                      )}
                      {actions("channel", channel, channel.value)}
                    </article>
                  ))}
                  <Button
                    variant="ghost"
                    onClick={() =>
                      setConfirmation({
                        title: "Kontakt dauerhaft löschen?",
                        description: `${data.channels.length} Kontaktmöglichkeiten und ${data.relationships.length} Beziehungen werden entfernt. Die Person wird aus ${data.events.length} Anlässen und ${data.interactions.length} Gesprächen gelöst; gemeinsame Einträge bleiben bei anderen Personen erhalten. ${data.notes.length} Notes und ${data.tasks.length} Tasks bleiben gespeichert.`,
                        run: async () => {
                          await deleteContactRecord(
                            client,
                            "contact",
                            data.contact,
                          );
                          router.push("/admin/contacts");
                        },
                      })
                    }
                  >
                    Kontakt dauerhaft löschen
                  </Button>
                </section>
              </div>
            )}
            {tab === "relationships" && (
              <section className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => setEditor({ kind: "relationship" })}>
                    Beziehung hinzufügen
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setManageTypes(!manageTypes)}
                  >
                    Beziehungstypen verwalten
                  </Button>
                </div>
                {manageTypes && (
                  <div className="rounded-xl border p-4 space-y-3">
                    <Button
                      variant="outline"
                      onClick={() => setEditor({ kind: "type" })}
                    >
                      Neuer Beziehungstyp
                    </Button>
                    {types.map((type) => (
                      <div
                        key={type.id}
                        className="flex flex-wrap items-center gap-3"
                      >
                        <span className="mr-auto">
                          {type.forward_label} ↔ {type.reverse_label}
                        </span>
                        {actions("type", type, type.forward_label)}
                      </div>
                    ))}
                  </div>
                )}
                {!data.relationships.length && (
                  <p className="text-muted-foreground">
                    Noch keine Beziehungen.
                  </p>
                )}
                {data.relationships.map((relation) => {
                  const other = relationshipPerspective(contactId, relation);
                  return (
                    <article
                      key={relation.id}
                      className="space-y-3 rounded-xl border bg-card p-4"
                    >
                      <p>
                        Ist <strong>{other.label}</strong>{" "}
                        <Link
                          href={contactHref(other.id)}
                          className="text-primary"
                        >
                          {other.name}
                        </Link>
                        {relation.ended_on && (
                          <span className="text-muted-foreground">
                            {" "}
                            · beendet {relation.ended_on}
                          </span>
                        )}
                      </p>
                      {relation.started_on && (
                        <p className="text-sm text-muted-foreground">
                          Seit {relation.started_on}
                        </p>
                      )}
                      {relation.memo && (
                        <p className="whitespace-pre-wrap text-sm">
                          {relation.memo}
                        </p>
                      )}
                      {actions("relationship", relation, "Beziehung")}
                    </article>
                  );
                })}
              </section>
            )}
            {tab === "history" && (
              <div className="space-y-6">
                <section className="space-y-3">
                  <div className="flex items-center gap-3">
                    <h2 className="mr-auto text-lg font-semibold">
                      Kontaktverlauf
                    </h2>
                    <Button onClick={() => setEditor({ kind: "interaction" })}>
                      Kontakt festhalten
                    </Button>
                  </div>
                  {!data.interactions.length && (
                    <p className="text-muted-foreground">
                      Noch keine Gespräche erfasst.
                    </p>
                  )}
                  {data.interactions
                    .slice(historyPage * 50, historyPage * 50 + 50)
                    .map((interaction) => (
                      <article
                        key={interaction.id}
                        className="space-y-2 rounded-xl border bg-card p-4"
                      >
                        <p className="text-sm text-muted-foreground">
                          {interaction.contact_date} · {interaction.channel}
                        </p>
                        <p className="whitespace-pre-wrap">
                          {interaction.summary}
                        </p>
                        <div className="flex flex-wrap gap-3">
                          {interaction.members.map((person) => (
                            <Link
                              key={person.id}
                              href={contactHref(person.id)}
                              className="text-sm text-primary"
                            >
                              {person.name}
                            </Link>
                          ))}
                        </div>
                        {actions("interaction", interaction, "Gespräch")}
                      </article>
                    ))}
                  {data.interactions.length > 50 &&
                    paging(
                      historyPage,
                      data.interactions.length,
                      setHistoryPage,
                    )}
                </section>
                <section className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="mr-auto text-lg font-semibold">Notes</h2>
                    <Button variant="outline" onClick={() => setPicker("note")}>
                      Bestehende Note verknüpfen
                    </Button>
                    <Button onClick={() => setEditor({ kind: "note" })}>
                      Neue Note
                    </Button>
                  </div>
                  {!data.notes.length && (
                    <p className="text-muted-foreground">
                      Noch keine Notes verknüpft.
                    </p>
                  )}
                  {data.notes.map((note) => (
                    <article
                      key={note.id}
                      className="space-y-2 rounded-xl border p-4"
                    >
                      <Link
                        href={contactNoteHref(note.id, contactId)}
                        className="font-medium text-primary"
                      >
                        {note.title}
                      </Link>
                      <p className="text-sm text-muted-foreground">
                        {note.preview}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Geändert {note.updated_at.slice(0, 10)}
                      </p>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => unlink("note", note.id)}
                      >
                        Verknüpfung entfernen
                      </Button>
                    </article>
                  ))}
                </section>
              </div>
            )}
            {tab === "dates" && (
              <div className="space-y-6">
                <section className="space-y-3">
                  <div className="flex items-center gap-3">
                    <h2 className="mr-auto text-lg font-semibold">
                      Besondere Tage
                    </h2>
                    <Button onClick={() => setEditor({ kind: "event" })}>
                      Hinzufügen
                    </Button>
                  </div>
                  {!data.events.length && (
                    <p className="text-muted-foreground">
                      Noch keine besonderen Tage.
                    </p>
                  )}
                  {data.events.map((event) => (
                    <article
                      key={event.id}
                      className="space-y-2 rounded-xl border bg-card p-4"
                    >
                      <p className="font-semibold">{event.title}</p>
                      <p className="text-sm text-muted-foreground">
                        {event.day}.{event.month}.
                        {event.origin_year ?? " (Jahr unbekannt)"} ·{" "}
                        {event.recurrence === "annual"
                          ? "jährlich"
                          : "einmalig"}{" "}
                        ·{" "}
                        {event.show_in_calendar
                          ? "im Kalender"
                          : "Kalender ausgeblendet"}
                      </p>
                      {event.memo && (
                        <p className="whitespace-pre-wrap text-sm">
                          {event.memo}
                        </p>
                      )}
                      <div className="flex flex-wrap gap-3">
                        {event.members.map((person) => (
                          <Link
                            key={person.id}
                            href={contactHref(person.id, "dates")}
                            className="text-sm text-primary"
                          >
                            {person.name}
                          </Link>
                        ))}
                      </div>
                      {actions("event", event, event.title)}
                    </article>
                  ))}
                  <Button asChild variant="outline">
                    <Link href="/admin/contacts?view=upcoming">
                      Erinnerungen und nächste Termine
                    </Link>
                  </Button>
                </section>
                <section className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="mr-auto text-lg font-semibold">
                      Aufgaben & Wiedervorlagen
                    </h2>
                    <Button variant="outline" onClick={() => setPicker("task")}>
                      Bestehende Aufgabe zuordnen
                    </Button>
                    <Button onClick={() => setTask("new")}>Neue Aufgabe</Button>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Dieselben Aufgaben erscheinen in Tasks und im Daily Planner.
                    Erledigen erfasst keinen tatsächlichen Kontakt.
                  </p>
                  {!data.tasks.length && (
                    <p className="text-muted-foreground">
                      Noch keine Aufgaben verknüpft.
                    </p>
                  )}
                  {data.tasks
                    .slice(taskPage * 50, taskPage * 50 + 50)
                    .map((item) => (
                      <article
                        key={item.id}
                        className="space-y-2 rounded-xl border p-4"
                      >
                        <label className="flex gap-3">
                          <input
                            type="checkbox"
                            checked={item.is_completed}
                            onChange={(e) =>
                              void completeTask(item.id, e.target.checked)
                            }
                          />
                          <span
                            className={
                              item.is_completed
                                ? "line-through text-muted-foreground"
                                : ""
                            }
                          >
                            {item.title}
                          </span>
                        </label>
                        <p className="text-sm text-muted-foreground">
                          {item.due_date ?? "Kein Termin"} · {item.priority}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setTask(item)}
                          >
                            Bearbeiten
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => unlink("task", item.id)}
                          >
                            Verknüpfung entfernen
                          </Button>
                        </div>
                      </article>
                    ))}
                  {data.tasks.length > 50 &&
                    paging(taskPage, data.tasks.length, setTaskPage)}
                  <Button asChild variant="outline">
                    <Link href="/admin/work/plan">Im Tagesplan einplanen</Link>
                  </Button>
                </section>
              </div>
            )}
          </>
        )
      )}
      {editor && (
        <ContactFormDialog
          client={client}
          kind={editor.kind}
          record={editor.record}
          contactId={contactId}
          today={today}
          groups={groups}
          types={types}
          onClose={() => setEditor(null)}
          onSaved={async (id) => {
            if (editor.kind === "note")
              window.location.assign(contactNoteHref(id, contactId));
            else await reload();
          }}
        />
      )}
      {task && (
        <ContactTaskDialog
          client={client}
          today={today}
          contactIds={task === "new" ? [contactId] : task.contact_ids}
          task={task === "new" ? undefined : task}
          onClose={() => setTask(null)}
          onSaved={reload}
        />
      )}
      {picker && (
        <ProjectPickerDialog
          title={picker === "note" ? "Note verknüpfen" : "Aufgabe zuordnen"}
          loadPage={resourceLoader}
          onClose={() => setPicker(null)}
          onPick={async (item) => {
            await contactRpc(client, "link_contact_resource", {
              p_contact_id: contactId,
              p_kind: picker,
              p_resource_id: item.id,
            });
            await reload();
          }}
        />
      )}
      {confirmation && (
        <ProjectConfirmDialog
          open
          title={confirmation.title}
          description={confirmation.description}
          onCancel={() => setConfirmation(null)}
          onConfirm={confirmation.run}
        />
      )}
    </div>
  );
}

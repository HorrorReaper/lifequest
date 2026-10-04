"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { addDays } from "@/lib/dates";
import { Button } from "@/components/ui/button";
import { WorkspaceFormDialog } from "@/components/ui/workspace-form-dialog";
import {
  contactHref,
  contactRpc,
  loadContactOccurrences,
  loadContactReminders,
} from "@/lib/contacts/data";
import type { ContactOccurrence, ContactReminders } from "@/lib/contacts/types";
import { ContactTaskDialog } from "./ContactTaskDialog";

export function ContactsUpcoming({
  today,
  timezone = "UTC",
}: {
  today: string;
  timezone?: string;
}) {
  const client = useMemo(() => createClient() as unknown as SupabaseClient, []);
  const [data, setData] = useState<ContactReminders | null>(null);
  const [upcoming, setUpcoming] = useState<ContactOccurrence[]>([]);
  const [days, setDays] = useState(30);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [task, setTask] = useState<ContactOccurrence | null>(null);
  const [snooze, setSnooze] = useState<ContactOccurrence | null>(null);
  const [busy, setBusy] = useState(false);
  const request = useRef(0),
    lock = useRef(false);
  const reload = useCallback(async () => {
    const revision = ++request.current;
    setLoading(true);
    setError(null);
    try {
      const [reminders, occurrences] = await Promise.all([
        loadContactReminders(client, today, timezone),
        loadContactOccurrences(client, today, addDays(today, days)),
      ]);
      if (revision === request.current) {
        setData(reminders);
        setUpcoming(occurrences);
      }
    } catch (error) {
      if (revision === request.current)
        setError(
          error instanceof Error
            ? error.message
            : "Hinweise konnten nicht geladen werden.",
        );
    } finally {
      if (revision === request.current) setLoading(false);
    }
  }, [client, today, days, timezone]);
  useEffect(() => {
    const revisions = request;
    queueMicrotask(() => void reload());
    return () => {
      revisions.current++;
    };
  }, [reload]);
  async function acknowledge(event: ContactOccurrence, done: boolean) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError(null);
    try {
      await contactRpc(client, "set_contact_occurrence", {
        p_event_id: event.id,
        p_date: event.occurrence_date,
        p_done: done,
      });
      await reload();
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Änderung fehlgeschlagen.",
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  function entry(event: ContactOccurrence, reminder = false) {
    return (
      <article
        key={`${event.id}:${event.occurrence_date}`}
        className="rounded-xl border bg-card p-4 space-y-2"
      >
        <p className="font-medium">
          {event.title}{" "}
          <span className="font-normal text-muted-foreground">
            · {event.occurrence_date}
          </span>
        </p>
        {event.origin_year !== null &&
          (event.kind === "birthday" || event.kind === "anniversary") && (
            <p className="text-sm text-muted-foreground">
              {Number(event.occurrence_date.slice(0, 4)) - event.origin_year}{" "}
              Jahre
            </p>
          )}
        <div className="flex flex-wrap gap-3">
          {event.members.map((person) => (
            <Link
              key={person.id}
              className="text-sm text-primary hover:underline"
              href={contactHref(person.id, "dates")}
            >
              {person.name}
            </Link>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {reminder && (
            <>
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => void acknowledge(event, true)}
              >
                Für diesen Anlass erledigt
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={busy}
                onClick={() => setSnooze(event)}
              >
                Später erinnern
              </Button>
            </>
          )}
          {event.is_done && (
            <Button
              size="sm"
              variant="ghost"
              disabled={busy}
              onClick={() => void acknowledge(event, false)}
            >
              Erinnerung wieder öffnen
            </Button>
          )}
          {event.task_id ? (
            <Button asChild size="sm" variant="outline">
              <Link href="/admin/work/tasks">Aufgabe vorhanden</Link>
            </Button>
          ) : (
            <Button size="sm" variant="outline" onClick={() => setTask(event)}>
              Vorbereitung planen
            </Button>
          )}
          <Link
            className="self-center text-sm text-primary"
            href={`/admin/work/calendar?date=${event.occurrence_date}&view=month`}
          >
            Im Kalender
          </Link>
        </div>
      </article>
    );
  }
  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">
        Hinweise erscheinen beim Öffnen von LifeQuest. Ein Anlass bleibt nach
        dem Erledigen im Kalender.
      </p>
      {error && (
        <div role="alert" className="rounded-xl border p-3 text-destructive">
          {error}{" "}
          <Button variant="outline" onClick={() => void reload()}>
            Erneut laden
          </Button>
        </div>
      )}
      {loading ? (
        <p role="status">Hinweise werden geladen…</p>
      ) : (
        data && (
          <>
            <section className="space-y-3">
              <h2 className="text-lg font-semibold">Jetzt erinnern</h2>
              {!data.events.length && (
                <p className="text-sm text-muted-foreground">
                  Keine fälligen Anlass-Erinnerungen.
                </p>
              )}
              {data.events.map((event) => entry(event, true))}
            </section>
            <section className="space-y-3">
              <h2 className="text-lg font-semibold">Fällige Wiedervorlagen</h2>
              {!data.tasks.length && (
                <p className="text-sm text-muted-foreground">
                  Keine fälligen Aufgaben.
                </p>
              )}
              {data.tasks.map((task) => (
                <article key={task.id} className="rounded-xl border p-3">
                  <Link
                    href="/admin/work/tasks"
                    className="font-medium text-primary"
                  >
                    {task.title} · {task.due_date}
                  </Link>
                  <div className="flex flex-wrap gap-3">
                    {task.contacts.map((person) => (
                      <Link
                        key={person.id}
                        className="text-sm"
                        href={contactHref(person.id, "dates")}
                      >
                        {person.name}
                      </Link>
                    ))}
                  </div>
                </article>
              ))}
            </section>
            <section className="space-y-3">
              <h2 className="text-lg font-semibold">Wieder melden</h2>
              {!data.catchups.length && (
                <p className="text-sm text-muted-foreground">
                  Kein Kontaktabstand überschritten.
                </p>
              )}
              {data.catchups.map((person) => (
                <Link
                  key={person.id}
                  href={contactHref(person.id)}
                  className="block rounded-xl border p-3"
                >
                  {person.display_name} · letzter Kontakt{" "}
                  {person.last_contact ?? "noch nicht erfasst"}
                </Link>
              ))}
            </section>
            <section className="space-y-3">
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-semibold">Anstehende Tage</h2>
                <select
                  aria-label="Vorschauzeitraum"
                  className="rounded border bg-background p-2"
                  value={days}
                  onChange={(e) => setDays(Number(e.target.value))}
                >
                  <option value="7">7 Tage</option>
                  <option value="30">30 Tage</option>
                </select>
              </div>
              {!upcoming.length && (
                <p className="text-sm text-muted-foreground">
                  Keine besonderen Tage im Zeitraum.
                </p>
              )}
              {upcoming.map((event) => entry(event))}
            </section>
          </>
        )
      )}
      {task && (
        <ContactTaskDialog
          client={client}
          today={today}
          contactIds={task.members.map((person) => person.id)}
          occurrence={task}
          onClose={() => setTask(null)}
          onSaved={reload}
        />
      )}
      {snooze && (
        <WorkspaceFormDialog
          title="Später erinnern"
          initial={{ date: addDays(today, 1) }}
          fields={[
            { key: "date", label: "Erinnern ab", type: "date", required: true },
          ]}
          onClose={() => setSnooze(null)}
          onSave={async (values) => {
            if (
              values.date <= today ||
              values.date > addDays(snooze.occurrence_date, 30)
            )
              throw new Error(
                "Bitte einen zukünftigen Tag spätestens 30 Tage nach dem Anlass wählen.",
              );
            await contactRpc(client, "set_contact_occurrence", {
              p_event_id: snooze.id,
              p_date: snooze.occurrence_date,
              p_done: false,
              p_snoozed_until: values.date,
            });
            await reload();
          }}
        />
      )}
    </div>
  );
}

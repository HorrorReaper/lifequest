"use client";
import { useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  TaskEditorDialog,
  type TaskEditorDraft,
} from "@/components/tasks/TaskEditorDialog";
import type { ManagedTask } from "@/lib/tasks";
import type { ContactOccurrence } from "@/lib/contacts/types";
import { contactRpc, saveContactRecord } from "@/lib/contacts/data";
import { ContactMultiSelect } from "./ContactMultiSelect";

export function ContactTaskDialog({
  client,
  contactIds,
  today,
  task,
  occurrence,
  onClose,
  onSaved,
}: {
  client: SupabaseClient;
  contactIds: string[];
  today: string;
  task?: ManagedTask;
  occurrence?: ContactOccurrence;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lock = useRef(false);
  const [participants, setParticipants] = useState(contactIds.join(","));
  async function save(draft: TaskEditorDraft) {
    if (lock.current) return;
    lock.current = true;
    setSaving(true);
    setError(null);
    try {
      if (!participants)
        throw new Error("Bitte mindestens eine Person auswählen.");
      if (occurrence)
        await contactRpc(client, "create_contact_occurrence_task", {
          p_event_id: occurrence.id,
          p_date: occurrence.occurrence_date,
          p_draft: draft,
        });
      else
        await saveContactRecord(
          client,
          "task",
          { ...draft, contact_ids: participants.split(",") },
          task,
        );
      await onSaved();
      onClose();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Aufgabe konnte nicht gespeichert werden.",
      );
    } finally {
      lock.current = false;
      setSaving(false);
    }
  }
  return (
    <TaskEditorDialog
      open
      task={task ?? null}
      saving={saving}
      error={error}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      onSubmit={save}
      defaults={{
        title: occurrence ? `Vorbereiten: ${occurrence.title}` : "",
        due_date: occurrence?.occurrence_date ?? today,
      }}
      contactFields={
        occurrence ? undefined : (
          <div className="space-y-2">
            <p className="text-sm font-medium">Zugeordnete Kontakte</p>
            <ContactMultiSelect
              value={participants}
              onChange={setParticipants}
              disabled={saving}
              today={today}
            />
          </div>
        )
      }
      contactDirty={participants !== contactIds.join(",")}
    />
  );
}

"use client";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  WorkspaceFormDialog,
  type WorkspaceField,
} from "@/components/ui/workspace-form-dialog";
import { saveContactRecord } from "@/lib/contacts/data";
import { normalizeLinkUrl } from "@/lib/projects/project-workspace";
import type {
  Contact,
  ContactChannel,
  ContactEntity,
  ContactEvent,
  ContactGroup,
  ContactInteraction,
  ContactRelationship,
  RelationshipType,
} from "@/lib/contacts/types";
import { ContactMultiSelect } from "./ContactMultiSelect";
import { ContactDuplicateHint } from "./ContactDuplicateHint";

type EditableRecord =
  | Contact
  | ContactChannel
  | ContactGroup
  | RelationshipType
  | ContactRelationship
  | ContactEvent
  | ContactInteraction;
const text = (
  key: string,
  label: string,
  maxLength = 240,
  type: WorkspaceField["type"] = "text",
): WorkspaceField => ({ key, label, maxLength, type });
const select = (
  key: string,
  label: string,
  options: [string, string][],
): WorkspaceField => ({
  key,
  label,
  type: "select",
  options: options.map(([value, label]) => ({ value, label })),
});
export function ContactFormDialog({
  client,
  kind,
  record,
  contactId,
  today,
  groups,
  types,
  onClose,
  onSaved,
}: {
  client: SupabaseClient;
  kind: ContactEntity;
  record?: EditableRecord | null;
  contactId?: string;
  today: string;
  groups: ContactGroup[];
  types: RelationshipType[];
  onClose: () => void;
  onSaved: (id: string) => Promise<void>;
}) {
  let title = "";
  let fields: WorkspaceField[] = [];
  let defaults: Record<string, string> = {};
  if (kind === "contact") {
    title = record ? "Kontakt bearbeiten" : "Kontakt erstellen";
    fields = [
      { ...text("display_name", "Anzeigename", 160), required: true },
      text("first_name", "Vorname", 160),
      text("last_name", "Nachname", 160),
      text("nickname", "Spitzname", 160),
      text("organization", "Organisation"),
      text("role", "Rolle / Tätigkeit"),
      text("city", "Ort"),
      text("context", "Woher kenne ich die Person?", 4000, "textarea"),
      text("interests", "Interessen", 4000, "textarea"),
      text("memo", "Merkhilfe", 4000, "textarea"),
      text("preferred_channel", "Bevorzugter Kontaktkanal", 160),
      text(
        "contact_interval_days",
        "Kontaktabstand in Tagen (optional)",
        4,
        "number",
      ),
      { key: "is_favorite", label: "Favorit", type: "checkbox" },
      {
        key: "group_ids",
        label: "Gruppen",
        type: "multiselect",
        options: groups.map((group) => ({
          value: group.id,
          label: group.name,
        })),
      },
    ];
    defaults = { is_favorite: "false", group_ids: "" };
  } else if (kind === "channel") {
    title = "Kontaktmöglichkeit";
    fields = [
      select("kind", "Art", [
        ["email", "E-Mail"],
        ["phone", "Telefon"],
        ["link", "Link"],
      ]),
      text("label", "Bezeichnung", 160),
      { ...text("value", "Adresse / Nummer", 2000), required: true },
    ];
    defaults = { kind: "email" };
  } else if (kind === "group") {
    title = "Gruppe";
    fields = [{ ...text("name", "Gruppenname", 80), required: true }];
  } else if (kind === "type") {
    title = "Beziehungstyp";
    fields = [
      text("forward_label", "Person A ist … von Person B", 160),
      text("reverse_label", "Person B ist … von Person A", 160),
      {
        key: "is_symmetric",
        label: "Gleiche Bezeichnung in beide Richtungen",
        type: "checkbox",
      },
    ];
    defaults = { is_symmetric: "true" };
  } else if (kind === "relationship") {
    title = "Beziehung";
    fields = [
      {
        key: "contact_ids",
        label: "Genau zwei Personen: zuerst Person A, dann Person B",
        type: "people",
      },
      select(
        "type_id",
        "Beziehung von A zu B",
        types.map((type) => [
          type.id,
          `${type.forward_label} ↔ ${type.reverse_label}`,
        ]),
      ),
      text("memo", "Merkhilfe", 4000, "textarea"),
      text("started_on", "Beginn (optional)", 20, "date"),
      text("ended_on", "Ende (optional)", 20, "date"),
    ];
    defaults = { type_id: types[0]?.id ?? "", contact_ids: contactId ?? "" };
  } else if (kind === "event") {
    title = "Besonderer Tag";
    fields = [
      { ...text("title", "Titel"), required: true },
      select("kind", "Anlass", [
        ["birthday", "Geburtstag"],
        ["anniversary", "Jubiläum / Hochzeitstag"],
        ["memorial", "Gedenktag"],
        ["custom", "Eigener Anlass"],
      ]),
      text("day", "Tag", 2, "number"),
      text("month", "Monat", 2, "number"),
      text(
        "origin_year",
        "Ursprungsjahr (optional bei jährlichen Anlässen)",
        4,
        "number",
      ),
      select("recurrence", "Wiederholung", [
        ["annual", "Jährlich"],
        ["once", "Einmalig"],
      ]),
      select("leap_policy", "29. Februar in anderen Jahren", [
        ["march1", "1. März"],
        ["feb28", "28. Februar"],
        ["leap_only", "Nur Schaltjahre"],
      ]),
      { key: "contact_ids", label: "Zugeordnete Personen", type: "people" },
      text(
        "reminder_days",
        "Erinnern Tage vorher: z. B. 7,0 (leer: keine Hinweise)",
        100,
      ),
      {
        key: "show_in_calendar",
        label: "Im Kalender anzeigen",
        type: "checkbox",
      },
      text("memo", "Notiz", 4000, "textarea"),
    ];
    defaults = {
      kind: "birthday",
      day: "",
      month: "",
      recurrence: "annual",
      leap_policy: "march1",
      contact_ids: contactId ?? "",
      reminder_days: "7,0",
      show_in_calendar: "true",
    };
  } else if (kind === "interaction") {
    title = "Kontakt festhalten";
    fields = [
      text("contact_date", "Datum", 20, "date"),
      text("channel", "Kanal", 160),
      {
        ...text("summary", "Zusammenfassung", 4000, "textarea"),
        required: true,
      },
      { key: "contact_ids", label: "Beteiligte", type: "people" },
    ];
    defaults = { contact_date: today, contact_ids: contactId ?? "" };
  } else {
    title = "Neue Note";
    fields = [{ ...text("title", "Titel", 160), required: true }];
  }
  const raw = record as unknown as Record<string, unknown> | undefined;
  const initial = Object.fromEntries(
    fields.map((field) => [
      field.key,
      raw?.[field.key] == null
        ? (defaults[field.key] ?? "")
        : Array.isArray(raw[field.key])
          ? (raw[field.key] as string[]).join(",")
          : String(raw[field.key]),
    ]),
  );
  if (raw?.members)
    initial.contact_ids = (raw.members as { id: string }[])
      .map((member) => member.id)
      .join(",");
  if (kind === "relationship" && raw)
    initial.contact_ids = `${raw.source_id},${raw.target_id}`;
  return (
    <WorkspaceFormDialog
      title={title}
      description={
        kind === "relationship"
          ? "Die Reihenfolge bestimmt die Richtung. Auf beiden Profilen erscheint die passende Perspektive."
          : undefined
      }
      initial={initial}
      fields={fields}
      onClose={onClose}
      renderExtra={(values) =>
        kind === "contact" ? (
          <ContactDuplicateHint
            client={client}
            name={values.display_name}
            currentId={record?.id}
          />
        ) : kind === "channel" && values.kind === "email" ? (
          <ContactDuplicateHint
            client={client}
            email={values.value}
            currentId={record?.id}
          />
        ) : null
      }
      renderField={(field, value, onChange, disabled) => (
        <ContactMultiSelect
          today={today}
          value={value}
          onChange={onChange}
          disabled={disabled}
        />
      )}
      onSave={async (values) => {
        const patch: Record<string, unknown> = {};
        for (const field of fields) {
          const value = values[field.key].trim();
          if (field.type === "checkbox") patch[field.key] = value === "true";
          else if (field.key === "contact_ids" || field.key === "group_ids")
            patch[field.key] = value.split(",").filter(Boolean);
          else if (field.type === "number") {
            if (value && !/^\d+$/.test(value))
              throw new Error("Bitte ganze positive Zahlen eingeben.");
            patch[field.key] = value ? Number(value) : null;
          } else if (field.type === "date") patch[field.key] = value || null;
          else patch[field.key] = value;
        }
        if (kind === "contact" && raw?.group_ids)
          patch.group_ids = (values.group_ids ?? "").split(",").filter(Boolean);
        if (kind === "channel") {
          patch.contact_id = contactId;
          if (patch.kind === "link")
            patch.value = normalizeLinkUrl(String(patch.value));
        }
        if (kind === "type" && patch.is_symmetric)
          patch.reverse_label = patch.forward_label;
        if (kind === "relationship") {
          const ids = patch.contact_ids as string[];
          if (ids.length !== 2)
            throw new Error(
              "Bitte genau zwei unterschiedliche Personen auswählen.",
            );
          patch.source_id = ids[0];
          patch.target_id = ids[1];
          delete patch.contact_ids;
        }
        if (kind === "event") {
          const days = String(patch.reminder_days)
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean);
          if (days.some((day) => !/^\d+$/.test(day) || Number(day) > 30))
            throw new Error(
              "Erinnerungen müssen zwischen 0 und 30 Tagen liegen.",
            );
          patch.reminder_days = [...new Set(days.map(Number))];
        }
        if (kind === "note") patch.contact_ids = [contactId];
        if (patch.contact_ids && !(patch.contact_ids as string[]).length)
          throw new Error("Bitte mindestens eine Person auswählen.");
        const id = await saveContactRecord(client, kind, patch, record);
        await onSaved(id);
      }}
    />
  );
}

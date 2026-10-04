"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { ProjectPickerDialog } from "@/components/projects/ProjectPickerDialog";
import { createClient } from "@/lib/supabase/client";
import { loadContacts } from "@/lib/contacts/data";

export function ContactMultiSelect({
  value,
  onChange,
  disabled,
  today,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
  today: string;
}) {
  const client = useMemo(() => createClient() as unknown as SupabaseClient, []);
  const ids = useMemo(() => value.split(",").filter(Boolean), [value]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    if (ids.length)
      void Promise.resolve(
        client.from("contacts").select("id,display_name").in("id", ids),
      ).then(({ data, error }) => {
        if (!active) return;
        setError(error?.message ?? null);
        if (data)
          setNames(
            Object.fromEntries(
              data.map((person) => [person.id, person.display_name]),
            ),
          );
      });
    return () => {
      active = false;
    };
  }, [client, ids]);
  const loader = useCallback(
    async (search: string, page: number) => {
      const data = await loadContacts(client, today, { search, page });
      return {
        items: data.contacts.map((person) => ({
          id: person.id,
          title: person.display_name,
          description: ids.includes(person.id)
            ? "Bereits ausgewählt"
            : person.organization,
        })),
        more: (page + 1) * 50 < data.count,
      };
    },
    [client, today, ids],
  );
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {ids.map((id) => (
          <Button
            key={id}
            type="button"
            size="sm"
            variant="outline"
            disabled={disabled}
            aria-label={`${names[id] ?? "Kontakt"} entfernen`}
            onClick={() =>
              onChange(ids.filter((item) => item !== id).join(","))
            }
          >
            {names[id] ?? "Kontakt"} ×
          </Button>
        ))}
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <Button
        type="button"
        variant="outline"
        disabled={disabled || ids.length >= 200}
        onClick={() => setOpen(true)}
      >
        Person hinzufügen
      </Button>
      {open && (
        <ProjectPickerDialog
          title="Person auswählen"
          loadPage={loader}
          onClose={() => setOpen(false)}
          onPick={async (item) => {
            onChange([...new Set([...ids, item.id])].join(","));
          }}
        />
      )}
    </div>
  );
}

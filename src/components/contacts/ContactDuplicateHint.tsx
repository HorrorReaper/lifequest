"use client";
import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { searchTerm } from "@/lib/projects/project-data";
export function ContactDuplicateHint({
  client,
  name,
  email,
  currentId,
}: {
  client: SupabaseClient;
  name?: string;
  email?: string;
  currentId?: string;
}) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let active = true;
    const term = searchTerm(name ?? email ?? "");
    const timer = setTimeout(() => {
      if (!term) {
        if (active) setCount(0);
        return;
      }
      let query = client
        .from(name !== undefined ? "contacts" : "contact_channels")
        .select("id", { count: "exact", head: true })
        .ilike(name !== undefined ? "display_name" : "value", term);
      if (email !== undefined) query = query.eq("kind", "email");
      if (currentId) query = query.neq("id", currentId);
      void Promise.resolve(query).then(({ count, error }) => {
        if (active) setCount(error ? 0 : (count ?? 0));
      });
    }, 250);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [client, name, email, currentId]);
  return count > 0 ? (
    <p role="status" className="rounded-lg bg-amber-500/10 p-3 text-sm">
      Es gibt bereits {count} passende Einträge. Du kannst diesen Kontakt
      trotzdem speichern; es wird nichts automatisch zusammengeführt.
    </p>
  ) : null;
}

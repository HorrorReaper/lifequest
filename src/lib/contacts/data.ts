import type { SupabaseClient } from "@supabase/supabase-js";
import { allProjectRows, searchTerm } from "@/lib/projects/project-data";
import type {
  ContactDetailData,
  ContactEntity,
  ContactGroup,
  ContactList,
  ContactOccurrence,
  ContactReminders,
  RelationshipType,
} from "./types";

export async function contactRpc<T>(
  client: SupabaseClient,
  name: string,
  args: Record<string, unknown> = {},
): Promise<T> {
  const { data, error } = await client.rpc(name, args);
  if (error)
    throw new Error(
      error.message.includes("CONTACT_CONFLICT")
        ? "Dieser Eintrag wurde inzwischen geändert. Deine Eingaben bleiben erhalten; lade den aktuellen Stand vor einem erneuten Versuch."
        : error.message,
    );
  return data as T;
}
export function saveContactRecord(
  client: SupabaseClient,
  kind: ContactEntity,
  values: Record<string, unknown>,
  record?: { id: string; updated_at: string } | null,
) {
  return contactRpc<string>(client, "save_contact_record", {
    p_kind: kind,
    p_id: record?.id ?? null,
    p_values: values,
    p_expected_updated_at: record?.updated_at ?? null,
  });
}
export function deleteContactRecord(
  client: SupabaseClient,
  kind: ContactEntity,
  record: { id: string; updated_at: string },
) {
  return contactRpc<void>(client, "delete_contact_record", {
    p_kind: kind,
    p_id: record.id,
    p_expected_updated_at: record.updated_at,
  });
}
export async function loadContactMetadata(
  client: SupabaseClient,
  userId: string,
) {
  await contactRpc(client, "ensure_contact_defaults");
  const [groups, types] = await Promise.all([
    allProjectRows<ContactGroup>(
      client
        .from("contact_groups")
        .select("*")
        .eq("user_id", userId)
        .order("name")
        .order("id"),
    ),
    allProjectRows<RelationshipType>(
      client
        .from("contact_relationship_types")
        .select("*")
        .eq("user_id", userId)
        .order("forward_label")
        .order("id"),
    ),
  ]);
  return { groups, types };
}
export function loadContacts(
  client: SupabaseClient,
  today: string,
  options: {
    search?: string;
    group?: string;
    archived?: boolean;
    favorites?: boolean;
    sort?: string;
    page?: number;
  } = {},
) {
  return contactRpc<ContactList>(client, "list_contacts", {
    p_today: today,
    p_search: searchTerm(options.search ?? ""),
    p_group: options.group || null,
    p_archived: options.archived ?? false,
    p_favorites: options.favorites ?? false,
    p_sort: options.sort ?? "name",
    p_page: options.page ?? 0,
  });
}
export function loadContactDetail(
  client: SupabaseClient,
  id: string,
  today: string,
) {
  return contactRpc<ContactDetailData>(client, "get_contact_detail", {
    p_contact_id: id,
    p_today: today,
  });
}
export function loadContactOccurrences(
  client: SupabaseClient,
  start: string,
  end: string,
) {
  return contactRpc<ContactOccurrence[]>(client, "contact_event_occurrences", {
    p_start: start,
    p_end: end,
  });
}
export function loadContactReminders(
  client: SupabaseClient,
  today: string,
  timezone = "UTC",
) {
  return contactRpc<ContactReminders>(client, "contact_reminders", {
    p_today: today,
    p_timezone: timezone,
  });
}
export const contactHref = (id: string, tab = "overview") =>
  `/admin/contacts/${id}?tab=${tab}`;
export const contactNoteHref = (noteId: string, contactId: string) =>
  `/admin/notes?note=${encodeURIComponent(noteId)}&returnTo=${encodeURIComponent(contactHref(contactId, "history"))}`;
export function relationshipPerspective(
  contactId: string,
  relation: {
    source_id: string;
    target_id: string;
    source_name: string;
    target_name: string;
    type: RelationshipType;
  },
) {
  return contactId === relation.source_id
    ? {
        id: relation.target_id,
        name: relation.target_name,
        label: relation.type.forward_label,
      }
    : {
        id: relation.source_id,
        name: relation.source_name,
        label: relation.type.reverse_label,
      };
}

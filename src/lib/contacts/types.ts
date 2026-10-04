import type { ManagedTask } from "@/lib/tasks";
export interface Contact {
  id: string;
  user_id: string;
  display_name: string;
  first_name: string;
  last_name: string;
  nickname: string;
  organization: string;
  role: string;
  city: string;
  context: string;
  interests: string;
  memo: string;
  preferred_channel: string;
  contact_interval_days: number | null;
  is_favorite: boolean;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}
export interface ContactGroup {
  id: string;
  name: string;
  user_id: string;
  updated_at: string;
  created_at: string;
}
export interface RelationshipType {
  id: string;
  user_id: string;
  forward_label: string;
  reverse_label: string;
  is_symmetric: boolean;
  updated_at: string;
  created_at: string;
}
export interface PersonRef {
  id: string;
  name: string;
}
export interface ContactChannel {
  id: string;
  user_id: string;
  contact_id: string;
  kind: "email" | "phone" | "link";
  label: string;
  value: string;
  sort_order: number;
  updated_at: string;
  created_at: string;
}
export interface ContactRelationship {
  id: string;
  user_id: string;
  source_id: string;
  target_id: string;
  type_id: string;
  memo: string;
  started_on: string | null;
  ended_on: string | null;
  updated_at: string;
  type: RelationshipType;
  source_name: string;
  target_name: string;
}
export interface ContactEvent {
  id: string;
  user_id: string;
  title: string;
  kind: "birthday" | "anniversary" | "memorial" | "custom";
  month: number;
  day: number;
  origin_year: number | null;
  recurrence: "annual" | "once";
  leap_policy: "march1" | "feb28" | "leap_only";
  memo: string;
  show_in_calendar: boolean;
  reminder_days: number[];
  updated_at: string;
  created_at: string;
  members: PersonRef[];
}
export interface ContactOccurrence extends ContactEvent {
  occurrence_date: string;
  is_done: boolean;
  snoozed_until: string | null;
  task_id: string | null;
}
export interface ContactInteraction {
  id: string;
  user_id: string;
  contact_date: string;
  channel: string;
  summary: string;
  updated_at: string;
  created_at: string;
  members: PersonRef[];
}
export interface ContactSummary extends Contact {
  groups: { id: string; name: string }[];
  last_contact: string | null;
  next_event_date: string | null;
}
export interface ContactList {
  contacts: ContactSummary[];
  count: number;
  favorites: number;
  upcoming: number;
  due_tasks: number;
}
export interface ContactDetailData {
  contact: Contact;
  channels: ContactChannel[];
  group_ids: string[];
  relationships: ContactRelationship[];
  events: ContactEvent[];
  interactions: ContactInteraction[];
  last_contact: string | null;
  notes: { id: string; title: string; preview: string; updated_at: string }[];
  tasks: (ManagedTask & { contact_ids: string[] })[];
}
export interface ContactReminders {
  events: ContactOccurrence[];
  tasks: (ManagedTask & { contacts: PersonRef[] })[];
  catchups: (Contact & { last_contact: string | null })[];
}
export type ContactEntity =
  | "contact"
  | "channel"
  | "group"
  | "type"
  | "relationship"
  | "event"
  | "interaction"
  | "task"
  | "note";

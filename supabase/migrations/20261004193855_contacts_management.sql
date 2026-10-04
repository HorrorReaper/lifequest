-- Personal contacts are owned admin data, separate from Auth users.
create table public.contacts (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 display_name text not null check(char_length(trim(display_name)) between 1 and 160),
 first_name text not null default '' check(char_length(first_name)<=160), last_name text not null default '' check(char_length(last_name)<=160),
 nickname text not null default '' check(char_length(nickname)<=160), organization text not null default '' check(char_length(organization)<=240),
 role text not null default '' check(char_length(role)<=240), city text not null default '' check(char_length(city)<=240),
 context text not null default '' check(char_length(context)<=4000), interests text not null default '' check(char_length(interests)<=4000),
 memo text not null default '' check(char_length(memo)<=4000), preferred_channel text not null default '' check(char_length(preferred_channel)<=160),
 contact_interval_days integer check(contact_interval_days between 1 and 3650), is_favorite boolean not null default false,
 is_archived boolean not null default false, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(id,user_id)
);
create index contacts_owner_name_idx on public.contacts(user_id,is_archived,display_name,id);
create table public.contact_channels (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 contact_id uuid not null, kind text not null check(kind in ('email','phone','link')), label text not null default '' check(char_length(label)<=160),
 value text not null check(char_length(trim(value)) between 1 and 2000), sort_order integer not null default 0 check(sort_order>=0),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 foreign key(contact_id,user_id) references public.contacts(id,user_id) on delete cascade,
 check(kind<>'link' or value ~* '^https?://[^/[:space:]@]+([/?#][^[:space:]]*)?$'),
 check(kind<>'email' or value ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')
);
create index contact_channels_contact_idx on public.contact_channels(contact_id,user_id);
create index contact_channels_owner_idx on public.contact_channels(user_id);
create table public.contact_groups (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 name text not null check(char_length(trim(name)) between 1 and 80), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(id,user_id), unique(user_id,name)
);
create table public.contact_group_members (
 user_id uuid not null references auth.users(id) on delete cascade, contact_id uuid not null, group_id uuid not null, primary key(contact_id,group_id),
 foreign key(contact_id,user_id) references public.contacts(id,user_id) on delete cascade,
 foreign key(group_id,user_id) references public.contact_groups(id,user_id) on delete cascade
);
create index contact_group_members_contact_idx on public.contact_group_members(contact_id,user_id);
create index contact_group_members_group_idx on public.contact_group_members(group_id,user_id);
create index contact_group_members_owner_idx on public.contact_group_members(user_id);
create table public.contact_relationship_types (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 forward_label text not null check(char_length(trim(forward_label)) between 1 and 160),
 reverse_label text not null check(char_length(trim(reverse_label)) between 1 and 160), is_symmetric boolean not null default true,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(id,user_id), unique(user_id,forward_label,reverse_label),
 check(not is_symmetric or forward_label=reverse_label)
);
create table public.contact_relationships (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 source_id uuid not null, target_id uuid not null, type_id uuid not null, memo text not null default '' check(char_length(memo)<=4000),
 started_on date, ended_on date, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 foreign key(source_id,user_id) references public.contacts(id,user_id) on delete cascade,
 foreign key(target_id,user_id) references public.contacts(id,user_id) on delete cascade,
 foreign key(type_id,user_id) references public.contact_relationship_types(id,user_id) on delete restrict,
 check(source_id<>target_id), check(ended_on is null or started_on is null or ended_on>=started_on), unique(user_id,source_id,target_id,type_id)
);
create index contact_relationships_source_idx on public.contact_relationships(source_id,user_id);
create index contact_relationships_target_idx on public.contact_relationships(target_id,user_id);
create index contact_relationships_type_idx on public.contact_relationships(type_id,user_id);
create index contact_relationships_owner_idx on public.contact_relationships(user_id);
create function public.canonicalize_contact_relationship() returns trigger language plpgsql security invoker set search_path='' as $$
declare v_id uuid;
begin
 if exists(select 1 from public.contact_relationship_types where id=new.type_id and user_id=new.user_id and is_symmetric) and new.source_id>new.target_id then
  v_id:=new.source_id; new.source_id:=new.target_id; new.target_id:=v_id;
 end if;
 return new;
end $$;
create trigger contact_relationships_canonical before insert or update on public.contact_relationships for each row execute function public.canonicalize_contact_relationship();
-- Do not silently change the meaning/direction of existing relationships.
create function public.guard_contact_relationship_type() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if new.is_symmetric<>old.is_symmetric and exists(select 1 from public.contact_relationships where type_id=old.id) then raise exception 'Relationship direction is in use; create another type'; end if;
 return new;
end $$;
create trigger contact_relationship_types_guard before update on public.contact_relationship_types for each row execute function public.guard_contact_relationship_type();
create table public.contact_events (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 title text not null check(char_length(trim(title)) between 1 and 240), kind text not null default 'custom' check(kind in ('birthday','anniversary','memorial','custom')),
 month integer not null check(month between 1 and 12), day integer not null check(day between 1 and 31), origin_year integer check(origin_year between 1 and 9999),
 recurrence text not null default 'annual' check(recurrence in ('annual','once')), leap_policy text not null default 'march1' check(leap_policy in ('march1','feb28','leap_only')),
 memo text not null default '' check(char_length(memo)<=4000), show_in_calendar boolean not null default true,
 reminder_days integer[] not null default array[7,0] check(cardinality(reminder_days)<=10 and reminder_days<@array[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30]),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(id,user_id),
 check(make_date(2000,month,day) is not null), check(recurrence<>'once' or origin_year is not null),
 check(origin_year is null or make_date(origin_year,month,day) is not null)
);
create index contact_events_owner_idx on public.contact_events(user_id);
create table public.contact_event_members (
 user_id uuid not null references auth.users(id) on delete cascade, event_id uuid not null, contact_id uuid not null, primary key(event_id,contact_id),
 foreign key(event_id,user_id) references public.contact_events(id,user_id) on delete cascade,
 foreign key(contact_id,user_id) references public.contacts(id,user_id) on delete cascade
);
create index contact_event_members_event_idx on public.contact_event_members(event_id,user_id);
create index contact_event_members_contact_idx on public.contact_event_members(contact_id,user_id);
create index contact_event_members_owner_idx on public.contact_event_members(user_id);
create table public.contact_event_occurrence_states (
 user_id uuid not null references auth.users(id) on delete cascade, event_id uuid not null, occurrence_date date not null,
 is_done boolean not null default false, snoozed_until date, task_id uuid, updated_at timestamptz not null default now(), primary key(event_id,occurrence_date),
 foreign key(event_id,user_id) references public.contact_events(id,user_id) on delete cascade,
 foreign key(task_id,user_id) references public.tasks(id,user_id) on delete set null(task_id)
);
create index contact_occurrence_event_idx on public.contact_event_occurrence_states(event_id,user_id);
create index contact_occurrence_task_idx on public.contact_event_occurrence_states(task_id,user_id);
create index contact_occurrence_owner_idx on public.contact_event_occurrence_states(user_id);
create table public.contact_interactions (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 contact_date date not null, channel text not null default '' check(char_length(channel)<=160),
 summary text not null check(char_length(trim(summary)) between 1 and 4000), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(id,user_id)
);
create index contact_interactions_owner_date_idx on public.contact_interactions(user_id,contact_date);
create table public.contact_interaction_members (
 user_id uuid not null references auth.users(id) on delete cascade, interaction_id uuid not null, contact_id uuid not null, primary key(interaction_id,contact_id),
 foreign key(interaction_id,user_id) references public.contact_interactions(id,user_id) on delete cascade,
 foreign key(contact_id,user_id) references public.contacts(id,user_id) on delete cascade
);
create index contact_interaction_members_interaction_idx on public.contact_interaction_members(interaction_id,user_id);
create index contact_interaction_members_contact_idx on public.contact_interaction_members(contact_id,user_id);
create index contact_interaction_members_owner_idx on public.contact_interaction_members(user_id);
create table public.knowledge_note_contacts (
 user_id uuid not null references auth.users(id) on delete cascade, note_id uuid not null, contact_id uuid not null, primary key(note_id,contact_id),
 foreign key(note_id,user_id) references public.knowledge_notes(id,user_id) on delete cascade,
 foreign key(contact_id,user_id) references public.contacts(id,user_id) on delete cascade
);
create index knowledge_note_contacts_note_idx on public.knowledge_note_contacts(note_id,user_id);
create index knowledge_note_contacts_contact_idx on public.knowledge_note_contacts(contact_id,user_id);
create index knowledge_note_contacts_owner_idx on public.knowledge_note_contacts(user_id);
create table public.task_contacts (
 user_id uuid not null references auth.users(id) on delete cascade, task_id uuid not null, contact_id uuid not null, primary key(task_id,contact_id),
 foreign key(task_id,user_id) references public.tasks(id,user_id) on delete cascade,
 foreign key(contact_id,user_id) references public.contacts(id,user_id) on delete cascade
);
create index task_contacts_task_idx on public.task_contacts(task_id,user_id);
create index task_contacts_contact_idx on public.task_contacts(contact_id,user_id);
create index task_contacts_owner_idx on public.task_contacts(user_id);
create function public.touch_contact_record() returns trigger language plpgsql security invoker set search_path='' as $$
begin new.updated_at:=clock_timestamp(); return new; end $$;
do $$ declare t text; begin
 foreach t in array array['contacts','contact_channels','contact_groups','contact_group_members','contact_relationship_types','contact_relationships','contact_events','contact_event_members','contact_event_occurrence_states','contact_interactions','contact_interaction_members','knowledge_note_contacts','task_contacts'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from anon, authenticated',t);
  execute format('grant select,insert,update,delete on public.%I to authenticated',t);
  execute format('create policy "Owned admin contacts" on public.%I for all to authenticated using ((select auth.uid())=user_id and ((select auth.jwt())->''app_metadata''->>''role'')=''admin'') with check ((select auth.uid())=user_id and ((select auth.jwt())->''app_metadata''->>''role'')=''admin'')',t);
 end loop;
 foreach t in array array['contacts','contact_channels','contact_groups','contact_relationship_types','contact_relationships','contact_events','contact_interactions','contact_event_occurrence_states'] loop
  execute format('create trigger contact_record_timestamp before update on public.%I for each row execute function public.touch_contact_record()',t);
 end loop;
end $$;
create function public.contact_require_admin() returns void language plpgsql security invoker set search_path='' as $$
begin if auth.uid() is null or ((select auth.jwt())->'app_metadata'->>'role') is distinct from 'admin' then raise exception 'Admin role required'; end if; end $$;
create function public.ensure_contact_defaults() returns void language plpgsql security invoker set search_path='' as $$
begin
 perform public.contact_require_admin();
 if not exists(select 1 from public.contact_groups where user_id=auth.uid()) then insert into public.contact_groups(user_id,name) values(auth.uid(),'Privat'),(auth.uid(),'Beruflich') on conflict do nothing; end if;
 if not exists(select 1 from public.contact_relationship_types where user_id=auth.uid()) then
 insert into public.contact_relationship_types(user_id,forward_label,reverse_label,is_symmetric) values
 (auth.uid(),'Familie','Familie',true),(auth.uid(),'Partnerschaft','Partnerschaft',true),(auth.uid(),'Freundschaft','Freundschaft',true),(auth.uid(),'Kollegen','Kollegen',true),
 (auth.uid(),'Elternteil von','Kind von',false),(auth.uid(),'Vorgesetzter von','Mitarbeiter von',false),(auth.uid(),'Kunde von','Ansprechpartner für',false),(auth.uid(),'Kennengelernt durch','Hat vorgestellt',false) on conflict do nothing;
 end if;
end $$;
create function public.contact_occurrence_date(p_month integer,p_day integer,p_year integer,p_policy text) returns date language plpgsql immutable security invoker set search_path='' as $$
begin
 if p_month=2 and p_day=29 and not(p_year%4=0 and (p_year%100<>0 or p_year%400=0)) then
  if p_policy='leap_only' then return null; elsif p_policy='feb28' then return make_date(p_year,2,28); else return make_date(p_year,3,1); end if;
 end if;
 return make_date(p_year,p_month,p_day);
end $$;
create function public.contact_event_occurrences(p_start date,p_end date,p_contact_id uuid default null) returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare v_result jsonb;
begin
 perform public.contact_require_admin();
 if p_start is null or p_end is null or p_end<p_start or p_end-p_start>800 then raise exception 'Invalid calendar window'; end if;
 with candidates as (
  select e.*, public.contact_occurrence_date(e.month,e.day,y,e.leap_policy) occurrence_date,
   (select jsonb_agg(jsonb_build_object('id',c.id,'name',c.display_name) order by c.display_name,c.id) from public.contact_event_members m join public.contacts c on c.id=m.contact_id where m.event_id=e.id and not c.is_archived) members
  from public.contact_events e cross join generate_series(extract(year from p_start)::integer,extract(year from p_end)::integer) y
  where e.user_id=auth.uid() and (e.origin_year is null or y>=e.origin_year) and (e.recurrence='annual' or y=e.origin_year)
   and (p_contact_id is null or exists(select 1 from public.contact_event_members where event_id=e.id and contact_id=p_contact_id))
 ), occurrences as (
  select c.*,coalesce(s.is_done,false) is_done,s.snoozed_until,s.task_id from candidates c left join public.contact_event_occurrence_states s on s.event_id=c.id and s.occurrence_date=c.occurrence_date
  where c.occurrence_date between p_start and p_end and c.members is not null
 ) select coalesce(jsonb_agg(to_jsonb(o) order by occurrence_date,title,id),'[]'::jsonb) into v_result from occurrences o;
 return v_result;
end $$;
create function public.list_contacts(p_today date,p_search text default '',p_group uuid default null,p_archived boolean default false,p_favorites boolean default false,p_sort text default 'name',p_page integer default 0) returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare v_result jsonb;
begin
 perform public.contact_require_admin(); if p_today is null or p_page<0 then raise exception 'Invalid contacts window'; end if;
 with occurrences as (select * from jsonb_to_recordset(public.contact_event_occurrences(p_today,p_today+370)) as x(id uuid,title text,occurrence_date date,members jsonb)),
 enriched as (
  select c.*,
   (select max(i.contact_date) from public.contact_interactions i join public.contact_interaction_members m on m.interaction_id=i.id where m.contact_id=c.id and i.contact_date<=p_today) last_contact,
   (select min(o.occurrence_date) from occurrences o where exists(select 1 from jsonb_array_elements(o.members) m where (m->>'id')::uuid=c.id)) next_event_date,
   (select coalesce(jsonb_agg(jsonb_build_object('id',g.id,'name',g.name) order by g.name),'[]') from public.contact_groups g join public.contact_group_members m on m.group_id=g.id where m.contact_id=c.id) groups
  from public.contacts c where c.user_id=auth.uid()
 ), filtered as (
  select * from enriched c where c.is_archived=p_archived and (not p_favorites or c.is_favorite)
   and (p_group is null or exists(select 1 from public.contact_group_members where contact_id=c.id and group_id=p_group))
   and (p_search='' or c.display_name ilike '%'||p_search||'%' or c.organization ilike '%'||p_search||'%' or exists(select 1 from jsonb_array_elements(c.groups) g where g->>'name' ilike '%'||p_search||'%'))
 ), paged as (
  select * from filtered order by case when p_sort='last' then last_contact end desc nulls last,case when p_sort='next' then next_event_date end asc nulls last,display_name,id limit 50 offset p_page*50
 ) select jsonb_build_object('contacts',(select coalesce(jsonb_agg(to_jsonb(p)),'[]') from paged p),'count',(select count(*) from filtered),
  'favorites',(select count(*) from enriched where is_favorite and not is_archived),
  'upcoming',(select count(*) from occurrences where occurrence_date<=p_today+30),
  'due_tasks',(select count(distinct t.id) from public.tasks t join public.task_contacts tc on tc.task_id=t.id join public.contacts c on c.id=tc.contact_id where not c.is_archived and not t.is_completed and t.status<>'cancelled' and t.parent_task_id is null and t.due_date<=p_today)) into v_result;
 return v_result;
end $$;
create function public.get_contact_detail(p_contact_id uuid,p_today date) returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare v_contact jsonb;
begin
 perform public.contact_require_admin(); select to_jsonb(c) into v_contact from public.contacts c where id=p_contact_id and user_id=auth.uid(); if v_contact is null then raise exception 'Contact not found'; end if;
 return jsonb_build_object('contact',v_contact,
  'channels',(select coalesce(jsonb_agg(to_jsonb(c) order by sort_order,id),'[]') from public.contact_channels c where contact_id=p_contact_id),
  'group_ids',(select coalesce(jsonb_agg(group_id),'[]') from public.contact_group_members where contact_id=p_contact_id),
  'relationships',(select coalesce(jsonb_agg(to_jsonb(r)||jsonb_build_object('type',to_jsonb(t),'source_name',s.display_name,'target_name',d.display_name) order by r.created_at desc),'[]') from public.contact_relationships r join public.contact_relationship_types t on t.id=r.type_id join public.contacts s on s.id=r.source_id join public.contacts d on d.id=r.target_id where r.source_id=p_contact_id or r.target_id=p_contact_id),
  'events',(select coalesce(jsonb_agg(to_jsonb(e)||jsonb_build_object('members',(select jsonb_agg(jsonb_build_object('id',c.id,'name',c.display_name)) from public.contact_event_members em join public.contacts c on c.id=em.contact_id where em.event_id=e.id)) order by e.month,e.day),'[]') from public.contact_events e join public.contact_event_members m on m.event_id=e.id where m.contact_id=p_contact_id),
  'interactions',(select coalesce(jsonb_agg(to_jsonb(i)||jsonb_build_object('members',(select jsonb_agg(jsonb_build_object('id',c.id,'name',c.display_name)) from public.contact_interaction_members im join public.contacts c on c.id=im.contact_id where im.interaction_id=i.id)) order by i.contact_date desc,i.id),'[]') from public.contact_interactions i join public.contact_interaction_members m on m.interaction_id=i.id where m.contact_id=p_contact_id),
  'last_contact',(select max(i.contact_date) from public.contact_interactions i join public.contact_interaction_members m on m.interaction_id=i.id where m.contact_id=p_contact_id and i.contact_date<=p_today),
  'notes',(select coalesce(jsonb_agg(jsonb_build_object('id',n.id,'title',n.title,'preview',left(n.content,160),'updated_at',n.updated_at) order by n.updated_at desc),'[]') from public.knowledge_notes n join public.knowledge_note_contacts m on m.note_id=n.id where m.contact_id=p_contact_id),
  'tasks',(select coalesce(jsonb_agg(to_jsonb(t)||jsonb_build_object('contact_ids',(select jsonb_agg(contact_id) from public.task_contacts where task_id=t.id)) order by t.is_completed,t.due_date nulls last,t.id),'[]') from public.tasks t join public.task_contacts m on m.task_id=t.id where m.contact_id=p_contact_id and t.parent_task_id is null));
end $$;
-- Whitelisted entity writes; JSON cannot set ownership, IDs or timestamps.
create function public.save_contact_record(p_kind text,p_id uuid,p_values jsonb,p_expected_updated_at timestamptz default null) returns uuid language plpgsql security invoker set search_path='' as $$
declare v_table text; v_allowed text[]; v_columns text; v_values text; v_stamp timestamptz; v_id uuid:=coalesce(p_id,gen_random_uuid()); v_members text; v_fk text; v_contact uuid; v_group uuid;
begin
 perform public.contact_require_admin();
 case p_kind
 when 'contact' then v_table:='contacts'; v_allowed:=array['display_name','first_name','last_name','nickname','organization','role','city','context','interests','memo','preferred_channel','contact_interval_days','is_favorite','is_archived'];
 when 'channel' then v_table:='contact_channels'; v_allowed:=array['contact_id','kind','label','value','sort_order'];
 when 'group' then v_table:='contact_groups'; v_allowed:=array['name'];
 when 'type' then v_table:='contact_relationship_types'; v_allowed:=array['forward_label','reverse_label','is_symmetric'];
 when 'relationship' then v_table:='contact_relationships'; v_allowed:=array['source_id','target_id','type_id','memo','started_on','ended_on'];
 when 'event' then v_table:='contact_events'; v_allowed:=array['title','kind','month','day','origin_year','recurrence','leap_policy','memo','show_in_calendar','reminder_days']; v_members:='contact_event_members'; v_fk:='event_id';
 when 'interaction' then v_table:='contact_interactions'; v_allowed:=array['contact_date','channel','summary']; v_members:='contact_interaction_members'; v_fk:='interaction_id';
 when 'task' then v_table:='tasks'; v_allowed:=array['title','description','due_date','priority']; v_members:='task_contacts'; v_fk:='task_id';
 when 'note' then v_table:='knowledge_notes'; v_allowed:=array['title','slug']; v_members:='knowledge_note_contacts'; v_fk:='note_id'; p_values:=p_values||jsonb_build_object('slug','contact-note-'||v_id::text);
 else raise exception 'Unsupported contact entity'; end case;
 if jsonb_typeof(p_values)<>'object' then raise exception 'Invalid values'; end if;
 if p_id is not null then
  execute format('select updated_at from public.%I where id=$1 and user_id=auth.uid() for update',v_table) into v_stamp using p_id;
  if v_stamp is null then raise exception 'Record not found'; end if;
  if p_expected_updated_at is null or v_stamp<>p_expected_updated_at then raise exception 'CONTACT_CONFLICT: reload before retrying'; end if;
 end if;
 if p_kind='task' and p_id is not null and exists(select 1 from public.tasks where id=p_id and parent_task_id is not null) then raise exception 'Select a main task'; end if;
 select string_agg(format('%I',k),','),string_agg(format('r.%I',k),',') into v_columns,v_values from jsonb_object_keys(p_values) k where k=any(v_allowed);
 if v_columns is null then raise exception 'No editable fields'; end if;
 if p_id is null then
  execute format('insert into public.%I(id,user_id,%s) select $2,auth.uid(),%s from jsonb_populate_record(null::public.%I,$1) r',v_table,v_columns,v_values,v_table) using p_values,v_id;
 else
  execute format('update public.%I set (%s)=(select %s from jsonb_populate_record(null::public.%I,$1) r) where id=$2 and user_id=auth.uid()',v_table,v_columns,v_values,v_table) using p_values,v_id;
 end if;
 if p_kind='contact' and p_values ? 'group_ids' then
  if jsonb_array_length(p_values->'group_ids')>200 then raise exception 'Too many groups'; end if;
  delete from public.contact_group_members where contact_id=v_id;
  for v_group in select distinct value::uuid from jsonb_array_elements_text(p_values->'group_ids') loop insert into public.contact_group_members(user_id,contact_id,group_id) values(auth.uid(),v_id,v_group); end loop;
 end if;
 if v_members is not null and (p_values ? 'contact_ids' or p_id is null) then
  if coalesce(jsonb_array_length(p_values->'contact_ids'),0) not between 1 and 200 then raise exception 'Select 1 to 200 contacts'; end if;
  execute format('delete from public.%I where %I=$1 and user_id=auth.uid()',v_members,v_fk) using v_id;
  for v_contact in select distinct value::uuid from jsonb_array_elements_text(p_values->'contact_ids') loop execute format('insert into public.%I(user_id,%I,contact_id) values(auth.uid(),$1,$2)',v_members,v_fk) using v_id,v_contact; end loop;
 end if;
 return v_id;
end $$;
create function public.delete_contact_record(p_kind text,p_id uuid,p_expected_updated_at timestamptz) returns void language plpgsql security invoker set search_path='' as $$
declare v_table text; v_stamp timestamptz;
begin
 perform public.contact_require_admin();
 v_table:=case p_kind when 'contact' then 'contacts' when 'channel' then 'contact_channels' when 'group' then 'contact_groups' when 'type' then 'contact_relationship_types' when 'relationship' then 'contact_relationships' when 'event' then 'contact_events' when 'interaction' then 'contact_interactions' end;
 if v_table is null then raise exception 'Unsupported delete'; end if;
 execute format('select updated_at from public.%I where id=$1 and user_id=auth.uid() for update',v_table) into v_stamp using p_id;
 if v_stamp is null then raise exception 'Record not found'; end if;
 if p_expected_updated_at is null or v_stamp<>p_expected_updated_at then raise exception 'CONTACT_CONFLICT'; end if;
 execute format('delete from public.%I where id=$1 and user_id=auth.uid()',v_table) using p_id;
 -- Shared records survive; records with no participants are removed.
 delete from public.contact_events e where e.user_id=auth.uid() and not exists(select 1 from public.contact_event_members where event_id=e.id);
 delete from public.contact_interactions i where i.user_id=auth.uid() and not exists(select 1 from public.contact_interaction_members where interaction_id=i.id);
end $$;
create function public.link_contact_resource(p_contact_id uuid,p_kind text,p_resource_id uuid,p_remove boolean default false) returns void language plpgsql security invoker set search_path='' as $$
begin
 perform public.contact_require_admin(); if not exists(select 1 from public.contacts where id=p_contact_id and user_id=auth.uid()) then raise exception 'Contact not found'; end if;
 if p_kind='note' then
  if p_remove then delete from public.knowledge_note_contacts where contact_id=p_contact_id and note_id=p_resource_id;
  else insert into public.knowledge_note_contacts(user_id,contact_id,note_id) values(auth.uid(),p_contact_id,p_resource_id) on conflict do nothing; end if;
 elsif p_kind='task' then
  if not exists(select 1 from public.tasks where id=p_resource_id and user_id=auth.uid() and parent_task_id is null) then raise exception 'Select an owned main task'; end if;
  if p_remove then delete from public.task_contacts where contact_id=p_contact_id and task_id=p_resource_id;
  else insert into public.task_contacts(user_id,contact_id,task_id) values(auth.uid(),p_contact_id,p_resource_id) on conflict do nothing; end if;
 else raise exception 'Unsupported resource'; end if;
end $$;
create function public.set_contact_occurrence(p_event_id uuid,p_date date,p_done boolean,p_snoozed_until date default null) returns void language plpgsql security invoker set search_path='' as $$
begin
 perform public.contact_require_admin(); perform 1 from public.contact_events where id=p_event_id and user_id=auth.uid() for update; if not found then raise exception 'Event not found'; end if;
 if not exists(select 1 from jsonb_array_elements(public.contact_event_occurrences(p_date,p_date)) e where (e->>'id')::uuid=p_event_id) then raise exception 'Invalid occurrence'; end if;
 insert into public.contact_event_occurrence_states(user_id,event_id,occurrence_date,is_done,snoozed_until) values(auth.uid(),p_event_id,p_date,p_done,p_snoozed_until)
 on conflict(event_id,occurrence_date) do update set is_done=excluded.is_done,snoozed_until=excluded.snoozed_until;
end $$;
create function public.create_contact_occurrence_task(p_event_id uuid,p_date date,p_draft jsonb) returns uuid language plpgsql security invoker set search_path='' as $$
declare v_task uuid; v_contacts jsonb;
begin
 perform public.contact_require_admin(); perform 1 from public.contact_events where id=p_event_id and user_id=auth.uid() for update; if not found then raise exception 'Event not found'; end if;
 if not exists(select 1 from jsonb_array_elements(public.contact_event_occurrences(p_date,p_date)) e where (e->>'id')::uuid=p_event_id) then raise exception 'Invalid occurrence'; end if;
 select task_id into v_task from public.contact_event_occurrence_states where event_id=p_event_id and occurrence_date=p_date;
 if v_task is not null then return v_task; end if;
 select jsonb_agg(contact_id) into v_contacts from public.contact_event_members where event_id=p_event_id;
 v_task:=public.save_contact_record('task',null,p_draft||jsonb_build_object('contact_ids',v_contacts));
 insert into public.contact_event_occurrence_states(user_id,event_id,occurrence_date,task_id) values(auth.uid(),p_event_id,p_date,v_task)
 on conflict(event_id,occurrence_date) do update set task_id=excluded.task_id;
 return v_task;
end $$;
create function public.contact_reminders(p_today date,p_timezone text default 'UTC') returns jsonb language plpgsql stable security invoker set search_path='' as $$
begin
 perform public.contact_require_admin();
 return jsonb_build_object('events',(select coalesce(jsonb_agg(e order by e->>'occurrence_date'),'[]') from jsonb_array_elements(public.contact_event_occurrences(p_today-30,p_today+30)) e
 where not (e->>'is_done')::boolean and ((e->>'snoozed_until')::date is null or (e->>'snoozed_until')::date<=p_today)
 and exists(select 1 from jsonb_array_elements_text(e->'reminder_days') d where (e->>'occurrence_date')::date-d::integer<=p_today)),
 'tasks',(select coalesce(jsonb_agg(to_jsonb(t)||jsonb_build_object('contacts',(select jsonb_agg(jsonb_build_object('id',c.id,'name',c.display_name)) from public.task_contacts m join public.contacts c on c.id=m.contact_id where m.task_id=t.id and not c.is_archived)) order by due_date,id),'[]') from public.tasks t where not t.is_completed and t.parent_task_id is null and t.status<>'cancelled' and t.due_date<=p_today and exists(select 1 from public.task_contacts m join public.contacts c on c.id=m.contact_id where m.task_id=t.id and not c.is_archived)),
 'catchups',(select coalesce(jsonb_agg(to_jsonb(c)||jsonb_build_object('last_contact',s.last_contact) order by c.display_name),'[]') from public.contacts c cross join lateral(select max(i.contact_date) last_contact from public.contact_interactions i join public.contact_interaction_members m on m.interaction_id=i.id where m.contact_id=c.id and i.contact_date<=p_today) s where not c.is_archived and c.contact_interval_days is not null and coalesce(s.last_contact,(c.created_at at time zone p_timezone)::date)+c.contact_interval_days<=p_today));
end $$;
-- No anonymous RPC access. Trigger helpers are not client endpoints.
do $$ declare r record; begin
 for r in select p.oid::regprocedure signature,p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname=any(array['canonicalize_contact_relationship','guard_contact_relationship_type','touch_contact_record','contact_require_admin','ensure_contact_defaults','contact_occurrence_date','contact_event_occurrences','list_contacts','get_contact_detail','save_contact_record','delete_contact_record','link_contact_resource','set_contact_occurrence','create_contact_occurrence_task','contact_reminders']) loop
  execute format('revoke all on function %s from public,anon,authenticated',r.signature);
  if r.proname not in ('canonicalize_contact_relationship','guard_contact_relationship_type','touch_contact_record') then execute format('grant execute on function %s to authenticated',r.signature); end if;
 end loop;
end $$;

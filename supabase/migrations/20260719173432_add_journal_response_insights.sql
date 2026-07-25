alter table public.journal_responses
  add column if not exists insight_type text,
  add column if not exists topic_tags text[] not null default '{}',
  add column if not exists insight_marked_at timestamptz,
  add column if not exists insight_is_favorite boolean not null default false;

update public.journal_responses response
set
  insight_type = 'learning',
  topic_tags = coalesce(
    (
      select learning.tags
      from public.journal_learnings learning
      where learning.entry_id = response.entry_id
        and learning.field_id = response.field_id
      order by learning.updated_at desc
      limit 1
    ),
    '{}'
  ),
  insight_marked_at = coalesce(
    (
      select learning.updated_at
      from public.journal_learnings learning
      where learning.entry_id = response.entry_id
        and learning.field_id = response.field_id
      order by learning.updated_at desc
      limit 1
    ),
    response.created_at
  ),
  insight_is_favorite = coalesce(
    (
      select learning.is_favorite
      from public.journal_learnings learning
      where learning.entry_id = response.entry_id
        and learning.field_id = response.field_id
      order by learning.updated_at desc
      limit 1
    ),
    false
  )
where response.insight_type is null
  and exists (
    select 1
    from public.journal_learnings learning
    where learning.entry_id = response.entry_id
      and learning.field_id = response.field_id
  );

alter table public.journal_responses
  drop constraint if exists journal_responses_insight_type_check,
  add constraint journal_responses_insight_type_check
    check (
      insight_type is null
      or insight_type in ('learning', 'problem', 'idea', 'decision')
    ),
  drop constraint if exists journal_responses_topic_tags_limit_check,
  add constraint journal_responses_topic_tags_limit_check
    check (cardinality(topic_tags) <= 5),
  drop constraint if exists journal_responses_unmarked_insight_shape_check,
  add constraint journal_responses_unmarked_insight_shape_check
    check (
      insight_type is not null
      or (
        cardinality(topic_tags) = 0
        and insight_marked_at is null
        and insight_is_favorite = false
      )
    );

create index if not exists journal_responses_insight_type_idx
  on public.journal_responses (insight_type, insight_marked_at desc)
  where insight_type is not null;

create index if not exists journal_responses_topic_tags_idx
  on public.journal_responses using gin (topic_tags);

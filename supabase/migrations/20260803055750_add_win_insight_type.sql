-- Adds "win" as a fifth insight_type alongside learning/problem/idea/decision,
-- so a marked answer can be collected as a personal win instead of only
-- learnings, problems, ideas, and decisions.

alter table public.journal_responses
  drop constraint if exists journal_responses_insight_type_check,
  add constraint journal_responses_insight_type_check
    check (
      insight_type is null
      or insight_type in ('learning', 'problem', 'idea', 'decision', 'win')
    );

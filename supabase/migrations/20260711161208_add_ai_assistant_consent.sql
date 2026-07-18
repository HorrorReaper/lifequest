alter table public.profiles
  add column if not exists ai_assistant_enabled boolean not null default false,
  add column if not exists ai_consent_at timestamptz;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_ai_consent_state_check'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_ai_consent_state_check
      check (
        (ai_assistant_enabled and ai_consent_at is not null)
        or (not ai_assistant_enabled and ai_consent_at is null)
      );
  end if;
end $$;

comment on column public.profiles.ai_assistant_enabled is
  'User-controlled opt-in for sending LifeQuest context to the configured AI provider.';

comment on column public.profiles.ai_consent_at is
  'Timestamp when the user most recently enabled contextual AI processing.';

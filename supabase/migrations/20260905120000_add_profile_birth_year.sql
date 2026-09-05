alter table public.profiles
  add column birth_year smallint
    check (birth_year is null or birth_year between 1900 and 2100);

comment on column public.profiles.birth_year is
  'Derived from the age given during onboarding, so it can be off by one depending on whether the birthday has passed this year. Stored as a year rather than an age so it does not go stale. Null for anyone who onboarded before this was asked.';

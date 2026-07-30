-- Cover every learning foreign key used by deletes and joins.
create index learning_paths_published_version_idx
  on public.learning_paths(published_version_id);

create index learning_path_versions_created_by_idx
  on public.learning_path_versions(created_by);

create index learning_enrollments_path_idx
  on public.learning_enrollments(path_id);

create index learning_enrollments_version_idx
  on public.learning_enrollments(path_version_id);

create index learning_lesson_progress_enrollment_idx
  on public.learning_lesson_progress(enrollment_id);

create index learning_lesson_progress_lesson_idx
  on public.learning_lesson_progress(lesson_id);

create index learning_attempts_enrollment_idx
  on public.learning_attempts(enrollment_id);

create index learning_attempts_lesson_idx
  on public.learning_attempts(lesson_id);

create index learning_exercise_responses_user_idx
  on public.learning_exercise_responses(user_id);

create index learning_exercise_responses_exercise_idx
  on public.learning_exercise_responses(exercise_id);

-- Curriculum tables are intentionally RPC-only. Explicit deny policies make
-- that boundary visible in both schema review and Supabase's security advisor.
create policy "Learning paths require an approved RPC"
  on public.learning_paths
  for all
  to anon, authenticated
  using (false)
  with check (false);

create policy "Learning versions require an approved RPC"
  on public.learning_path_versions
  for all
  to anon, authenticated
  using (false)
  with check (false);

create policy "Learning units require an approved RPC"
  on public.learning_units
  for all
  to anon, authenticated
  using (false)
  with check (false);

create policy "Learning lessons require an approved RPC"
  on public.learning_lessons
  for all
  to anon, authenticated
  using (false)
  with check (false);

create policy "Learning exercises require an approved RPC"
  on public.learning_exercises
  for all
  to anon, authenticated
  using (false)
  with check (false);

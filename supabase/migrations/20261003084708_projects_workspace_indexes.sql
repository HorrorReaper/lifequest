-- Cover owner joins used by the project workspace and use recognizable auth initplans.
create index projects_area_fk_idx on public.projects(area_id,user_id);
create index project_links_owner_idx on public.project_links(user_id);
create index project_links_project_owner_idx on public.project_links(project_id,user_id);
create index tasks_project_owner_idx on public.tasks(project_id,user_id);
create index knowledge_note_projects_owner_idx on public.knowledge_note_projects(user_id);
create index knowledge_note_projects_note_owner_idx on public.knowledge_note_projects(note_id,user_id);
create index knowledge_note_projects_project_owner_idx on public.knowledge_note_projects(project_id,user_id);
create index project_milestones_project_owner_idx on public.project_milestones(project_id,user_id);
alter policy "Admins manage own project areas" on public.project_areas
  using ((select auth.uid())=user_id and ((select auth.jwt())->'app_metadata'->>'role')='admin')
  with check ((select auth.uid())=user_id and ((select auth.jwt())->'app_metadata'->>'role')='admin');
alter policy "Admins manage own project links" on public.project_links
  using ((select auth.uid())=user_id and ((select auth.jwt())->'app_metadata'->>'role')='admin')
  with check ((select auth.uid())=user_id and ((select auth.jwt())->'app_metadata'->>'role')='admin');

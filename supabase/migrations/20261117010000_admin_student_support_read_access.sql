begin;

drop policy if exists "admins read child records" on public.children;
create policy "admins read child records" on public.children
  for select to authenticated
  using (public.has_any_role(array['admin']));

drop policy if exists "admins read student profiles" on public.student_public_profiles;
create policy "admins read student profiles" on public.student_public_profiles
  for select to authenticated
  using (public.has_any_role(array['admin']));

drop policy if exists "admins read student support updates" on public.student_support_updates;
create policy "admins read student support updates" on public.student_support_updates
  for select to authenticated
  using (public.has_any_role(array['admin']));

drop policy if exists "admins read assistance records" on public.assistance_records;
create policy "admins read assistance records" on public.assistance_records
  for select to authenticated
  using (public.has_any_role(array['admin']));

commit;

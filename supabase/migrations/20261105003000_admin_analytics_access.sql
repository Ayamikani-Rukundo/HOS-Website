drop policy if exists "admins read aggregate page views" on public.website_page_views;
create policy "admins read aggregate page views" on public.website_page_views
  for select to authenticated
  using (public.has_any_role(array['admin']));

grant select on public.website_page_views to authenticated;
grant select on public.audit_events to authenticated;

begin;

create table if not exists public.partner_organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  focus_area text,
  logo_url text,
  website_url text,
  is_published boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

create index if not exists idx_partner_organizations_public_sort
  on public.partner_organizations(is_published, archived_at, sort_order, name);

alter table public.partner_organizations enable row level security;
grant select on public.partner_organizations to anon, authenticated;
grant insert, update, delete on public.partner_organizations to authenticated;

drop policy if exists "public can read published partner organizations" on public.partner_organizations;
create policy "public can read published partner organizations" on public.partner_organizations
  for select to anon, authenticated
  using (is_published and archived_at is null);

drop policy if exists "communications and volunteers manage partners" on public.partner_organizations;
create policy "communications and volunteers manage partners" on public.partner_organizations
  for all to authenticated
  using (public.has_any_role(array['admin', 'communications', 'volunteer_manager']))
  with check (public.has_any_role(array['admin', 'communications', 'volunteer_manager']));

drop trigger if exists set_updated_at on public.partner_organizations;
create trigger set_updated_at before update on public.partner_organizations
  for each row execute function public.handle_updated_at();

drop trigger if exists write_audit_event on public.partner_organizations;
create trigger write_audit_event after insert or update or delete on public.partner_organizations
  for each row execute function public.write_audit_event();

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
    and not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'partner_organizations'
    )
  then
    alter publication supabase_realtime add table public.partner_organizations;
  end if;
end $$;

drop policy if exists "volunteer managers upload partner logos" on storage.objects;
create policy "volunteer managers upload partner logos" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'hos-public'
    and name like 'partner-organizations/%'
    and public.has_any_role(array['admin', 'communications', 'volunteer_manager'])
  );

drop policy if exists "volunteer managers delete partner logos" on storage.objects;
create policy "volunteer managers delete partner logos" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'hos-public'
    and name like 'partner-organizations/%'
    and public.has_any_role(array['admin', 'communications', 'volunteer_manager'])
  );

drop table if exists public.project_campaigns;
drop table if exists public.project_events;

alter table public.case_records drop column if exists project_id;
alter table public.assistance_records drop column if exists project_id;
alter table public.volunteer_assignments drop column if exists project_id;

drop table if exists public.projects;
drop table if exists public.impact_metrics;
drop table if exists public.success_stories;

commit;

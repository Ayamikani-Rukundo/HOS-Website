begin;

create table if not exists public.donation_methods (
  id uuid primary key default gen_random_uuid(),
  method_type text not null default 'other'
    check (method_type in ('mobile_money', 'bank_transfer', 'other')),
  label text not null,
  details text not null,
  instructions text,
  is_active boolean not null default true,
  is_public boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.donation_methods enable row level security;
grant select, insert, update, delete on public.donation_methods to authenticated;
grant select on public.donation_methods to anon;

drop policy if exists "public can read active donation methods" on public.donation_methods;
create policy "public can read active donation methods" on public.donation_methods
  for select to anon, authenticated
  using (is_active and is_public);

drop policy if exists "finance manage donation methods" on public.donation_methods;
create policy "finance manage donation methods" on public.donation_methods
  for all to authenticated
  using (public.has_any_role(array['finance']))
  with check (public.has_any_role(array['finance']));

drop policy if exists "fundraising read donation methods" on public.donation_methods;
create policy "fundraising read donation methods" on public.donation_methods
  for select to authenticated
  using (public.has_any_role(array['fundraiser']));

drop trigger if exists set_donation_methods_updated_at on public.donation_methods;
create trigger set_donation_methods_updated_at
  before update on public.donation_methods
  for each row execute function public.handle_updated_at();

drop trigger if exists write_audit_event on public.donation_methods;
create trigger write_audit_event
  after insert or update or delete on public.donation_methods
  for each row execute function public.write_audit_event();

drop policy if exists "fundraisers manage donors" on public.donors;
drop policy if exists "finance staff manage donors" on public.donors;
drop policy if exists "fundraising staff manage donors" on public.donors;
create policy "finance manage donors" on public.donors
  for all to authenticated
  using (public.has_any_role(array['finance']))
  with check (public.has_any_role(array['finance']));
create policy "fundraising read donors" on public.donors
  for select to authenticated
  using (public.has_any_role(array['fundraiser']));

drop policy if exists "fundraising staff manage grant opportunities" on public.grant_opportunities;
drop policy if exists "fundraising manage grant opportunities" on public.grant_opportunities;
create policy "fundraising manage grant opportunities" on public.grant_opportunities
  for all to authenticated
  using (public.has_any_role(array['fundraiser']))
  with check (public.has_any_role(array['fundraiser']));
create policy "finance read grant opportunities" on public.grant_opportunities
  for select to authenticated
  using (public.has_any_role(array['finance']));

drop policy if exists "fundraisers manage campaigns" on public.donation_campaigns;
drop policy if exists "fundraising staff manage campaigns" on public.donation_campaigns;
drop policy if exists "fundraisers manage categories" on public.campaign_categories;
drop policy if exists "fundraising staff manage categories" on public.campaign_categories;
create policy "fundraising manage campaign categories" on public.campaign_categories
  for all to authenticated
  using (public.has_any_role(array['fundraiser']))
  with check (public.has_any_role(array['fundraiser']));
create policy "finance read donation campaigns" on public.donation_campaigns
  for select to authenticated
  using (public.has_any_role(array['finance']));
create policy "fundraising manage donation campaigns" on public.donation_campaigns
  for all to authenticated
  using (public.has_any_role(array['fundraiser']))
  with check (public.has_any_role(array['fundraiser']));
create policy "finance read campaign categories" on public.campaign_categories
  for select to authenticated
  using (public.has_any_role(array['finance']));

drop policy if exists "authorized staff manage student public profiles" on public.student_public_profiles;
create policy "program teams manage student public profiles" on public.student_public_profiles
  for all to authenticated
  using (public.has_any_role(array['program_manager', 'case_worker', 'child_protection', 'education_support', 'health_nutrition']))
  with check (public.has_any_role(array['program_manager', 'case_worker', 'child_protection', 'education_support', 'health_nutrition']));

drop policy if exists "authorized staff manage student support updates" on public.student_support_updates;
create policy "program teams manage student support updates" on public.student_support_updates
  for all to authenticated
  using (public.has_any_role(array['program_manager', 'case_worker', 'child_protection', 'education_support', 'health_nutrition']))
  with check (public.has_any_role(array['program_manager', 'case_worker', 'child_protection', 'education_support', 'health_nutrition']));

drop policy if exists "program managers manage student families" on public.families;
drop policy if exists "case staff manage families" on public.families;
drop policy if exists "authorized case staff manage families" on public.families;
drop policy if exists "program teams manage student families" on public.families;
create policy "program teams manage student families" on public.families
  for all to authenticated
  using (public.has_any_role(array['program_manager', 'case_worker', 'child_protection', 'education_support', 'health_nutrition']))
  with check (public.has_any_role(array['program_manager', 'case_worker', 'child_protection', 'education_support', 'health_nutrition']));

drop policy if exists "program managers manage students" on public.children;
drop policy if exists "case staff manage children" on public.children;
drop policy if exists "authorized case staff manage children" on public.children;
drop policy if exists "program teams manage students" on public.children;
create policy "program teams manage students" on public.children
  for all to authenticated
  using (public.has_any_role(array['program_manager', 'case_worker', 'child_protection', 'education_support', 'health_nutrition']))
  with check (public.has_any_role(array['program_manager', 'case_worker', 'child_protection', 'education_support', 'health_nutrition']));

drop policy if exists "program managers read student assistance history" on public.assistance_records;
drop policy if exists "case staff manage assistance" on public.assistance_records;
drop policy if exists "authorized program staff manage assistance" on public.assistance_records;
drop policy if exists "program teams manage student assistance history" on public.assistance_records;
create policy "program teams manage student assistance history" on public.assistance_records
  for all to authenticated
  using (public.has_any_role(array['program_manager', 'case_worker', 'child_protection', 'education_support', 'health_nutrition']))
  with check (public.has_any_role(array['program_manager', 'case_worker', 'child_protection', 'education_support', 'health_nutrition']));

drop policy if exists "case staff manage cases" on public.case_records;
drop policy if exists "authorized case staff manage cases" on public.case_records;
drop policy if exists "case staff manage case notes" on public.case_notes;
drop policy if exists "authorized case staff manage case notes" on public.case_notes;

create or replace function public.get_admin_portal_metrics()
returns table (portal_key text, table_name text, record_count bigint)
language plpgsql
security definer
set search_path = ''
as $$
declare
  metric record;
begin
  if auth.uid() is null or not public.has_any_role(array['admin']) then
    raise exception 'Only administrators can view organization-wide portal metrics.';
  end if;

  for metric in
    select * from (values
      ('communications', 'organizations'),
      ('communications', 'website_sections'),
      ('communications', 'team_members'),
      ('communications', 'programs'),
      ('communications', 'partner_organizations'),
      ('communications', 'events'),
      ('communications', 'announcements'),
      ('communications', 'galleries'),
      ('communications', 'contact_messages'),
      ('communications', 'newsletter_subscribers'),
      ('secretariat', 'secretariat_documents'),
      ('secretariat', 'volunteer_applications'),
      ('secretariat', 'volunteers'),
      ('secretariat', 'contact_details'),
      ('secretariat', 'social_links'),
      ('volunteer_management', 'volunteers'),
      ('volunteer_management', 'volunteer_applications'),
      ('volunteer_management', 'partner_organizations'),
      ('finance', 'donations'),
      ('finance', 'donors'),
      ('finance', 'finance_transactions'),
      ('finance', 'donation_methods'),
      ('programs', 'families'),
      ('programs', 'children'),
      ('programs', 'student_support_updates'),
      ('programs', 'assistance_records'),
      ('programs', 'programs'),
      ('fundraising', 'campaign_categories'),
      ('fundraising', 'donation_campaigns'),
      ('fundraising', 'grant_opportunities')
    ) as metrics(portal_name, table_name)
  loop
    execute format('select count(*)::bigint from public.%I', metric.table_name)
      into record_count;
    portal_key := metric.portal_name;
    table_name := metric.table_name;
    return next;
  end loop;
end;
$$;

revoke all on function public.get_admin_portal_metrics() from public, anon;
grant execute on function public.get_admin_portal_metrics() to authenticated;

create or replace function public.delete_audit_events_by_ids(p_event_ids uuid[])
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  removed_count integer;
begin
  if auth.uid() is null or not public.has_any_role(array['admin']) then
    raise exception 'Only administrators can remove audit history.';
  end if;
  if p_event_ids is null or cardinality(p_event_ids) = 0 then
    raise exception 'Select at least one audit entry.';
  end if;

  delete from public.audit_events
  where id = any(p_event_ids);
  get diagnostics removed_count = row_count;

  insert into public.audit_events (table_name, action, actor_id)
  values ('audit_events', 'DELETE_SELECTED', auth.uid());

  return removed_count;
end;
$$;

revoke all on function public.delete_audit_events_by_ids(uuid[]) from public, anon;
grant execute on function public.delete_audit_events_by_ids(uuid[]) to authenticated;

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'donation_methods') then
    alter publication supabase_realtime add table public.donation_methods;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'audit_events') then
    alter publication supabase_realtime add table public.audit_events;
  end if;
end
$$;

commit;

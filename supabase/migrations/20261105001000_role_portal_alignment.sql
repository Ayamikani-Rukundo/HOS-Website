begin;

create table if not exists public.grant_opportunities (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  funder_name text not null,
  status text not null default 'researching'
    check (status in ('researching', 'planned', 'in_progress', 'submitted', 'awarded', 'declined', 'archived')),
  focus_area text,
  amount numeric(12, 2),
  currency_code text not null default 'RWF',
  deadline date,
  application_url text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

alter table public.grant_opportunities enable row level security;
grant select, insert, update, delete on public.grant_opportunities to authenticated;

drop policy if exists "fundraising staff manage grant opportunities" on public.grant_opportunities;
create policy "fundraising staff manage grant opportunities" on public.grant_opportunities
  for all to authenticated
  using (public.has_any_role(array['fundraiser']))
  with check (public.has_any_role(array['fundraiser']));

drop trigger if exists set_updated_at on public.grant_opportunities;
create trigger set_updated_at before update on public.grant_opportunities
  for each row execute function public.handle_updated_at();

drop trigger if exists write_audit_event on public.grant_opportunities;
create trigger write_audit_event after insert or update or delete on public.grant_opportunities
  for each row execute function public.write_audit_event();

create or replace function public.get_staff_directory()
returns table (
  user_id uuid,
  email text,
  full_name text,
  roles text[],
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    accounts.id,
    accounts.email::text,
    profiles.full_name,
    coalesce(array_agg(distinct roles.role_name) filter (where roles.role_name is not null), array[]::text[]),
    accounts.created_at
  from auth.users as accounts
  left join public.profiles as profiles on profiles.id = accounts.id
  left join public.user_roles as roles on roles.user_id = accounts.id
  where public.has_any_role(array['admin'])
  group by accounts.id, accounts.email, profiles.full_name, accounts.created_at
  order by accounts.created_at desc
$$;

revoke all on function public.get_staff_directory() from public, anon;
grant execute on function public.get_staff_directory() to authenticated;

drop policy if exists "program managers manage programs" on public.programs;
create policy "communications manage public programs" on public.programs
  for all to authenticated
  using (public.has_any_role(array['admin', 'communications']))
  with check (public.has_any_role(array['admin', 'communications']));

drop policy if exists "authorized staff manage projects" on public.projects;
drop policy if exists "program staff manage projects" on public.projects;
drop policy if exists "management read projects" on public.projects;
create policy "program managers manage projects" on public.projects
  for all to authenticated
  using (public.has_any_role(array['admin', 'program_manager']))
  with check (public.has_any_role(array['admin', 'program_manager']));

drop policy if exists "authorized communications manage events" on public.events;
drop policy if exists "event managers manage events" on public.events;
create policy "communications manage events" on public.events
  for all to authenticated
  using (public.has_any_role(array['admin', 'communications']))
  with check (public.has_any_role(array['admin', 'communications']));

drop policy if exists "authorized communications manage announcements" on public.announcements;
drop policy if exists "communications manage announcements" on public.announcements;
create policy "communications manage announcements" on public.announcements
  for all to authenticated
  using (public.has_any_role(array['admin', 'communications']))
  with check (public.has_any_role(array['admin', 'communications']));

drop policy if exists "team managers manage team years" on public.team_years;
create policy "communications manage team years" on public.team_years
  for all to authenticated
  using (public.has_any_role(array['admin', 'communications']))
  with check (public.has_any_role(array['admin', 'communications']));

drop policy if exists "team managers manage members" on public.team_members;
create policy "communications manage team members" on public.team_members
  for all to authenticated
  using (public.has_any_role(array['admin', 'communications']))
  with check (public.has_any_role(array['admin', 'communications']));

drop policy if exists "fundraisers manage categories" on public.campaign_categories;
drop policy if exists "fundraising staff manage categories" on public.campaign_categories;
create policy "fundraisers manage categories" on public.campaign_categories
  for all to authenticated
  using (public.has_any_role(array['admin', 'fundraiser']))
  with check (public.has_any_role(array['admin', 'fundraiser']));

drop policy if exists "fundraisers manage campaigns" on public.donation_campaigns;
drop policy if exists "fundraising staff manage campaigns" on public.donation_campaigns;
create policy "fundraisers manage campaigns" on public.donation_campaigns
  for all to authenticated
  using (public.has_any_role(array['admin', 'fundraiser']))
  with check (public.has_any_role(array['admin', 'fundraiser']));
drop policy if exists "finance and management read campaigns" on public.donation_campaigns;

drop policy if exists "communications manage gallery" on public.galleries;
create policy "communications manage gallery" on public.galleries
  for all to authenticated
  using (public.has_any_role(array['admin', 'communications']))
  with check (public.has_any_role(array['admin', 'communications']));

drop policy if exists "admins manage contact details" on public.contact_details;
create policy "communications manage contact details" on public.contact_details
  for all to authenticated
  using (public.has_any_role(array['admin', 'communications']))
  with check (public.has_any_role(array['admin', 'communications']));

drop policy if exists "admins manage social links" on public.social_links;
create policy "communications manage social links" on public.social_links
  for all to authenticated
  using (public.has_any_role(array['admin', 'communications']))
  with check (public.has_any_role(array['admin', 'communications']));

drop policy if exists "admins manage organization" on public.organizations;
create policy "communications manage organization profile" on public.organizations
  for all to authenticated
  using (public.has_any_role(array['admin', 'communications']))
  with check (public.has_any_role(array['admin', 'communications']));

drop policy if exists "admins manage website sections" on public.website_sections;
create policy "communications manage website sections" on public.website_sections
  for all to authenticated
  using (public.has_any_role(array['admin', 'communications']))
  with check (public.has_any_role(array['admin', 'communications']));

drop policy if exists "communications manage impact metrics" on public.impact_metrics;
create policy "communications manage impact metrics" on public.impact_metrics
  for all to authenticated
  using (public.has_any_role(array['admin', 'communications']))
  with check (public.has_any_role(array['admin', 'communications']));

drop policy if exists "communications manage success stories" on public.success_stories;
create policy "communications manage success stories" on public.success_stories
  for all to authenticated
  using (public.has_any_role(array['admin', 'communications']))
  with check (public.has_any_role(array['admin', 'communications']));

drop policy if exists "fundraising staff manage donors" on public.donors;
create policy "fundraisers manage donors" on public.donors
  for all to authenticated
  using (public.has_any_role(array['admin', 'fundraiser']))
  with check (public.has_any_role(array['admin', 'fundraiser']));

drop policy if exists "authorized case staff manage families" on public.families;
create policy "case staff manage families" on public.families
  for all to authenticated
  using (public.has_any_role(array['admin', 'case_worker', 'child_protection', 'education_support', 'health_nutrition']))
  with check (public.has_any_role(array['admin', 'case_worker', 'child_protection', 'education_support', 'health_nutrition']));

drop policy if exists "authorized case staff manage children" on public.children;
create policy "case staff manage children" on public.children
  for all to authenticated
  using (public.has_any_role(array['admin', 'case_worker', 'child_protection', 'education_support', 'health_nutrition']))
  with check (public.has_any_role(array['admin', 'case_worker', 'child_protection', 'education_support', 'health_nutrition']));

drop policy if exists "authorized case staff manage cases" on public.case_records;
create policy "case staff manage cases" on public.case_records
  for all to authenticated
  using (public.has_any_role(array['admin', 'case_worker', 'child_protection', 'education_support', 'health_nutrition']))
  with check (public.has_any_role(array['admin', 'case_worker', 'child_protection', 'education_support', 'health_nutrition']));

drop policy if exists "authorized case staff manage case notes" on public.case_notes;
create policy "case staff manage case notes" on public.case_notes
  for all to authenticated
  using (
    public.has_any_role(array['admin', 'case_worker', 'child_protection', 'education_support', 'health_nutrition'])
    and (visibility = 'internal' or public.has_any_role(array['admin', 'case_worker']))
  )
  with check (
    public.has_any_role(array['admin', 'case_worker', 'child_protection', 'education_support', 'health_nutrition'])
    and (visibility = 'internal' or public.has_any_role(array['admin', 'case_worker']))
  );

drop policy if exists "authorized program staff manage assistance" on public.assistance_records;
create policy "case staff manage assistance" on public.assistance_records
  for all to authenticated
  using (public.has_any_role(array['admin', 'case_worker', 'child_protection', 'education_support', 'health_nutrition']))
  with check (public.has_any_role(array['admin', 'case_worker', 'child_protection', 'education_support', 'health_nutrition']));

drop policy if exists "management read project campaigns" on public.project_campaigns;
drop policy if exists "management read project events" on public.project_events;
drop policy if exists "authorized staff manage project campaigns" on public.project_campaigns;
create policy "program and fundraising staff manage project campaigns" on public.project_campaigns
  for all to authenticated
  using (public.has_any_role(array['admin', 'program_manager', 'fundraiser']))
  with check (public.has_any_role(array['admin', 'program_manager', 'fundraiser']));
drop policy if exists "authorized staff manage project events" on public.project_events;
create policy "program and communications staff manage project events" on public.project_events
  for all to authenticated
  using (public.has_any_role(array['admin', 'program_manager', 'communications']))
  with check (public.has_any_role(array['admin', 'program_manager', 'communications']));
drop policy if exists "management read secretariat documents" on public.secretariat_documents;
drop policy if exists "management read department updates" on public.department_updates;
drop policy if exists "management read aggregate page views" on public.website_page_views;
drop policy if exists "management read audit events" on public.audit_events;
drop policy if exists "admins read audit events" on public.audit_events;
drop policy if exists "staff manage own department updates" on public.department_updates;
create policy "program managers and secretariat manage department updates" on public.department_updates
  for all to authenticated
  using (public.has_any_role(array['admin', 'program_manager', 'secretariat']))
  with check (public.has_any_role(array['admin', 'program_manager', 'secretariat']));
create policy "admins read audit events" on public.audit_events
  for select to authenticated
  using (public.has_any_role(array['admin']));

drop policy if exists "secretariat staff manage documents" on public.secretariat_documents;
create policy "secretariat staff manage documents" on public.secretariat_documents
  for all to authenticated
  using (public.has_any_role(array['admin', 'secretariat']))
  with check (public.has_any_role(array['admin', 'secretariat']));

drop policy if exists "volunteer managers manage applications" on public.volunteer_applications;
drop policy if exists "secretariat staff manage volunteer applications" on public.volunteer_applications;
create policy "volunteer managers manage applications" on public.volunteer_applications
  for all to authenticated
  using (public.has_any_role(array['admin', 'volunteer_manager', 'hr']))
  with check (public.has_any_role(array['admin', 'volunteer_manager', 'hr']));

drop policy if exists "volunteer managers manage volunteers" on public.volunteers;
drop policy if exists "secretariat staff manage volunteers" on public.volunteers;
create policy "volunteer managers manage volunteers" on public.volunteers
  for all to authenticated
  using (public.has_any_role(array['admin', 'volunteer_manager', 'hr']))
  with check (public.has_any_role(array['admin', 'volunteer_manager', 'hr']));

drop policy if exists "volunteer managers manage assignments" on public.volunteer_assignments;
drop policy if exists "secretariat staff manage volunteer assignments" on public.volunteer_assignments;
create policy "volunteer managers manage assignments" on public.volunteer_assignments
  for all to authenticated
  using (public.has_any_role(array['admin', 'volunteer_manager']))
  with check (public.has_any_role(array['admin', 'volunteer_manager']));

commit;

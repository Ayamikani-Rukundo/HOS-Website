begin;

alter table public.user_roles drop constraint if exists user_roles_role_name_check;
alter table public.user_roles
  add constraint user_roles_role_name_check
  check (role_name in (
    'admin', 'director', 'management', 'it_data', 'communications',
    'secretariat', 'program_manager', 'case_worker', 'child_protection',
    'education_support', 'health_nutrition', 'finance', 'fundraiser',
    'volunteer_manager', 'advocacy_lead', 'hr', 'staff'
  ));

create table if not exists public.advocacy_campaigns (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 2 and 200),
  focus_area text not null check (char_length(focus_area) between 2 and 160),
  summary text not null check (char_length(summary) between 2 and 6000),
  starts_at timestamptz not null,
  ends_at timestamptz,
  location text not null check (char_length(location) between 2 and 240),
  cover_image_url text,
  status text not null default 'draft' check (status in ('draft', 'published', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  check (ends_at is null or ends_at >= starts_at)
);


create index if not exists idx_advocacy_campaigns_public_schedule
  on public.advocacy_campaigns(starts_at)
  where status = 'published' and archived_at is null;

alter table public.advocacy_campaigns enable row level security;
grant select on public.advocacy_campaigns to anon, authenticated;
grant insert, update, delete on public.advocacy_campaigns to authenticated;

drop policy if exists "public can read published advocacy campaigns" on public.advocacy_campaigns;
create policy "public can read published advocacy campaigns" on public.advocacy_campaigns
  for select to anon, authenticated
  using (status = 'published' and archived_at is null);

drop policy if exists "advocacy leads manage advocacy campaigns" on public.advocacy_campaigns;
create policy "advocacy leads manage advocacy campaigns" on public.advocacy_campaigns
  for all to authenticated
  using (public.has_any_role(array['admin', 'advocacy_lead']))
  with check (public.has_any_role(array['admin', 'advocacy_lead']));

drop trigger if exists set_advocacy_campaigns_updated_at on public.advocacy_campaigns;
create trigger set_advocacy_campaigns_updated_at
  before update on public.advocacy_campaigns
  for each row execute function public.handle_updated_at();

drop trigger if exists write_audit_event on public.advocacy_campaigns;
create trigger write_audit_event
  after insert or update or delete on public.advocacy_campaigns
  for each row execute function public.write_audit_event();

drop policy if exists "authorized communications manage events" on public.events;
drop policy if exists "event managers manage events" on public.events;
drop policy if exists "communications manage events" on public.events;
create policy "advocacy leads manage events" on public.events
  for all to authenticated
  using (public.has_any_role(array['admin', 'advocacy_lead']))
  with check (public.has_any_role(array['admin', 'advocacy_lead']));

drop policy if exists "authorized communications manage announcements" on public.announcements;
drop policy if exists "communications manage announcements" on public.announcements;
create policy "advocacy leads manage announcements" on public.announcements
  for all to authenticated
  using (public.has_any_role(array['admin', 'advocacy_lead']))
  with check (public.has_any_role(array['admin', 'advocacy_lead']));

drop policy if exists "authorized staff upload public HOS media" on storage.objects;
create policy "authorized staff upload public HOS media" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'hos-public'
    and (
      public.has_any_role(array['admin', 'director'])
      or (
        public.has_any_role(array['communications'])
        and (
          name like 'team-members/%'
          or name like 'galleries/%'
          or name like 'programs/%'
          or name like 'partner-organizations/%'
          or name like 'partner_organizations/%'
        )
      )
      or (
        name like 'student-profiles/%/%'
        and public.has_any_role(array[
          'program_manager',
          'case_worker',
          'child_protection',
          'education_support',
          'health_nutrition'
        ])
        and exists (
          select 1
          from public.student_public_profiles as profiles
          where profiles.id::text = split_part(name, '/', 2)
            and profiles.is_published
        )
      )
    )
  );

drop policy if exists "authorized staff update public HOS media" on storage.objects;
create policy "authorized staff update public HOS media" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'hos-public'
    and (
      public.has_any_role(array['admin', 'director'])
      or (
        public.has_any_role(array['communications'])
        and (
          name like 'team-members/%'
          or name like 'galleries/%'
          or name like 'programs/%'
          or name like 'partner-organizations/%'
          or name like 'partner_organizations/%'
        )
      )
      or (
        name like 'student-profiles/%/%'
        and public.has_any_role(array[
          'program_manager',
          'case_worker',
          'child_protection',
          'education_support',
          'health_nutrition'
        ])
      )
    )
  )
  with check (
    bucket_id = 'hos-public'
    and (
      public.has_any_role(array['admin', 'director'])
      or (
        public.has_any_role(array['communications'])
        and (
          name like 'team-members/%'
          or name like 'galleries/%'
          or name like 'programs/%'
          or name like 'partner-organizations/%'
          or name like 'partner_organizations/%'
        )
      )
      or (
        name like 'student-profiles/%/%'
        and public.has_any_role(array[
          'program_manager',
          'case_worker',
          'child_protection',
          'education_support',
          'health_nutrition'
        ])
      )
    )
  );

drop policy if exists "authorized staff delete public HOS media" on storage.objects;
create policy "authorized staff delete public HOS media" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'hos-public'
    and (
      public.has_any_role(array['admin', 'director'])
      or (
        public.has_any_role(array['communications'])
        and (
          name like 'team-members/%'
          or name like 'galleries/%'
          or name like 'programs/%'
          or name like 'partner-organizations/%'
          or name like 'partner_organizations/%'
        )
      )
      or (
        name like 'student-profiles/%/%'
        and public.has_any_role(array[
          'program_manager',
          'case_worker',
          'child_protection',
          'education_support',
          'health_nutrition'
        ])
      )
    )
  );

drop policy if exists "advocacy staff upload public event media" on storage.objects;
create policy "advocacy staff upload public event media" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'hos-public'
    and (
      name like 'events/%'
      or name like 'announcements/%'
      or name like 'advocacy-campaigns/%'
    )
    and public.has_any_role(array['admin', 'advocacy_lead'])
  );

drop policy if exists "advocacy staff update public event media" on storage.objects;
create policy "advocacy staff update public event media" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'hos-public'
    and (
      name like 'events/%'
      or name like 'announcements/%'
      or name like 'advocacy-campaigns/%'
    )
    and public.has_any_role(array['admin', 'advocacy_lead'])
  )
  with check (
    bucket_id = 'hos-public'
    and (
      name like 'events/%'
      or name like 'announcements/%'
      or name like 'advocacy-campaigns/%'
    )
    and public.has_any_role(array['admin', 'advocacy_lead'])
  );

drop policy if exists "advocacy staff delete public event media" on storage.objects;
create policy "advocacy staff delete public event media" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'hos-public'
    and (
      name like 'events/%'
      or name like 'announcements/%'
      or name like 'advocacy-campaigns/%'
    )
    and public.has_any_role(array['admin', 'advocacy_lead'])
  );

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
      ('communications', 'organizations', 'true'),
      ('communications', 'website_sections', 'is_published = true'),
      ('communications', 'team_years', 'is_published = true'),
      ('communications', 'team_members', 'is_published = true and status = ''active'''),
      ('communications', 'programs', 'is_published = true'),
      ('communications', 'partner_organizations', 'archived_at is null'),
      ('communications', 'galleries', 'archived_at is null'),
      ('communications', 'contact_details', 'archived_at is null'),
      ('communications', 'social_links', 'archived_at is null'),
      ('communications', 'contact_messages', 'true'),
      ('communications', 'newsletter_subscribers', 'is_confirmed = true and unsubscribed_at is null'),
      ('secretariat', 'secretariat_documents', 'archived_at is null'),
      ('volunteer_management', 'volunteer_applications', 'true'),
      ('volunteer_management', 'volunteers', 'status <> ''inactive'''),
      ('volunteer_management', 'volunteer_assignments', 'status <> ''cancelled'''),
      ('volunteer_management', 'partner_organizations', 'archived_at is null'),
      ('volunteer_management', 'contact_details', 'archived_at is null'),
      ('volunteer_management', 'social_links', 'archived_at is null'),
      ('volunteer_management', 'contact_messages', 'true'),
      ('volunteer_management', 'newsletter_subscribers', 'is_confirmed = true and unsubscribed_at is null'),
      ('finance', 'donations', 'true'),
      ('finance', 'donors', 'true'),
      ('finance', 'finance_transactions', 'archived_at is null'),
      ('finance', 'donation_methods', 'is_active = true'),
      ('finance', 'grant_opportunities', 'archived_at is null and status <> ''archived'''),
      ('programs', 'programs', 'is_published = true'),
      ('programs', 'families', 'status <> ''closed'''),
      ('programs', 'children', 'status <> ''closed'''),
      ('programs', 'student_support_updates', 'true'),
      ('programs', 'assistance_records', 'true'),
      ('fundraising', 'donation_campaigns', 'archived_at is null'),
      ('fundraising', 'donors', 'true'),
      ('fundraising', 'donation_methods', 'is_active = true'),
      ('fundraising', 'grant_opportunities', 'archived_at is null and status <> ''archived'''),
      ('advocacy', 'events', 'is_published = true and status = ''published'' and archived_at is null'),
      ('advocacy', 'announcements', 'is_published = true and status = ''published'' and audience = ''public'' and archived_at is null'),
      ('advocacy', 'advocacy_campaigns', 'status = ''published'' and archived_at is null')
    ) as metrics(portal_name, table_name, filter_sql)
  loop
    execute format('select count(*)::bigint from public.%I where %s', metric.table_name, metric.filter_sql)
      into record_count;
    portal_key := metric.portal_name;
    table_name := metric.table_name;
    return next;
  end loop;
end;
$$;

revoke all on function public.get_admin_portal_metrics() from public, anon;
grant execute on function public.get_admin_portal_metrics() to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
    and not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'advocacy_campaigns'
    )
  then
    alter publication supabase_realtime add table public.advocacy_campaigns;
  end if;
end
$$;

commit;

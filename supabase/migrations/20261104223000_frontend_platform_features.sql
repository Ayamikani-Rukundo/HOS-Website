begin;

alter table public.user_roles drop constraint if exists user_roles_role_name_check;
alter table public.user_roles
  add constraint user_roles_role_name_check
  check (role_name in (
    'admin', 'director', 'management', 'it_data', 'communications',
    'secretariat', 'program_manager', 'case_worker', 'child_protection',
    'education_support', 'health_nutrition', 'finance', 'fundraiser',
    'volunteer_manager', 'hr', 'staff'
  ));

alter table public.profiles
  add column if not exists job_title text,
  add column if not exists last_seen_at timestamptz;

alter table public.team_members
  add column if not exists biography text,
  add column if not exists status text not null default 'active'
    check (status in ('active', 'inactive', 'archived'));

alter table public.programs
  add column if not exists description text,
  add column if not exists additional_images jsonb not null default '[]'::jsonb,
  add column if not exists objectives jsonb not null default '[]'::jsonb;

alter table public.projects
  add column if not exists completed_at date,
  add column if not exists cover_image_url text,
  add column if not exists outcome_summary text,
  add column if not exists archived_at timestamptz;

alter table public.events
  add column if not exists cover_image_url text,
  add column if not exists starts_at timestamptz,
  add column if not exists ends_at timestamptz,
  add column if not exists published_at timestamptz,
  add column if not exists status text not null default 'draft'
    check (status in ('draft', 'published', 'cancelled', 'archived')),
  add column if not exists notify_subscribers boolean not null default false,
  add column if not exists archived_at timestamptz;

alter table public.events
  drop constraint if exists events_end_after_start,
  add constraint events_end_after_start check (ends_at is null or starts_at is null or ends_at >= starts_at);

alter table public.announcements
  add column if not exists cover_image_url text,
  add column if not exists expires_at timestamptz,
  add column if not exists status text not null default 'published'
    check (status in ('draft', 'published', 'archived')),
  add column if not exists notify_subscribers boolean not null default false,
  add column if not exists archived_at timestamptz;

alter table public.announcements
  drop constraint if exists announcements_expiry_after_publish,
  add constraint announcements_expiry_after_publish check (expires_at is null or expires_at >= published_at);

alter table public.campaign_categories
  add column if not exists sort_order integer not null default 0,
  add column if not exists is_published boolean not null default true,
  add column if not exists icon text,
  add column if not exists archived_at timestamptz;

alter table public.donation_campaigns
  add column if not exists sort_order integer not null default 0,
  add column if not exists donation_instructions text,
  add column if not exists suggested_amounts jsonb not null default '[]'::jsonb,
  add column if not exists payment_methods jsonb not null default '[]'::jsonb,
  add column if not exists archived_at timestamptz;

alter table public.donation_campaigns
  drop constraint if exists campaign_amounts_nonnegative,
  add constraint campaign_amounts_nonnegative check (
    coalesce(target_amount, 0) >= 0 and coalesce(raised_amount, 0) >= 0
  );

alter table public.galleries
  add column if not exists description text,
  add column if not exists collection_name text,
  add column if not exists activity_date date,
  add column if not exists archived_at timestamptz;

alter table public.contact_details
  add column if not exists archived_at timestamptz;

alter table public.social_links
  add column if not exists sort_order integer not null default 0,
  add column if not exists archived_at timestamptz;

alter table public.website_sections
  add column if not exists is_published boolean not null default true;

alter table public.newsletter_subscribers
  add column if not exists unsubscribe_token_hash text,
  add column if not exists consented_at timestamptz not null default now(),
  add column if not exists source text not null default 'website';

create unique index if not exists idx_newsletter_unsubscribe_token_hash
  on public.newsletter_subscribers(unsubscribe_token_hash)
  where unsubscribe_token_hash is not null;

drop policy if exists "public can subscribe" on public.newsletter_subscribers;
revoke insert on public.newsletter_subscribers from anon, authenticated;

drop function if exists public.subscribe_newsletter(text, text, text);
create or replace function public.subscribe_newsletter(
  p_email text,
  p_token_hash text,
  p_source text,
  p_consented boolean
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_email is null
    or char_length(p_email) not between 5 and 254
    or p_email !~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$'
    or p_token_hash is null
    or p_token_hash !~ '^[a-f0-9]{64}$'
    or p_source is null
    or char_length(p_source) not between 1 and 200
    or p_consented is not true then
    return false;
  end if;

  insert into public.newsletter_subscribers (
    email, is_confirmed, unsubscribe_token_hash, consented_at, source, unsubscribed_at
  )
  values (
    lower(trim(p_email)), false, p_token_hash, now(), p_source, null
  )
  on conflict (email) do update
    set is_confirmed = false,
        unsubscribe_token_hash = excluded.unsubscribe_token_hash,
        consented_at = excluded.consented_at,
        source = excluded.source,
        unsubscribed_at = null;
  return true;
end;
$$;

create or replace function public.unsubscribe_newsletter(p_token_hash text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_token_hash is null or p_token_hash !~ '^[a-f0-9]{64}$' then
    return false;
  end if;

  update public.newsletter_subscribers
  set unsubscribed_at = coalesce(unsubscribed_at, now())
  where unsubscribe_token_hash = p_token_hash;
  return found;
end;
$$;

revoke all on function public.subscribe_newsletter(text, text, text, boolean) from public;
revoke all on function public.unsubscribe_newsletter(text) from public;
grant execute on function public.subscribe_newsletter(text, text, text, boolean) to anon, authenticated;
grant execute on function public.unsubscribe_newsletter(text) to anon, authenticated;

create table if not exists public.project_campaigns (
  project_id uuid not null references public.projects(id) on delete cascade,
  campaign_id uuid not null references public.donation_campaigns(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (project_id, campaign_id)
);

create table if not exists public.project_events (
  project_id uuid not null references public.projects(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (project_id, event_id)
);

create table if not exists public.email_notification_jobs (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references public.events(id) on delete set null,
  announcement_id uuid references public.announcements(id) on delete set null,
  notification_type text not null check (notification_type in ('event', 'announcement')),
  status text not null default 'queued' check (status in ('queued', 'processing', 'sent', 'partial', 'failed', 'cancelled')),
  recipient_count integer not null default 0,
  sent_count integer not null default 0,
  failed_count integer not null default 0,
  provider text,
  provider_batch_id text,
  error_summary text,
  requested_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  check ((event_id is not null)::integer + (announcement_id is not null)::integer = 1),
  unique (event_id),
  unique (announcement_id)
);

create table if not exists public.email_notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.email_notification_jobs(id) on delete cascade,
  subscriber_id uuid references public.newsletter_subscribers(id) on delete set null,
  recipient_hash text not null,
  status text not null default 'queued' check (status in ('queued', 'sent', 'delivered', 'bounced', 'failed', 'skipped')),
  provider_message_id text,
  error_message text,
  attempted_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  unique (job_id, recipient_hash)
);

create table if not exists public.secretariat_documents (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 2 and 200),
  document_type text not null default 'note'
    check (document_type in ('note', 'meeting_minutes', 'memo', 'report')),
  body jsonb not null default '{}'::jsonb,
  meeting_date date,
  status text not null default 'draft' check (status in ('draft', 'final', 'archived')),
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

create table if not exists public.department_updates (
  id uuid primary key default gen_random_uuid(),
  department text not null,
  period_start date not null,
  period_end date not null,
  summary text not null,
  progress jsonb not null default '{}'::jsonb,
  status text not null default 'submitted'
    check (status in ('draft', 'submitted', 'reviewed', 'archived')),
  submitted_by uuid references public.profiles(id) on delete set null,
  reviewed_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (period_end >= period_start)
);

create table if not exists public.website_page_views (
  id bigint generated always as identity primary key,
  page_path text not null check (char_length(page_path) between 1 and 200),
  referrer_host text,
  country_code text,
  created_at timestamptz not null default now()
);

create table if not exists public.notification_preferences (
  id uuid primary key default gen_random_uuid(),
  setting_key text not null unique,
  enabled boolean not null default false,
  provider text,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

create index if not exists idx_projects_status_start on public.projects(status, start_date);
create index if not exists idx_events_published_date on public.events(is_published, event_date);
create index if not exists idx_announcements_public_date on public.announcements(is_published, published_at desc);
create index if not exists idx_campaigns_order on public.donation_campaigns(is_published, sort_order);
create index if not exists idx_gallery_collection_order on public.galleries(collection_name, sort_order);
create index if not exists idx_documents_type_updated on public.secretariat_documents(document_type, updated_at desc);
create index if not exists idx_department_updates_period on public.department_updates(department, period_end desc);
create index if not exists idx_page_views_date_path on public.website_page_views(created_at desc, page_path);
create index if not exists idx_email_jobs_status on public.email_notification_jobs(status, created_at);

create or replace function public.write_audit_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  affected_id uuid;
  row_before jsonb;
  row_after jsonb;
begin
  if tg_op = 'DELETE' then
    row_before := to_jsonb(old);
    affected_id := (row_before ->> 'id')::uuid;
  else
    row_after := to_jsonb(new);
    affected_id := (row_after ->> 'id')::uuid;
  end if;

  if tg_op = 'UPDATE' then
    row_before := to_jsonb(old);
    row_after := to_jsonb(new);
  end if;

  insert into public.audit_events (table_name, record_id, action, actor_id, changes)
  values (
    tg_table_name,
    affected_id,
    tg_op,
    auth.uid(),
    jsonb_build_object(
      'before_fields', coalesce(
        (select jsonb_agg(key order by key) from jsonb_object_keys(row_before) as keys(key)),
        '[]'::jsonb
      ),
      'after_fields', coalesce(
        (select jsonb_agg(key order by key) from jsonb_object_keys(row_after) as keys(key)),
        '[]'::jsonb
      )
    )
  );

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

alter table public.audit_events
  add column if not exists changes jsonb not null default '{}'::jsonb;

create or replace function public.has_any_role(required_roles text[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = auth.uid()
      and role_name = any(required_roles)
  );
$$;

drop policy if exists "public can read website sections" on public.website_sections;
create policy "public can read published website sections" on public.website_sections
  for select to anon, authenticated using (is_published);

drop policy if exists "authorized communications manage events" on public.events;
drop policy if exists "event managers manage events" on public.events;
create policy "authorized communications manage events" on public.events
  for all to authenticated
  using (public.has_any_role(array['admin', 'it_data', 'communications', 'volunteer_manager']))
  with check (public.has_any_role(array['admin', 'it_data', 'communications', 'volunteer_manager']));

drop policy if exists "authorized communications manage announcements" on public.announcements;
drop policy if exists "communications manage announcements" on public.announcements;
create policy "authorized communications manage announcements" on public.announcements
  for all to authenticated
  using (public.has_any_role(array['admin', 'it_data', 'communications']))
  with check (public.has_any_role(array['admin', 'it_data', 'communications']));

drop policy if exists "team managers manage team years" on public.team_years;
create policy "team managers manage team years" on public.team_years
  for all to authenticated
  using (public.has_any_role(array['admin', 'it_data', 'communications', 'hr']))
  with check (public.has_any_role(array['admin', 'it_data', 'communications', 'hr']));
drop policy if exists "team managers manage members" on public.team_members;
create policy "team managers manage members" on public.team_members
  for all to authenticated
  using (public.has_any_role(array['admin', 'it_data', 'communications', 'hr']))
  with check (public.has_any_role(array['admin', 'it_data', 'communications', 'hr']));

drop policy if exists "program managers manage programs" on public.programs;
create policy "program managers manage programs" on public.programs
  for all to authenticated
  using (public.has_any_role(array['admin', 'it_data', 'communications', 'program_manager']))
  with check (public.has_any_role(array['admin', 'it_data', 'communications', 'program_manager']));
drop policy if exists "program staff manage projects" on public.projects;
create policy "program staff manage projects" on public.projects
  for all to authenticated
  using (public.has_any_role(array['admin', 'director', 'management', 'program_manager', 'case_worker']))
  with check (public.has_any_role(array['admin', 'director', 'management', 'program_manager', 'case_worker']));

drop policy if exists "fundraisers manage categories" on public.campaign_categories;
create policy "fundraisers manage categories" on public.campaign_categories
  for all to authenticated
  using (public.has_any_role(array['admin', 'it_data', 'communications', 'fundraiser', 'finance']))
  with check (public.has_any_role(array['admin', 'it_data', 'communications', 'fundraiser', 'finance']));
drop policy if exists "fundraisers manage campaigns" on public.donation_campaigns;
create policy "fundraisers manage campaigns" on public.donation_campaigns
  for all to authenticated
  using (public.has_any_role(array['admin', 'it_data', 'communications', 'fundraiser', 'finance']))
  with check (public.has_any_role(array['admin', 'it_data', 'communications', 'fundraiser', 'finance']));

drop policy if exists "communications manage gallery" on public.galleries;
create policy "communications manage gallery" on public.galleries
  for all to authenticated
  using (public.has_any_role(array['admin', 'it_data', 'communications']))
  with check (public.has_any_role(array['admin', 'it_data', 'communications']));
drop policy if exists "admins manage contact details" on public.contact_details;
create policy "admins manage contact details" on public.contact_details
  for all to authenticated
  using (public.has_any_role(array['admin', 'it_data', 'communications']))
  with check (public.has_any_role(array['admin', 'it_data', 'communications']));
drop policy if exists "admins manage social links" on public.social_links;
create policy "admins manage social links" on public.social_links
  for all to authenticated
  using (public.has_any_role(array['admin', 'it_data', 'communications']))
  with check (public.has_any_role(array['admin', 'it_data', 'communications']));
drop policy if exists "admins manage organization" on public.organizations;
create policy "admins manage organization" on public.organizations
  for all to authenticated
  using (public.has_any_role(array['admin', 'it_data']))
  with check (public.has_any_role(array['admin', 'it_data']));
drop policy if exists "admins manage website sections" on public.website_sections;
create policy "admins manage website sections" on public.website_sections
  for all to authenticated
  using (public.has_any_role(array['admin', 'it_data', 'communications']))
  with check (public.has_any_role(array['admin', 'it_data', 'communications']));
drop policy if exists "communications manage impact metrics" on public.impact_metrics;
create policy "communications manage impact metrics" on public.impact_metrics
  for all to authenticated
  using (public.has_any_role(array['admin', 'it_data', 'communications']))
  with check (public.has_any_role(array['admin', 'it_data', 'communications']));
drop policy if exists "communications manage success stories" on public.success_stories;
create policy "communications manage success stories" on public.success_stories
  for all to authenticated
  using (public.has_any_role(array['admin', 'it_data', 'communications']))
  with check (public.has_any_role(array['admin', 'it_data', 'communications']));

drop policy if exists "management read audit events" on public.audit_events;
create policy "management read audit events" on public.audit_events
  for select to authenticated
  using (public.has_any_role(array['admin', 'director', 'management', 'it_data']));

alter table public.project_campaigns enable row level security;
alter table public.project_events enable row level security;
alter table public.email_notification_jobs enable row level security;
alter table public.email_notification_deliveries enable row level security;
alter table public.secretariat_documents enable row level security;
alter table public.department_updates enable row level security;
alter table public.website_page_views enable row level security;
alter table public.notification_preferences enable row level security;

drop policy if exists "published projects show campaign links" on public.project_campaigns;
create policy "published projects show campaign links" on public.project_campaigns
  for select to anon, authenticated using (
    exists (select 1 from public.projects p where p.id = project_id and p.is_published)
    and exists (select 1 from public.donation_campaigns c where c.id = campaign_id and c.is_published)
  );
drop policy if exists "authorized program staff manage project campaigns" on public.project_campaigns;
create policy "authorized program staff manage project campaigns" on public.project_campaigns
  for all to authenticated
  using (public.has_any_role(array['admin', 'director', 'management', 'program_manager', 'fundraiser', 'finance']))
  with check (public.has_any_role(array['admin', 'director', 'management', 'program_manager', 'fundraiser', 'finance']));
drop policy if exists "published projects show event links" on public.project_events;
create policy "published projects show event links" on public.project_events
  for select to anon, authenticated using (
    exists (select 1 from public.projects p where p.id = project_id and p.is_published)
    and exists (select 1 from public.events e where e.id = event_id and e.is_published)
  );
drop policy if exists "authorized program staff manage project events" on public.project_events;
create policy "authorized program staff manage project events" on public.project_events
  for all to authenticated
  using (public.has_any_role(array['admin', 'director', 'management', 'program_manager', 'communications']))
  with check (public.has_any_role(array['admin', 'director', 'management', 'program_manager', 'communications']));

drop policy if exists "secretariat manage documents" on public.secretariat_documents;
create policy "secretariat manage documents" on public.secretariat_documents
  for all to authenticated
  using (public.has_any_role(array['admin', 'director', 'management', 'secretariat']))
  with check (public.has_any_role(array['admin', 'director', 'management', 'secretariat']));
drop policy if exists "management read department updates" on public.department_updates;
create policy "management read department updates" on public.department_updates
  for select to authenticated
  using (public.has_any_role(array['admin', 'director', 'management', 'program_manager'])  );
drop policy if exists "staff manage own department updates" on public.department_updates;
create policy "staff manage own department updates" on public.department_updates
  for all to authenticated
  using (
    submitted_by = auth.uid()
    or public.has_any_role(array['admin', 'director', 'management', 'program_manager'])
  )
  with check (
    (
      submitted_by = auth.uid()
      and public.has_any_role(array[
        'program_manager', 'case_worker', 'education_support',
        'health_nutrition', 'child_protection', 'secretariat'
      ])
    )
    or public.has_any_role(array['admin', 'director', 'management', 'program_manager'])
  );
drop policy if exists "public can record anonymous page views" on public.website_page_views;
create policy "public can record anonymous page views" on public.website_page_views
  for insert to anon, authenticated
  with check (
    char_length(page_path) between 1 and 200
    and country_code is null
    and (referrer_host is null or char_length(referrer_host) <= 253)
  );
drop policy if exists "management read aggregate page views" on public.website_page_views;
create policy "management read aggregate page views" on public.website_page_views
  for select to authenticated
  using (public.has_any_role(array['admin', 'director', 'management', 'it_data']));
drop policy if exists "admins manage notification preferences" on public.notification_preferences;
create policy "admins manage notification preferences" on public.notification_preferences
  for all to authenticated
  using (public.has_any_role(array['admin', 'it_data', 'communications']))
  with check (public.has_any_role(array['admin', 'it_data', 'communications']));
drop policy if exists "email managers read jobs" on public.email_notification_jobs;
create policy "email managers read jobs" on public.email_notification_jobs
  for select to authenticated
  using (public.has_any_role(array['admin', 'it_data', 'communications']));
drop policy if exists "email managers read deliveries" on public.email_notification_deliveries;
create policy "email managers read deliveries" on public.email_notification_deliveries
  for select to authenticated
  using (public.has_any_role(array['admin', 'it_data', 'communications']));

drop policy if exists "authorized case staff manage families" on public.families;
create policy "authorized case staff manage families" on public.families
  for all to authenticated
  using (public.has_any_role(array[
    'admin', 'director', 'program_manager', 'case_worker',
    'child_protection', 'education_support', 'health_nutrition'
  ]))
  with check (public.has_any_role(array[
    'admin', 'director', 'program_manager', 'case_worker',
    'child_protection', 'education_support', 'health_nutrition'
  ]));

drop policy if exists "authorized case staff manage children" on public.children;
create policy "authorized case staff manage children" on public.children
  for all to authenticated
  using (public.has_any_role(array[
    'admin', 'director', 'program_manager', 'case_worker',
    'child_protection', 'education_support', 'health_nutrition'
  ]))
  with check (public.has_any_role(array[
    'admin', 'director', 'program_manager', 'case_worker',
    'child_protection', 'education_support', 'health_nutrition'
  ]));

drop policy if exists "authorized case staff manage cases" on public.case_records;
create policy "authorized case staff manage cases" on public.case_records
  for all to authenticated
  using (public.has_any_role(array[
    'admin', 'director', 'program_manager', 'case_worker',
    'child_protection', 'education_support', 'health_nutrition'
  ]))
  with check (public.has_any_role(array[
    'admin', 'director', 'program_manager', 'case_worker',
    'child_protection', 'education_support', 'health_nutrition'
  ]));

drop policy if exists "authorized case staff manage case notes" on public.case_notes;
create policy "authorized case staff manage case notes" on public.case_notes
  for all to authenticated
  using (
    public.has_any_role(array[
      'admin', 'director', 'program_manager', 'case_worker',
      'child_protection', 'education_support', 'health_nutrition'
    ])
    and (visibility = 'internal' or public.has_any_role(array['admin', 'director', 'case_worker']))
  )
  with check (
    public.has_any_role(array[
      'admin', 'director', 'program_manager', 'case_worker',
      'child_protection', 'education_support', 'health_nutrition'
    ])
    and (visibility = 'internal' or public.has_any_role(array['admin', 'director', 'case_worker']))
  );

drop policy if exists "authorized program staff manage assistance" on public.assistance_records;
create policy "authorized program staff manage assistance" on public.assistance_records
  for all to authenticated
  using (public.has_any_role(array[
    'admin', 'director', 'program_manager', 'case_worker', 'finance',
    'child_protection', 'education_support', 'health_nutrition'
  ]))
  with check (public.has_any_role(array[
    'admin', 'director', 'program_manager', 'case_worker', 'finance',
    'child_protection', 'education_support', 'health_nutrition'
  ]));

grant select, insert, update, delete on public.project_campaigns, public.project_events,
  public.secretariat_documents, public.department_updates, public.notification_preferences
  to authenticated;
grant select on public.project_campaigns, public.project_events to anon, authenticated;
grant select on public.email_notification_jobs, public.email_notification_deliveries to authenticated;
grant insert on public.website_page_views to anon, authenticated;
grant select on public.website_page_views to authenticated;
grant usage, select on sequence public.website_page_views_id_seq to authenticated, anon;

do $$
declare
  target_table text;
begin
  foreach target_table in array array[
    'project_campaigns', 'project_events', 'email_notification_jobs',
    'email_notification_deliveries', 'secretariat_documents',
    'department_updates', 'notification_preferences'
  ]
  loop
    execute format('drop trigger if exists write_audit_event on public.%I', target_table);
    execute format(
      'create trigger write_audit_event after insert or update or delete on public.%I for each row execute function public.write_audit_event()',
      target_table
    );
  end loop;

  foreach target_table in array array['secretariat_documents', 'department_updates', 'notification_preferences']
  loop
    execute format('drop trigger if exists set_updated_at on public.%I', target_table);
    execute format(
      'create trigger set_updated_at before update on public.%I for each row execute function public.handle_updated_at()',
      target_table
    );
  end loop;
end
$$;

insert into public.campaign_categories (name, description, sort_order)
select seed.name, seed.description, seed.sort_order
from (values
  ('Charity for Food', 'Help provide food support to vulnerable families.', 10),
  ('Charity for Water', 'Support access to safe water and related needs.', 20),
  ('Charity for Education', 'Support educational access and school needs.', 30),
  ('Charity for Medical Support', 'Support healthcare and medical needs.', 40)
) as seed(name, description, sort_order)
where not exists (
  select 1 from public.campaign_categories existing where existing.name = seed.name
);

insert into public.programs (slug, name, summary, impact, feature_label, sort_order)
values
  ('health-insurance-care', 'Health Insurance and Care Support', 'Healthcare assistance, health insurance support and care referrals for vulnerable families.', 'Supporting access to care.', 'Health support', 50),
  ('clothing-sanitation', 'Clothing and Home Sanitation', 'Clothing and household sanitation materials to support dignity and healthier homes.', 'Strengthening household wellbeing.', 'Family wellbeing', 60)
on conflict (slug) do nothing;

insert into public.notification_preferences (setting_key, enabled, provider)
values ('subscriber_email_notifications', false, null)
on conflict (setting_key) do nothing;

do $$
declare
  target_table text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach target_table in array array[
      'projects', 'events', 'announcements', 'campaign_categories',
      'donation_campaigns', 'galleries', 'contact_details',
      'secretariat_documents', 'department_updates', 'email_notification_jobs'
    ]
    loop
      if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = target_table
      ) then
        execute format('alter publication supabase_realtime add table public.%I', target_table);
      end if;
    end loop;
  end if;
end
$$;

commit;

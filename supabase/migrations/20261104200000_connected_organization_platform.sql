begin;

create extension if not exists pgcrypto;

alter table public.organizations
  add column if not exists logo_url text,
  add column if not exists website_url text,
  add column if not exists currency_code text not null default 'RWF';

alter table public.profiles
  add column if not exists is_active boolean not null default true;

alter table public.team_years
  add column if not exists is_published boolean not null default true,
  add column if not exists sort_order integer not null default 0;

alter table public.team_members
  add column if not exists email text,
  add column if not exists avatar_url text,
  add column if not exists is_published boolean not null default true;

alter table public.programs
  add column if not exists is_published boolean not null default true,
  add column if not exists sort_order integer not null default 0,
  add column if not exists cover_image_url text;

alter table public.projects
  add column if not exists program_id uuid references public.programs(id) on delete set null,
  add column if not exists start_date date,
  add column if not exists end_date date,
  add column if not exists budget_amount numeric(14,2),
  add column if not exists currency_code text not null default 'RWF',
  add column if not exists is_published boolean not null default false;

alter table public.events
  add column if not exists is_published boolean not null default false,
  add column if not exists registration_url text;

alter table public.announcements
  add column if not exists audience text not null default 'public';

alter table public.donation_campaigns
  add column if not exists slug text,
  add column if not exists currency_code text not null default 'RWF',
  add column if not exists starts_at timestamptz,
  add column if not exists ends_at timestamptz,
  add column if not exists is_published boolean not null default false,
  add column if not exists cover_image_url text;

alter table public.galleries
  add column if not exists alt_text text,
  add column if not exists is_published boolean not null default true,
  add column if not exists sort_order integer not null default 0;

alter table public.contact_details
  add column if not exists is_public boolean not null default true,
  add column if not exists sort_order integer not null default 0;

alter table public.newsletter_subscribers
  add column if not exists is_confirmed boolean not null default false,
  add column if not exists unsubscribed_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'donation_campaigns_slug_key'
      and conrelid = 'public.donation_campaigns'::regclass
  ) then
    alter table public.donation_campaigns
      add constraint donation_campaigns_slug_key unique (slug);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'user_roles_role_name_check'
      and conrelid = 'public.user_roles'::regclass
  ) then
    alter table public.user_roles
      add constraint user_roles_role_name_check
      check (role_name in (
        'admin', 'director', 'finance', 'fundraiser', 'program_manager',
        'case_worker', 'communications', 'volunteer_manager', 'hr', 'staff'
      ));
  end if;
end
$$;

create table if not exists public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  full_name text not null check (char_length(full_name) between 2 and 120),
  email text not null check (char_length(email) between 5 and 254),
  subject text not null check (char_length(subject) between 2 and 180),
  message text not null check (char_length(message) between 10 and 5000),
  status text not null default 'new' check (status in ('new', 'in_progress', 'resolved', 'spam')),
  assigned_to uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.volunteer_applications (
  id uuid primary key default gen_random_uuid(),
  full_name text not null check (char_length(full_name) between 2 and 120),
  email text not null check (char_length(email) between 5 and 254),
  phone text,
  interests text[] not null default '{}',
  availability text,
  message text check (message is null or char_length(message) <= 3000),
  status text not null default 'new' check (status in ('new', 'reviewing', 'accepted', 'declined')),
  assigned_to uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.families (
  id uuid primary key default gen_random_uuid(),
  household_code text unique,
  primary_contact_name text not null,
  phone text,
  email text,
  address text,
  district text,
  sector text,
  household_size integer check (household_size is null or household_size > 0),
  vulnerability_notes text,
  status text not null default 'active' check (status in ('active', 'inactive', 'closed')),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.children (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete restrict,
  child_code text unique,
  first_name text not null,
  last_name text,
  date_of_birth date,
  gender text check (gender is null or gender in ('female', 'male', 'other', 'undisclosed')),
  school_name text,
  grade_level text,
  enrollment_status text not null default 'unknown'
    check (enrollment_status in ('enrolled', 'not_enrolled', 'graduated', 'unknown')),
  safeguarding_notes text,
  status text not null default 'active' check (status in ('active', 'inactive', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.case_records (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete restrict,
  child_id uuid references public.children(id) on delete set null,
  program_id uuid references public.programs(id) on delete set null,
  project_id uuid references public.projects(id) on delete set null,
  title text not null,
  description text,
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  status text not null default 'open' check (status in ('open', 'in_progress', 'on_hold', 'resolved', 'closed')),
  assigned_to uuid references public.profiles(id) on delete set null,
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.case_notes (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.case_records(id) on delete cascade,
  note text not null check (char_length(note) between 1 and 10000),
  visibility text not null default 'internal' check (visibility in ('internal', 'restricted')),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.assistance_records (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete restrict,
  child_id uuid references public.children(id) on delete set null,
  case_id uuid references public.case_records(id) on delete set null,
  program_id uuid references public.programs(id) on delete set null,
  project_id uuid references public.projects(id) on delete set null,
  assistance_type text not null,
  description text,
  quantity numeric(12,2),
  amount numeric(14,2),
  currency_code text not null default 'RWF',
  provided_at timestamptz not null default now(),
  provided_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.volunteers (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid unique references public.profiles(id) on delete set null,
  full_name text not null,
  email text,
  phone text,
  skills text[] not null default '{}',
  status text not null default 'active' check (status in ('applicant', 'active', 'inactive')),
  joined_at date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.volunteer_assignments (
  id uuid primary key default gen_random_uuid(),
  volunteer_id uuid not null references public.volunteers(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  event_id uuid references public.events(id) on delete set null,
  role_title text,
  starts_at timestamptz,
  ends_at timestamptz,
  hours numeric(8,2) check (hours is null or hours >= 0),
  status text not null default 'planned' check (status in ('planned', 'confirmed', 'completed', 'cancelled')),
  created_at timestamptz not null default now(),
  check (ends_at is null or starts_at is null or ends_at >= starts_at)
);

create table if not exists public.donors (
  id uuid primary key default gen_random_uuid(),
  full_name text,
  email text,
  phone text,
  organization_name text,
  is_anonymous boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.donations (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid references public.donation_campaigns(id) on delete set null,
  donor_id uuid references public.donors(id) on delete set null,
  amount numeric(14,2) not null check (amount > 0),
  currency_code text not null default 'RWF',
  status text not null default 'pending' check (status in ('pending', 'completed', 'failed', 'refunded', 'cancelled')),
  payment_provider text,
  provider_reference text unique,
  received_at timestamptz,
  notes text,
  recorded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.audit_events (
  id bigint generated always as identity primary key,
  table_name text not null,
  record_id uuid,
  action text not null check (action in ('INSERT', 'UPDATE', 'DELETE')),
  actor_id uuid,
  occurred_at timestamptz not null default now()
);

create table if not exists public.impact_metrics (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  value text not null,
  description text,
  sort_order integer not null default 0,
  is_published boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists public.success_stories (
  id uuid primary key default gen_random_uuid(),
  program_id uuid references public.programs(id) on delete set null,
  title text not null,
  summary text not null,
  story text,
  image_url text,
  is_published boolean not null default false,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_team_members_year_sort on public.team_members(team_year_id, sort_order);
create index if not exists idx_team_years_public_sort on public.team_years(is_published, sort_order);
create unique index if not exists idx_team_years_year_label_unique on public.team_years(year_label);
create index if not exists idx_programs_public_sort on public.programs(is_published, sort_order);
create index if not exists idx_projects_program on public.projects(program_id);
create index if not exists idx_events_date on public.events(event_date);
create index if not exists idx_campaigns_public_status on public.donation_campaigns(is_published, status);
create index if not exists idx_contact_messages_status_created on public.contact_messages(status, created_at desc);
create index if not exists idx_volunteer_applications_status on public.volunteer_applications(status, created_at desc);
create index if not exists idx_children_family on public.children(family_id);
create index if not exists idx_cases_family_status on public.case_records(family_id, status);
create index if not exists idx_cases_assignee on public.case_records(assigned_to, status);
create index if not exists idx_case_notes_case on public.case_notes(case_id, created_at);
create index if not exists idx_assistance_family_date on public.assistance_records(family_id, provided_at desc);
create index if not exists idx_donations_campaign_status on public.donations(campaign_id, status);
create index if not exists idx_audit_events_record_date on public.audit_events(table_name, record_id, occurred_at desc);
create index if not exists idx_impact_metrics_public_sort on public.impact_metrics(is_published, sort_order);
create index if not exists idx_success_stories_public_date on public.success_stories(is_published, published_at desc);

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

revoke all on function public.has_any_role(text[]) from public;
grant execute on function public.has_any_role(text[]) to anon, authenticated;

create or replace function public.handle_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.write_audit_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  affected_id uuid;
begin
  if tg_op = 'DELETE' then
    affected_id := (to_jsonb(old) ->> 'id')::uuid;
  else
    affected_id := (to_jsonb(new) ->> 'id')::uuid;
  end if;

  insert into public.audit_events (table_name, record_id, action, actor_id)
  values (tg_table_name, affected_id, tg_op, auth.uid());

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data ->> 'full_name', ''),
      nullif(split_part(new.email, '@', 1), ''),
      'New user'
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
after insert on auth.users
for each row execute function public.handle_new_auth_user();

do $$
declare
  target_table text;
begin
  foreach target_table in array array[
    'organizations', 'profiles', 'team_years', 'team_members', 'programs',
    'projects', 'events', 'announcements', 'donation_campaigns', 'contact_messages',
    'volunteer_applications', 'families', 'children', 'case_records', 'case_notes',
    'assistance_records', 'volunteers', 'volunteer_assignments', 'donors', 'donations',
    'impact_metrics', 'success_stories'
  ]
  loop
    execute format('drop trigger if exists set_updated_at on public.%I', target_table);
    execute format('drop trigger if exists set_%I_updated_at on public.%I', target_table, target_table);
    if exists (
      select 1 from information_schema.columns c
      where c.table_schema = 'public' and c.table_name = target_table and c.column_name = 'updated_at'
    ) then
      execute format(
        'create trigger set_updated_at before update on public.%I for each row execute function public.handle_updated_at()',
        target_table
      );
    end if;
  end loop;
end
$$;

do $$
declare
  target_table text;
begin
  foreach target_table in array array[
    'organizations', 'profiles', 'team_years', 'team_members', 'programs',
    'projects', 'events', 'announcements', 'donation_campaigns', 'contact_messages',
    'volunteer_applications', 'families', 'children', 'case_records', 'case_notes',
    'assistance_records', 'volunteers', 'volunteer_assignments', 'donors',
    'donations', 'impact_metrics', 'success_stories'
  ]
  loop
    execute format('drop trigger if exists write_audit_event on public.%I', target_table);
    execute format(
      'create trigger write_audit_event after insert or update or delete on public.%I for each row execute function public.write_audit_event()',
      target_table
    );
  end loop;
end
$$;

do $$
declare
  target_table text;
begin
  foreach target_table in array array[
    'organizations', 'profiles', 'team_years', 'team_members', 'programs',
    'projects', 'events', 'announcements', 'campaign_categories', 'donation_campaigns',
    'galleries', 'social_links', 'contact_details', 'website_sections',
    'newsletter_subscribers', 'user_roles', 'contact_messages', 'volunteer_applications',
    'families', 'children', 'case_records', 'case_notes', 'assistance_records',
    'volunteers', 'volunteer_assignments', 'donors', 'donations', 'audit_events',
    'impact_metrics', 'success_stories'
  ]
  loop
    execute format('alter table public.%I enable row level security', target_table);
  end loop;
end
$$;

drop policy if exists "public can read organization" on public.organizations;
create policy "public can read organization" on public.organizations
  for select to anon, authenticated using (true);
drop policy if exists "admins manage organization" on public.organizations;
create policy "admins manage organization" on public.organizations
  for all to authenticated
  using (public.has_any_role(array['admin', 'director']))
  with check (public.has_any_role(array['admin', 'director']));

drop policy if exists "users read own profile" on public.profiles;
create policy "users read own profile" on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.has_any_role(array['admin', 'director', 'hr']));
drop policy if exists "users update own profile" on public.profiles;
create policy "users update own profile" on public.profiles
  for update to authenticated
  using (id = auth.uid() or public.has_any_role(array['admin', 'director', 'hr']))
  with check (id = auth.uid() or public.has_any_role(array['admin', 'director', 'hr']));
drop policy if exists "admins manage profiles" on public.profiles;
create policy "admins manage profiles" on public.profiles
  for insert to authenticated
  with check (public.has_any_role(array['admin', 'director', 'hr']));

drop policy if exists "public can read published team years" on public.team_years;
create policy "public can read published team years" on public.team_years
  for select to anon, authenticated using (is_published);
drop policy if exists "team managers manage team years" on public.team_years;
create policy "team managers manage team years" on public.team_years
  for all to authenticated
  using (public.has_any_role(array['admin', 'director', 'hr', 'communications']))
  with check (public.has_any_role(array['admin', 'director', 'hr', 'communications']));

drop policy if exists "public can read published team members" on public.team_members;
create policy "public can read published team members" on public.team_members
  for select to anon, authenticated using (
    is_published and exists (
      select 1 from public.team_years y
      where y.id = team_year_id and y.is_published
    )
  );
drop policy if exists "team managers manage members" on public.team_members;
create policy "team managers manage members" on public.team_members
  for all to authenticated
  using (public.has_any_role(array['admin', 'director', 'hr', 'communications']))
  with check (public.has_any_role(array['admin', 'director', 'hr', 'communications']));

drop policy if exists "public can read published programs" on public.programs;
create policy "public can read published programs" on public.programs
  for select to anon, authenticated using (is_published);
drop policy if exists "program managers manage programs" on public.programs;
create policy "program managers manage programs" on public.programs
  for all to authenticated
  using (public.has_any_role(array['admin', 'director', 'program_manager', 'communications']))
  with check (public.has_any_role(array['admin', 'director', 'program_manager', 'communications']));

drop policy if exists "public can read published projects" on public.projects;
create policy "public can read published projects" on public.projects
  for select to anon, authenticated using (is_published);
drop policy if exists "program staff manage projects" on public.projects;
create policy "program staff manage projects" on public.projects
  for all to authenticated
  using (public.has_any_role(array['admin', 'director', 'program_manager', 'case_worker']))
  with check (public.has_any_role(array['admin', 'director', 'program_manager', 'case_worker']));

drop policy if exists "public can read published events" on public.events;
create policy "public can read published events" on public.events
  for select to anon, authenticated using (is_published);
drop policy if exists "event managers manage events" on public.events;
create policy "event managers manage events" on public.events
  for all to authenticated
  using (public.has_any_role(array['admin', 'director', 'communications', 'volunteer_manager']))
  with check (public.has_any_role(array['admin', 'director', 'communications', 'volunteer_manager']));

drop policy if exists "public can read published announcements" on public.announcements;
create policy "public can read published announcements" on public.announcements
  for select to anon, authenticated using (is_published and audience = 'public');
drop policy if exists "staff can read announcements" on public.announcements;
create policy "staff can read announcements" on public.announcements
  for select to authenticated using (public.has_any_role(array['admin', 'director', 'staff']));
drop policy if exists "communications manage announcements" on public.announcements;
create policy "communications manage announcements" on public.announcements
  for all to authenticated
  using (public.has_any_role(array['admin', 'director', 'communications']))
  with check (public.has_any_role(array['admin', 'director', 'communications']));

drop policy if exists "public can read campaign categories" on public.campaign_categories;
create policy "public can read campaign categories" on public.campaign_categories
  for select to anon, authenticated using (true);
drop policy if exists "fundraisers manage categories" on public.campaign_categories;
create policy "fundraisers manage categories" on public.campaign_categories
  for all to authenticated
  using (public.has_any_role(array['admin', 'director', 'fundraiser', 'finance']))
  with check (public.has_any_role(array['admin', 'director', 'fundraiser', 'finance']));

drop policy if exists "public can read published campaigns" on public.donation_campaigns;
create policy "public can read published campaigns" on public.donation_campaigns
  for select to anon, authenticated using (is_published and status = 'active');
drop policy if exists "fundraisers manage campaigns" on public.donation_campaigns;
create policy "fundraisers manage campaigns" on public.donation_campaigns
  for all to authenticated
  using (public.has_any_role(array['admin', 'director', 'fundraiser', 'finance']))
  with check (public.has_any_role(array['admin', 'director', 'fundraiser', 'finance']));

drop policy if exists "public can read published gallery" on public.galleries;
create policy "public can read published gallery" on public.galleries
  for select to anon, authenticated using (is_published);
drop policy if exists "communications manage gallery" on public.galleries;
create policy "communications manage gallery" on public.galleries
  for all to authenticated
  using (public.has_any_role(array['admin', 'director', 'communications']))
  with check (public.has_any_role(array['admin', 'director', 'communications']));

drop policy if exists "public can read active social links" on public.social_links;
create policy "public can read active social links" on public.social_links
  for select to anon, authenticated using (is_active);
drop policy if exists "admins manage social links" on public.social_links;
create policy "admins manage social links" on public.social_links
  for all to authenticated
  using (public.has_any_role(array['admin', 'director', 'communications']))
  with check (public.has_any_role(array['admin', 'director', 'communications']));

drop policy if exists "public can read public contact details" on public.contact_details;
create policy "public can read public contact details" on public.contact_details
  for select to anon, authenticated using (is_public);
drop policy if exists "admins manage contact details" on public.contact_details;
create policy "admins manage contact details" on public.contact_details
  for all to authenticated
  using (public.has_any_role(array['admin', 'director', 'communications']))
  with check (public.has_any_role(array['admin', 'director', 'communications']));

drop policy if exists "public can read website sections" on public.website_sections;
create policy "public can read website sections" on public.website_sections
  for select to anon, authenticated using (true);
drop policy if exists "admins manage website sections" on public.website_sections;
create policy "admins manage website sections" on public.website_sections
  for all to authenticated
  using (public.has_any_role(array['admin', 'director', 'communications']))
  with check (public.has_any_role(array['admin', 'director', 'communications']));

drop policy if exists "public can read published impact metrics" on public.impact_metrics;
create policy "public can read published impact metrics" on public.impact_metrics
  for select to anon, authenticated using (is_published);
drop policy if exists "communications manage impact metrics" on public.impact_metrics;
create policy "communications manage impact metrics" on public.impact_metrics
  for all to authenticated
  using (public.has_any_role(array['admin', 'director', 'communications']))
  with check (public.has_any_role(array['admin', 'director', 'communications']));

drop policy if exists "public can read published success stories" on public.success_stories;
create policy "public can read published success stories" on public.success_stories
  for select to anon, authenticated using (is_published and published_at <= now());
drop policy if exists "communications manage success stories" on public.success_stories;
create policy "communications manage success stories" on public.success_stories
  for all to authenticated
  using (public.has_any_role(array['admin', 'director', 'communications']))
  with check (public.has_any_role(array['admin', 'director', 'communications']));

drop policy if exists "public can subscribe" on public.newsletter_subscribers;
create policy "public can subscribe" on public.newsletter_subscribers
  for insert to anon, authenticated
  with check (
    char_length(email) between 5 and 254
    and email ~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$'
    and not is_confirmed
    and unsubscribed_at is null
  );
drop policy if exists "newsletter managers read subscribers" on public.newsletter_subscribers;
create policy "newsletter managers read subscribers" on public.newsletter_subscribers
  for select to authenticated
  using (public.has_any_role(array['admin', 'director', 'communications']));
drop policy if exists "newsletter managers update subscribers" on public.newsletter_subscribers;
create policy "newsletter managers update subscribers" on public.newsletter_subscribers
  for update to authenticated
  using (public.has_any_role(array['admin', 'director', 'communications']))
  with check (public.has_any_role(array['admin', 'director', 'communications']));

drop policy if exists "users read own roles" on public.user_roles;
create policy "users read own roles" on public.user_roles
  for select to authenticated
  using (user_id = auth.uid() or public.has_any_role(array['admin']));
drop policy if exists "admins manage roles" on public.user_roles;
create policy "admins manage roles" on public.user_roles
  for all to authenticated
  using (public.has_any_role(array['admin']))
  with check (public.has_any_role(array['admin']));

drop policy if exists "public can submit contact message" on public.contact_messages;
create policy "public can submit contact message" on public.contact_messages
  for insert to anon, authenticated
  with check (
    char_length(full_name) between 2 and 120
    and char_length(subject) between 2 and 180
    and char_length(message) between 10 and 5000
    and email ~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$'
    and status = 'new'
    and assigned_to is null
  );
drop policy if exists "staff manage contact messages" on public.contact_messages;
create policy "staff manage contact messages" on public.contact_messages
  for all to authenticated
  using (public.has_any_role(array['admin', 'director', 'communications']))
  with check (public.has_any_role(array['admin', 'director', 'communications']));

drop policy if exists "public can apply to volunteer" on public.volunteer_applications;
create policy "public can apply to volunteer" on public.volunteer_applications
  for insert to anon, authenticated
  with check (
    char_length(full_name) between 2 and 120
    and email ~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$'
    and status = 'new'
    and assigned_to is null
  );
drop policy if exists "volunteer managers manage applications" on public.volunteer_applications;
create policy "volunteer managers manage applications" on public.volunteer_applications
  for all to authenticated
  using (public.has_any_role(array['admin', 'director', 'volunteer_manager', 'hr']))
  with check (public.has_any_role(array['admin', 'director', 'volunteer_manager', 'hr']));

drop policy if exists "authorized case staff manage families" on public.families;
create policy "authorized case staff manage families" on public.families
  for all to authenticated
  using (public.has_any_role(array['admin', 'director', 'program_manager', 'case_worker']))
  with check (public.has_any_role(array['admin', 'director', 'program_manager', 'case_worker']));

drop policy if exists "authorized case staff manage children" on public.children;
create policy "authorized case staff manage children" on public.children
  for all to authenticated
  using (public.has_any_role(array['admin', 'director', 'program_manager', 'case_worker']))
  with check (public.has_any_role(array['admin', 'director', 'program_manager', 'case_worker']));

drop policy if exists "authorized case staff manage cases" on public.case_records;
create policy "authorized case staff manage cases" on public.case_records
  for all to authenticated
  using (public.has_any_role(array['admin', 'director', 'program_manager', 'case_worker']))
  with check (public.has_any_role(array['admin', 'director', 'program_manager', 'case_worker']));

drop policy if exists "authorized case staff manage case notes" on public.case_notes;
create policy "authorized case staff manage case notes" on public.case_notes
  for all to authenticated
  using (
    public.has_any_role(array['admin', 'director', 'program_manager', 'case_worker'])
    and (visibility = 'internal' or public.has_any_role(array['admin', 'director', 'case_worker']))
  )
  with check (
    public.has_any_role(array['admin', 'director', 'program_manager', 'case_worker'])
    and (visibility = 'internal' or public.has_any_role(array['admin', 'director', 'case_worker']))
  );

drop policy if exists "authorized program staff manage assistance" on public.assistance_records;
create policy "authorized program staff manage assistance" on public.assistance_records
  for all to authenticated
  using (public.has_any_role(array['admin', 'director', 'program_manager', 'case_worker', 'finance']))
  with check (public.has_any_role(array['admin', 'director', 'program_manager', 'case_worker', 'finance']));

drop policy if exists "volunteer managers manage volunteers" on public.volunteers;
create policy "volunteer managers manage volunteers" on public.volunteers
  for all to authenticated
  using (public.has_any_role(array['admin', 'director', 'volunteer_manager', 'hr']))
  with check (public.has_any_role(array['admin', 'director', 'volunteer_manager', 'hr']));

drop policy if exists "volunteer managers manage assignments" on public.volunteer_assignments;
create policy "volunteer managers manage assignments" on public.volunteer_assignments
  for all to authenticated
  using (public.has_any_role(array['admin', 'director', 'volunteer_manager', 'program_manager']))
  with check (public.has_any_role(array['admin', 'director', 'volunteer_manager', 'program_manager']));

drop policy if exists "finance staff manage donors" on public.donors;
create policy "finance staff manage donors" on public.donors
  for all to authenticated
  using (public.has_any_role(array['admin', 'director', 'finance', 'fundraiser']))
  with check (public.has_any_role(array['admin', 'director', 'finance', 'fundraiser']));

drop policy if exists "finance staff manage donations" on public.donations;
create policy "finance staff manage donations" on public.donations
  for all to authenticated
  using (public.has_any_role(array['admin', 'director', 'finance']))
  with check (public.has_any_role(array['admin', 'director', 'finance']));

drop policy if exists "admins read audit events" on public.audit_events;
create policy "admins read audit events" on public.audit_events
  for select to authenticated
  using (public.has_any_role(array['admin', 'director']));

grant usage on schema public to anon, authenticated;
grant select on public.organizations, public.team_years, public.team_members,
  public.programs, public.projects, public.events, public.announcements,
  public.campaign_categories, public.donation_campaigns, public.galleries,
  public.social_links, public.contact_details, public.website_sections,
  public.impact_metrics, public.success_stories
  to anon, authenticated;
grant insert on public.newsletter_subscribers, public.contact_messages,
  public.volunteer_applications to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;

do $$
declare
  target_table text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach target_table in array array[
      'organizations', 'team_years', 'team_members', 'programs', 'projects',
      'events', 'announcements', 'donation_campaigns', 'galleries',
      'contact_details', 'website_sections', 'impact_metrics', 'success_stories',
      'contact_messages', 'volunteer_applications'
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

insert into public.organizations (
  name, tagline, location, founded_year, mission, email, address, currency_code
)
select
  'Heart of Sympathy',
  'Bridge Them To The Future',
  'Kigali, Rwanda',
  '2023',
  'Bridging vulnerable families to the future by providing educational needs to their children and ensuring a better diet for good health.',
  null,
  'Kigali, Rwanda',
  'RWF'
where not exists (select 1 from public.organizations);

insert into public.team_years (year_label, sort_order)
values ('2024–2025', 30), ('2025–2026', 20), ('2026–2027', 10)
on conflict (year_label) do nothing;

insert into public.programs (slug, name, summary, impact, feature_label, sort_order)
values
  ('education-sponsorship', 'Education Sponsorship', 'Educational support for children in vulnerable families, including the needs that help learners stay engaged in school.', 'Extending access to quality education.', 'Education', 10),
  ('nutrition-health', 'Nutrition & Health', 'Nutrition and health support, including balanced diets and healthcare assistance for vulnerable people.', 'Supporting better health and wellbeing.', 'Nutrition & health', 20),
  ('family-support', 'Family & Community Support', 'Practical support for vulnerable families, including clothing, household sanitation materials, and emergency assistance.', 'Strengthening family stability and dignity.', 'Family support', 30),
  ('mentorship', 'Social Mentorship', 'Social mentorship and community support that help children and families build stability and opportunity.', 'Building confidence and stronger communities.', 'Mentorship', 40)
on conflict (slug) do update set
  name = excluded.name,
  summary = excluded.summary,
  impact = excluded.impact,
  feature_label = excluded.feature_label,
  sort_order = excluded.sort_order;

insert into public.website_sections (section_key, title, content)
values
  (
    'home_hero',
    'Building futures with dignity, care, and opportunity.',
    jsonb_build_object(
      'eyebrow', 'Youth-led care for vulnerable families',
      'description', 'We support children and families beyond school fees, combining education, nutrition, health, and community care to help communities thrive.',
      'support_note', 'We combine education, nutrition, and safety nets so children can stay in school and receive the support they need.'
    )
  ),
  (
    'about',
    'Heart of Sympathy in Rwanda',
    jsonb_build_object(
      'intro', 'Founded in 2023 in Kigali, Heart of Sympathy was built around a simple conviction: real support for vulnerable children means caring for the whole family system.',
      'vision', jsonb_build_array(
        'Extending quality education to as many vulnerable children as possible.',
        'Providing balanced diets to the ill in public hospitals.',
        'Providing income-generating activities to vulnerable families.'
      )
    )
  ),
  (
    'programs',
    'Care that reaches the whole family.',
    jsonb_build_object('intro', 'Our programs respond to the connected education, nutrition, health, and household needs of vulnerable families.')
  ),
  (
    'impact',
    'Real outcomes for children and families.',
    jsonb_build_object('intro', 'Impact measures and community stories are published only after they have been verified and approved.')
  ),
  (
    'donate',
    'Create steady support for children and families.',
    jsonb_build_object('intro', 'Choose from current published campaigns or contact the organization to learn about other ways to help.')
  ),
  (
    'contact',
    'Let’s work together.',
    jsonb_build_object('intro', 'Contact Heart of Sympathy to learn about programs, partnerships, or volunteering.')
  )
on conflict (section_key) do nothing;

insert into public.campaign_categories (name, description)
select seed.name, seed.description
from (values
  ('Education', 'Support educational needs and school participation.'),
  ('Nutrition & Health', 'Support nutrition and healthcare needs.'),
  ('Family Support', 'Support household stability and emergency assistance.'),
  ('General Mission', 'Flexible support for the organization’s mission.')
) as seed(name, description)
where not exists (
  select 1 from public.campaign_categories existing where existing.name = seed.name
);

insert into storage.buckets (id, name, public)
values ('hos-public', 'hos-public', true), ('hos-private', 'hos-private', false)
on conflict (id) do update set public = excluded.public;

drop policy if exists "public can view public HOS media" on storage.objects;
create policy "public can view public HOS media" on storage.objects
  for select to anon, authenticated using (bucket_id = 'hos-public');

drop policy if exists "authorized staff upload public HOS media" on storage.objects;
create policy "authorized staff upload public HOS media" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'hos-public'
    and public.has_any_role(array['admin', 'director', 'communications'])
  );

drop policy if exists "authorized staff update public HOS media" on storage.objects;
create policy "authorized staff update public HOS media" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'hos-public'
    and public.has_any_role(array['admin', 'director', 'communications'])
  )
  with check (
    bucket_id = 'hos-public'
    and public.has_any_role(array['admin', 'director', 'communications'])
  );

drop policy if exists "authorized staff delete public HOS media" on storage.objects;
create policy "authorized staff delete public HOS media" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'hos-public'
    and public.has_any_role(array['admin', 'director', 'communications'])
  );

drop policy if exists "authorized staff access private HOS files" on storage.objects;
create policy "authorized staff access private HOS files" on storage.objects
  for all to authenticated
  using (
    bucket_id = 'hos-private'
    and public.has_any_role(array['admin', 'director', 'case_worker', 'program_manager', 'finance', 'hr'])
  )
  with check (
    bucket_id = 'hos-private'
    and public.has_any_role(array['admin', 'director', 'case_worker', 'program_manager', 'finance', 'hr'])
  );

commit;

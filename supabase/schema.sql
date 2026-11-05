create extension if not exists pgcrypto;

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  tagline text,
  location text,
  founded_year text,
  mission text,
  email text,
  phone text,
  address text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role_name text not null default 'staff',
  phone text,
  department text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.team_years (
  id uuid primary key default gen_random_uuid(),
  year_label text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.team_members (
  id uuid primary key default gen_random_uuid(),
  team_year_id uuid not null references public.team_years(id) on delete cascade,
  full_name text not null,
  role_title text,
  focus_area text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.programs (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  summary text not null,
  impact text,
  highlights text,
  feature_label text,
  is_featured boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  status text not null default 'active',
  location text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  summary text,
  event_date timestamptz,
  location text,
  image_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  published_at timestamptz not null default now(),
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.campaign_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  created_at timestamptz not null default now()
);

create table if not exists public.donation_campaigns (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references public.campaign_categories(id),
  title text not null,
  description text,
  target_amount numeric(12,2) default 0,
  raised_amount numeric(12,2) default 0,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.galleries (
  id uuid primary key default gen_random_uuid(),
  title text,
  image_url text not null,
  caption text,
  created_at timestamptz not null default now()
);

create table if not exists public.social_links (
  id uuid primary key default gen_random_uuid(),
  platform text not null,
  url text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.contact_details (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  value text not null,
  category text not null default 'general',
  created_at timestamptz not null default now()
);

create table if not exists public.website_sections (
  id uuid primary key default gen_random_uuid(),
  section_key text not null unique,
  title text not null,
  content jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  name text,
  created_at timestamptz not null default now()
);

create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role_name text not null,
  created_at timestamptz not null default now(),
  unique (user_id, role_name)
);

create index if not exists idx_team_members_year on public.team_members(team_year_id);
create index if not exists idx_programs_slug on public.programs(slug);
create index if not exists idx_donation_campaigns_status on public.donation_campaigns(status);
create index if not exists idx_newsletter_email on public.newsletter_subscribers(email);

create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger set_organizations_updated_at
before update on public.organizations
for each row execute function public.handle_updated_at();

create trigger set_profiles_updated_at
before update on public.profiles
for each row execute function public.handle_updated_at();

create trigger set_team_years_updated_at
before update on public.team_years
for each row execute function public.handle_updated_at();

create trigger set_team_members_updated_at
before update on public.team_members
for each row execute function public.handle_updated_at();

create trigger set_programs_updated_at
before update on public.programs
for each row execute function public.handle_updated_at();

create trigger set_projects_updated_at
before update on public.projects
for each row execute function public.handle_updated_at();

create trigger set_events_updated_at
before update on public.events
for each row execute function public.handle_updated_at();

create trigger set_announcements_updated_at
before update on public.announcements
for each row execute function public.handle_updated_at();

create trigger set_donation_campaigns_updated_at
before update on public.donation_campaigns
for each row execute function public.handle_updated_at();

create trigger set_website_sections_updated_at
before update on public.website_sections
for each row execute function public.handle_updated_at();

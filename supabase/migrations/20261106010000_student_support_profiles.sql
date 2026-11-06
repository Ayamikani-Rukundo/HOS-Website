begin;

create table if not exists public.student_public_profiles (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null unique references public.children(id) on delete cascade,
  slug text not null unique,
  display_name text not null,
  profile_photo_url text,
  public_bio text,
  public_support_summary text,
  school_stage text,
  is_published boolean not null default false,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.student_support_updates (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.children(id) on delete cascade,
  occurred_on date not null default current_date,
  category text not null default 'education'
    check (category in ('education', 'nutrition', 'health', 'family', 'mentorship', 'other')),
  title text not null,
  private_notes text,
  public_summary text,
  is_public boolean not null default false,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint student_support_updates_public_summary_required check (
    not is_public or (
      category <> 'health'
      and nullif(trim(public_summary), '') is not null
    )
  )
);

create table if not exists public.student_directory_events (
  id uuid primary key default gen_random_uuid(),
  profile_slug text not null,
  created_at timestamptz not null default now()
);

create index if not exists student_support_updates_child_date_idx
  on public.student_support_updates (child_id, occurred_on desc);

insert into public.student_public_profiles (child_id, slug, display_name)
select
  children.id,
  lower(regexp_replace(
    coalesce(nullif(trim(concat_ws('-', children.first_name, children.last_name)), ''), 'student')
      || '-' || left(children.id::text, 8),
    '[^a-z0-9-]+',
    '-',
    'g'
  )),
  trim(concat_ws(' ', children.first_name, children.last_name))
from public.children as children
where not exists (
  select 1 from public.student_public_profiles as profiles where profiles.child_id = children.id
);

alter table public.student_public_profiles enable row level security;
alter table public.student_support_updates enable row level security;
alter table public.student_directory_events enable row level security;
grant select, insert, update, delete on public.student_public_profiles to authenticated;
grant select, insert, update, delete on public.student_support_updates to authenticated;
grant select on public.student_directory_events to anon, authenticated;
revoke all on public.student_public_profiles, public.student_support_updates from anon;
revoke insert, update, delete on public.student_directory_events from anon, authenticated;

drop policy if exists "public can observe safe student directory changes" on public.student_directory_events;
create policy "public can observe safe student directory changes" on public.student_directory_events
  for select to anon, authenticated using (true);

drop policy if exists "authorized staff manage student public profiles" on public.student_public_profiles;
create policy "authorized staff manage student public profiles" on public.student_public_profiles
  for all to authenticated
  using (public.has_any_role(array['admin', 'director', 'program_manager', 'case_worker', 'child_protection', 'education_support', 'health_nutrition']))
  with check (public.has_any_role(array['admin', 'director', 'program_manager', 'case_worker', 'child_protection', 'education_support', 'health_nutrition']));

drop policy if exists "authorized staff manage student support updates" on public.student_support_updates;
create policy "authorized staff manage student support updates" on public.student_support_updates
  for all to authenticated
  using (public.has_any_role(array['admin', 'director', 'program_manager', 'case_worker', 'child_protection', 'education_support', 'health_nutrition']))
  with check (public.has_any_role(array['admin', 'director', 'program_manager', 'case_worker', 'child_protection', 'education_support', 'health_nutrition']));

drop policy if exists "program managers manage student families" on public.families;
create policy "program managers manage student families" on public.families
  for all to authenticated
  using (public.has_any_role(array['admin', 'director', 'program_manager']))
  with check (public.has_any_role(array['admin', 'director', 'program_manager']));

drop policy if exists "program managers manage students" on public.children;
create policy "program managers manage students" on public.children
  for all to authenticated
  using (public.has_any_role(array['admin', 'director', 'program_manager']))
  with check (public.has_any_role(array['admin', 'director', 'program_manager']));

drop policy if exists "program managers read student assistance history" on public.assistance_records;
create policy "program managers read student assistance history" on public.assistance_records
  for select to authenticated
  using (public.has_any_role(array['admin', 'director', 'program_manager']));

create or replace function public.create_draft_student_public_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.student_public_profiles (child_id, slug, display_name)
  values (
    new.id,
    lower(regexp_replace(
      coalesce(nullif(trim(concat_ws('-', new.first_name, new.last_name)), ''), 'student')
        || '-' || left(new.id::text, 8),
      '[^a-z0-9-]+',
      '-',
      'g'
    )),
    trim(concat_ws(' ', new.first_name, new.last_name))
  )
  on conflict (child_id) do nothing;
  return new;
end;
$$;

drop trigger if exists create_draft_student_public_profile on public.children;
create trigger create_draft_student_public_profile
  after insert on public.children
  for each row execute function public.create_draft_student_public_profile();

create or replace function public.notify_student_directory_profile_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if old.is_published then
      insert into public.student_directory_events (profile_slug) values (old.slug);
    end if;
    return old;
  end if;

  if new.is_published then
    insert into public.student_directory_events (profile_slug) values (new.slug);
  elsif tg_op = 'UPDATE' and old.is_published then
    insert into public.student_directory_events (profile_slug) values (old.slug);
  end if;
  return new;
end;
$$;

create or replace function public.notify_student_directory_update_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  affected_child_id uuid;
begin
  affected_child_id := case when tg_op = 'DELETE' then old.child_id else new.child_id end;
  if exists (
    select 1
    from public.student_public_profiles as profiles
    where profiles.child_id = affected_child_id
      and profiles.is_published
  ) and (
    (tg_op <> 'DELETE' and new.is_public and new.category <> 'health' and nullif(trim(new.public_summary), '') is not null)
    or (tg_op <> 'INSERT' and old.is_public and old.category <> 'health' and nullif(trim(old.public_summary), '') is not null)
  ) then
    insert into public.student_directory_events (profile_slug)
    select profiles.slug
    from public.student_public_profiles as profiles
    where profiles.child_id = affected_child_id;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

revoke all on function public.create_draft_student_public_profile() from public, anon, authenticated;
revoke all on function public.notify_student_directory_profile_change() from public, anon, authenticated;
revoke all on function public.notify_student_directory_update_change() from public, anon, authenticated;

drop trigger if exists set_student_public_profiles_updated_at on public.student_public_profiles;
create trigger set_student_public_profiles_updated_at
  before update on public.student_public_profiles
  for each row execute function public.handle_updated_at();

drop trigger if exists set_student_support_updates_updated_at on public.student_support_updates;
create trigger set_student_support_updates_updated_at
  before update on public.student_support_updates
  for each row execute function public.handle_updated_at();

drop trigger if exists audit_student_public_profiles on public.student_public_profiles;
create trigger audit_student_public_profiles
  after insert or update or delete on public.student_public_profiles
  for each row execute function public.write_audit_event();

drop trigger if exists audit_student_support_updates on public.student_support_updates;
create trigger audit_student_support_updates
  after insert or update or delete on public.student_support_updates
  for each row execute function public.write_audit_event();

drop trigger if exists notify_student_directory_profile_change on public.student_public_profiles;
create trigger notify_student_directory_profile_change
  after insert or update or delete on public.student_public_profiles
  for each row execute function public.notify_student_directory_profile_change();

drop trigger if exists notify_student_directory_update_change on public.student_support_updates;
create trigger notify_student_directory_update_change
  after insert or update or delete on public.student_support_updates
  for each row execute function public.notify_student_directory_update_change();

create or replace view public.public_student_profiles
with (security_barrier = true)
as
  select
    slug,
    display_name,
    profile_photo_url,
    public_bio,
    public_support_summary,
    school_stage
  from public.student_public_profiles
  where is_published;

create or replace view public.public_student_updates
with (security_barrier = true)
as
  select
    profiles.slug,
    updates.occurred_on,
    updates.category,
    updates.public_summary
  from public.student_support_updates as updates
  join public.student_public_profiles as profiles on profiles.child_id = updates.child_id
  where profiles.is_published
    and updates.is_public
    and updates.category <> 'health'
    and nullif(trim(updates.public_summary), '') is not null;

grant select on public.public_student_profiles, public.public_student_updates to anon, authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'student_directory_events') then
      alter publication supabase_realtime add table public.student_directory_events;
    end if;
  end if;
end $$;

drop policy if exists "authorized staff upload public HOS media" on storage.objects;
create policy "authorized staff upload public HOS media" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'hos-public'
    and (
      public.has_any_role(array['admin', 'director', 'communications'])
      or (
        name like 'student-profiles/%/%'
        and public.has_any_role(array['admin', 'director', 'program_manager'])
        and exists (
          select 1
          from public.student_public_profiles as profiles
          where profiles.id::text = split_part(name, '/', 2)
            and profiles.is_published
        )
      )
    )
  );

drop policy if exists "authorized staff delete public HOS media" on storage.objects;
create policy "authorized staff delete public HOS media" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'hos-public'
    and (
      public.has_any_role(array['admin', 'director', 'communications'])
      or (
        name like 'student-profiles/%/%'
        and public.has_any_role(array['admin', 'director', 'program_manager', 'case_worker', 'child_protection', 'education_support', 'health_nutrition'])
      )
    )
  );

commit;

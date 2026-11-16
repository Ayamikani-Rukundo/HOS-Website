begin;

alter table public.children
  alter column family_id drop not null,
  drop column if exists child_code;

alter table public.case_records
  alter column family_id drop not null;

alter table public.assistance_records
  alter column family_id drop not null;

alter table public.families
  drop column if exists household_code;

alter table public.student_public_profiles
  add column if not exists family_display_name text,
  add column if not exists family_district text;

create or replace view public.public_student_profiles
with (security_barrier = true)
as
  select
    slug,
    display_name,
    profile_photo_url,
    public_bio,
    school_stage,
    family_display_name,
    family_district
  from public.student_public_profiles
  where is_published;

grant select on public.public_student_profiles to anon, authenticated;

commit;

begin;

drop view if exists public.public_student_updates;
drop view if exists public.public_student_profiles;

create view public.public_student_profiles
with (security_barrier = true)
as
  select
    slug,
    display_name,
    profile_photo_url,
    public_bio,
    school_stage
  from public.student_public_profiles
  where is_published;

grant select on public.public_student_profiles to anon, authenticated;

drop policy if exists "authorized staff upload public HOS media" on storage.objects;
create policy "authorized staff upload public HOS media" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'hos-public'
    and (
      public.has_any_role(array['admin', 'director', 'communications'])
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

commit;

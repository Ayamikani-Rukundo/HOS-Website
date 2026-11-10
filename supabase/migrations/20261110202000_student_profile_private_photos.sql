begin;

alter table public.student_public_profiles
  add column if not exists private_photo_path text;

drop policy if exists "program staff manage private student profile photos" on storage.objects;
create policy "program staff manage private student profile photos" on storage.objects
  for all to authenticated
  using (
    bucket_id = 'hos-private'
    and name like 'student-profile-drafts/%/%'
    and public.has_any_role(array[
      'admin',
      'director',
      'program_manager',
      'case_worker',
      'child_protection',
      'education_support',
      'health_nutrition'
    ])
  )
  with check (
    bucket_id = 'hos-private'
    and name like 'student-profile-drafts/%/%'
    and public.has_any_role(array[
      'admin',
      'director',
      'program_manager',
      'case_worker',
      'child_protection',
      'education_support',
      'health_nutrition'
    ])
  );

commit;

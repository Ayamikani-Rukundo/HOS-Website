drop policy if exists "program staff manage projects" on public.projects;
drop policy if exists "management read projects" on public.projects;
create policy "management read projects" on public.projects
  for select to authenticated
  using (public.has_any_role(array['admin', 'director', 'management']));
create policy "authorized staff manage projects" on public.projects
  for all to authenticated
  using (public.has_any_role(array[
    'admin', 'it_data', 'communications', 'program_manager', 'case_worker'
  ]))
  with check (public.has_any_role(array[
    'admin', 'it_data', 'communications', 'program_manager', 'case_worker'
  ]));

drop policy if exists "fundraisers manage categories" on public.campaign_categories;
create policy "fundraising staff manage categories" on public.campaign_categories
  for all to authenticated
  using (public.has_any_role(array['admin', 'fundraiser']))
  with check (public.has_any_role(array['admin', 'fundraiser']));

drop policy if exists "fundraisers manage campaigns" on public.donation_campaigns;
drop policy if exists "finance and management read campaigns" on public.donation_campaigns;
create policy "finance and management read campaigns" on public.donation_campaigns
  for select to authenticated
  using (public.has_any_role(array[
    'admin', 'director', 'management', 'finance', 'fundraiser'
  ]));
create policy "fundraising staff manage campaigns" on public.donation_campaigns
  for all to authenticated
  using (public.has_any_role(array['admin', 'fundraiser']))
  with check (public.has_any_role(array['admin', 'fundraiser']));

drop policy if exists "authorized program staff manage project campaigns" on public.project_campaigns;
drop policy if exists "management read project campaigns" on public.project_campaigns;
create policy "management read project campaigns" on public.project_campaigns
  for select to authenticated
  using (public.has_any_role(array[
    'admin', 'director', 'management', 'finance', 'fundraiser'
  ]));
create policy "authorized staff manage project campaigns" on public.project_campaigns
  for all to authenticated
  using (public.has_any_role(array['admin', 'program_manager', 'fundraiser']))
  with check (public.has_any_role(array['admin', 'program_manager', 'fundraiser']));

drop policy if exists "authorized program staff manage project events" on public.project_events;
drop policy if exists "management read project events" on public.project_events;
create policy "management read project events" on public.project_events
  for select to authenticated
  using (public.has_any_role(array[
    'admin', 'director', 'management', 'communications'
  ]));
create policy "authorized staff manage project events" on public.project_events
  for all to authenticated
  using (public.has_any_role(array['admin', 'program_manager', 'communications']))
  with check (public.has_any_role(array['admin', 'program_manager', 'communications']));

drop policy if exists "finance staff manage donors" on public.donors;
create policy "fundraising staff manage donors" on public.donors
  for all to authenticated
  using (public.has_any_role(array['admin', 'fundraiser']))
  with check (public.has_any_role(array['admin', 'fundraiser']));

drop policy if exists "finance staff manage donations" on public.donations;
create policy "finance staff manage donations" on public.donations
  for all to authenticated
  using (public.has_any_role(array['admin', 'finance']))
  with check (public.has_any_role(array['admin', 'finance']));

drop policy if exists "authorized case staff manage families" on public.families;
create policy "authorized case staff manage families" on public.families
  for all to authenticated
  using (public.has_any_role(array[
    'admin', 'program_manager', 'case_worker', 'child_protection',
    'education_support', 'health_nutrition'
  ]))
  with check (public.has_any_role(array[
    'admin', 'program_manager', 'case_worker', 'child_protection',
    'education_support', 'health_nutrition'
  ]));

drop policy if exists "authorized case staff manage children" on public.children;
create policy "authorized case staff manage children" on public.children
  for all to authenticated
  using (public.has_any_role(array[
    'admin', 'program_manager', 'case_worker', 'child_protection',
    'education_support', 'health_nutrition'
  ]))
  with check (public.has_any_role(array[
    'admin', 'program_manager', 'case_worker', 'child_protection',
    'education_support', 'health_nutrition'
  ]));

drop policy if exists "authorized case staff manage cases" on public.case_records;
create policy "authorized case staff manage cases" on public.case_records
  for all to authenticated
  using (public.has_any_role(array[
    'admin', 'program_manager', 'case_worker', 'child_protection',
    'education_support', 'health_nutrition'
  ]))
  with check (public.has_any_role(array[
    'admin', 'program_manager', 'case_worker', 'child_protection',
    'education_support', 'health_nutrition'
  ]));

drop policy if exists "authorized case staff manage case notes" on public.case_notes;
create policy "authorized case staff manage case notes" on public.case_notes
  for all to authenticated
  using (
    public.has_any_role(array[
      'admin', 'program_manager', 'case_worker', 'child_protection',
      'education_support', 'health_nutrition'
    ])
    and (visibility = 'internal' or public.has_any_role(array['admin', 'case_worker']))
  )
  with check (
    public.has_any_role(array[
      'admin', 'program_manager', 'case_worker', 'child_protection',
      'education_support', 'health_nutrition'
    ])
    and (visibility = 'internal' or public.has_any_role(array['admin', 'case_worker']))
  );

drop policy if exists "authorized program staff manage assistance" on public.assistance_records;
create policy "authorized program staff manage assistance" on public.assistance_records
  for all to authenticated
  using (public.has_any_role(array[
    'admin', 'program_manager', 'case_worker', 'finance',
    'child_protection', 'education_support', 'health_nutrition'
  ]))
  with check (public.has_any_role(array[
    'admin', 'program_manager', 'case_worker', 'finance',
    'child_protection', 'education_support', 'health_nutrition'
  ]));

drop policy if exists "secretariat manage documents" on public.secretariat_documents;
drop policy if exists "management read secretariat documents" on public.secretariat_documents;
create policy "management read secretariat documents" on public.secretariat_documents
  for select to authenticated
  using (public.has_any_role(array[
    'admin', 'director', 'management', 'secretariat'
  ]));
create policy "secretariat staff manage documents" on public.secretariat_documents
  for all to authenticated
  using (public.has_any_role(array['admin', 'secretariat']))
  with check (public.has_any_role(array['admin', 'secretariat']));

drop policy if exists "staff manage own department updates" on public.department_updates;
create policy "staff manage own department updates" on public.department_updates
  for all to authenticated
  using (
    (submitted_by = auth.uid() and public.has_any_role(array[
      'program_manager', 'case_worker', 'education_support',
      'health_nutrition', 'child_protection', 'secretariat'
    ]))
    or public.has_any_role(array['admin', 'program_manager'])
  )
  with check (
    (
      submitted_by = auth.uid()
      and public.has_any_role(array[
        'program_manager', 'case_worker', 'education_support',
        'health_nutrition', 'child_protection', 'secretariat'
      ])
    )
    or public.has_any_role(array['admin', 'program_manager'])
  );

drop policy if exists "volunteer managers manage applications" on public.volunteer_applications;
create policy "secretariat staff manage volunteer applications" on public.volunteer_applications
  for all to authenticated
  using (public.has_any_role(array['admin', 'secretariat', 'volunteer_manager', 'hr']))
  with check (public.has_any_role(array['admin', 'secretariat', 'volunteer_manager', 'hr']));

drop policy if exists "volunteer managers manage volunteers" on public.volunteers;
create policy "secretariat staff manage volunteers" on public.volunteers
  for all to authenticated
  using (public.has_any_role(array['admin', 'secretariat', 'volunteer_manager', 'hr']))
  with check (public.has_any_role(array['admin', 'secretariat', 'volunteer_manager', 'hr']));

drop policy if exists "volunteer managers manage assignments" on public.volunteer_assignments;
create policy "secretariat staff manage volunteer assignments" on public.volunteer_assignments
  for all to authenticated
  using (public.has_any_role(array['admin', 'secretariat', 'volunteer_manager', 'program_manager']))
  with check (public.has_any_role(array['admin', 'secretariat', 'volunteer_manager', 'program_manager']));

drop policy if exists "newsletter managers read subscribers" on public.newsletter_subscribers;
create policy "communications read subscribers" on public.newsletter_subscribers
  for select to authenticated
  using (public.has_any_role(array['admin', 'communications']));
drop policy if exists "newsletter managers update subscribers" on public.newsletter_subscribers;
create policy "communications update subscribers" on public.newsletter_subscribers
  for update to authenticated
  using (public.has_any_role(array['admin', 'communications']))
  with check (public.has_any_role(array['admin', 'communications']));

drop policy if exists "staff manage contact messages" on public.contact_messages;
create policy "communications manage contact messages" on public.contact_messages
  for all to authenticated
  using (public.has_any_role(array['admin', 'communications']))
  with check (public.has_any_role(array['admin', 'communications']));

drop policy if exists "users read own profile" on public.profiles;
create policy "users read own profile" on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.has_any_role(array['admin', 'hr']));
drop policy if exists "users update own profile" on public.profiles;
create policy "users update own profile" on public.profiles
  for update to authenticated
  using (id = auth.uid() or public.has_any_role(array['admin', 'hr']))
  with check (id = auth.uid() or public.has_any_role(array['admin', 'hr']));
drop policy if exists "admins manage profiles" on public.profiles;
create policy "admins manage profiles" on public.profiles
  for insert to authenticated
  with check (public.has_any_role(array['admin', 'hr']));

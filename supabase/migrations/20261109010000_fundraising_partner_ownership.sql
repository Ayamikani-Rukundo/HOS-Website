begin;

drop policy if exists "communications and volunteers manage partners" on public.partner_organizations;

create policy "staff read partner organizations"
  on public.partner_organizations
  for select to authenticated
  using (public.has_any_role(array['admin', 'communications', 'volunteer_manager', 'fundraiser']));

create policy "fundraising and admins manage partners"
  on public.partner_organizations
  for all to authenticated
  using (public.has_any_role(array['admin', 'fundraiser']))
  with check (public.has_any_role(array['admin', 'fundraiser']));

create policy "fundraising and admins manage partner logos"
  on storage.objects
  for all to authenticated
  using (
    bucket_id = 'hos-public'
    and (name like 'partner-organizations/%' or name like 'partner_organizations/%')
    and public.has_any_role(array['admin', 'fundraiser'])
  )
  with check (
    bucket_id = 'hos-public'
    and (name like 'partner-organizations/%' or name like 'partner_organizations/%')
    and public.has_any_role(array['admin', 'fundraiser'])
  );

create policy "only fundraising staff can insert partner logos"
  on storage.objects as restrictive
  for insert to authenticated
  with check (
    bucket_id <> 'hos-public'
    or (name not like 'partner-organizations/%' and name not like 'partner_organizations/%')
    or public.has_any_role(array['admin', 'fundraiser'])
  );

create policy "only fundraising staff can update partner logos"
  on storage.objects as restrictive
  for update to authenticated
  using (
    bucket_id <> 'hos-public'
    or (name not like 'partner-organizations/%' and name not like 'partner_organizations/%')
    or public.has_any_role(array['admin', 'fundraiser'])
  )
  with check (
    bucket_id <> 'hos-public'
    or (name not like 'partner-organizations/%' and name not like 'partner_organizations/%')
    or public.has_any_role(array['admin', 'fundraiser'])
  );

create policy "only fundraising staff can delete partner logos"
  on storage.objects as restrictive
  for delete to authenticated
  using (
    bucket_id <> 'hos-public'
    or (name not like 'partner-organizations/%' and name not like 'partner_organizations/%')
    or public.has_any_role(array['admin', 'fundraiser'])
  );

commit;
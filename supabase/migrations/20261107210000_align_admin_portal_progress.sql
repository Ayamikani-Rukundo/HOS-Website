begin;

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
      ('communications', 'events', 'archived_at is null'),
      ('communications', 'announcements', 'archived_at is null'),
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
      ('fundraising', 'grant_opportunities', 'archived_at is null and status <> ''archived''')
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

commit;

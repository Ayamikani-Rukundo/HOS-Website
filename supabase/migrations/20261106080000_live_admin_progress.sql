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
      ('communications', 'team_members', 'is_published = true and status = ''active'''),
      ('communications', 'programs', 'is_published = true'),
      ('communications', 'partner_organizations', 'is_published = true and archived_at is null'),
      ('communications', 'events', 'is_published = true and status = ''published'' and archived_at is null'),
      ('communications', 'announcements', 'is_published = true and status = ''published'' and audience = ''public'' and archived_at is null'),
      ('communications', 'galleries', 'is_published = true and archived_at is null'),
      ('communications', 'contact_messages', 'true'),
      ('communications', 'newsletter_subscribers', 'is_confirmed = true and unsubscribed_at is null'),
      ('secretariat', 'secretariat_documents', 'archived_at is null and status <> ''archived'''),
      ('secretariat', 'volunteer_applications', 'true'),
      ('secretariat', 'volunteers', 'status <> ''inactive'''),
      ('secretariat', 'contact_details', 'is_public = true and archived_at is null'),
      ('secretariat', 'social_links', 'is_active = true and archived_at is null'),
      ('volunteer_management', 'volunteers', 'status <> ''inactive'''),
      ('volunteer_management', 'volunteer_applications', 'true'),
      ('volunteer_management', 'partner_organizations', 'is_published = true and archived_at is null'),
      ('finance', 'donations', 'true'),
      ('finance', 'donors', 'true'),
      ('finance', 'finance_transactions', 'archived_at is null'),
      ('finance', 'donation_methods', 'is_active = true'),
      ('programs', 'families', 'status <> ''closed'''),
      ('programs', 'children', 'status <> ''closed'''),
      ('programs', 'student_support_updates', 'true'),
      ('programs', 'assistance_records', 'true'),
      ('programs', 'programs', 'is_published = true'),
      ('fundraising', 'campaign_categories', 'is_published = true and archived_at is null'),
      ('fundraising', 'donation_campaigns', 'is_published = true and status = ''active'' and archived_at is null'),
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

create or replace function public.delete_audit_events_by_ids(p_event_ids bigint[])
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  removed_count integer;
begin
  if auth.uid() is null or not public.has_any_role(array['admin']) then
    raise exception 'Only administrators can remove audit history.';
  end if;
  if p_event_ids is null or cardinality(p_event_ids) = 0 then
    raise exception 'Select at least one audit entry.';
  end if;

  delete from public.audit_events
  where id = any(p_event_ids);
  get diagnostics removed_count = row_count;

  return removed_count;
end;
$$;

drop function if exists public.delete_audit_events_by_ids(uuid[]);

revoke all on function public.get_admin_portal_metrics() from public, anon;
grant execute on function public.get_admin_portal_metrics() to authenticated;
revoke all on function public.delete_audit_events_by_ids(bigint[]) from public, anon;
grant execute on function public.delete_audit_events_by_ids(bigint[]) to authenticated;

do $$
declare
  target_table text;
begin
  foreach target_table in array array[
    'organizations', 'website_sections', 'team_members', 'programs',
    'partner_organizations', 'events', 'announcements', 'galleries',
    'contact_messages', 'newsletter_subscribers', 'secretariat_documents',
    'volunteer_applications', 'volunteers', 'contact_details', 'social_links',
    'volunteer_assignments', 'donations', 'donors', 'finance_transactions',
    'donation_methods', 'families', 'children', 'student_support_updates',
    'assistance_records', 'campaign_categories', 'donation_campaigns',
    'grant_opportunities'
  ]
  loop
    execute format('drop trigger if exists write_audit_event on public.%I', target_table);
    execute format(
      'create trigger write_audit_event after insert or update or delete on public.%I for each row execute function public.write_audit_event()',
      target_table
    );
  end loop;

  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
    and not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'audit_events'
    )
  then
    alter publication supabase_realtime add table public.audit_events;
  end if;
end
$$;

commit;

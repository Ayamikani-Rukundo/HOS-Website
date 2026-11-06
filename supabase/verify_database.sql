-- Run after applying the project's Supabase migrations, including
-- 20261106060000_giving_areas_and_subscriber_cleanup.sql.
-- These checks are read-only and do not display contact, child, donor, or case data.

with expected_tables(table_name) as (
  values
    ('organizations'),
    ('profiles'),
    ('user_roles'),
    ('team_years'),
    ('team_members'),
    ('programs'),
    ('projects'),
    ('events'),
    ('announcements'),
    ('campaign_categories'),
    ('donation_campaigns'),
    ('donation_methods'),
    ('galleries'),
    ('social_links'),
    ('contact_details'),
    ('website_sections'),
    ('newsletter_subscribers'),
    ('contact_messages'),
    ('volunteer_applications'),
    ('families'),
    ('children'),
    ('case_records'),
    ('case_notes'),
    ('assistance_records'),
    ('volunteers'),
    ('volunteer_assignments'),
    ('donors'),
    ('donations'),
    ('audit_events'),
    ('impact_metrics'),
    ('success_stories'),
    ('project_campaigns'),
    ('project_events'),
    ('email_notification_jobs'),
    ('email_notification_deliveries'),
    ('secretariat_documents'),
    ('department_updates'),
    ('website_page_views'),
    ('notification_preferences'),
    ('grant_opportunities')
)
select
  expected_tables.table_name,
  (relation.oid is not null) as table_exists,
  coalesce(relation.relrowsecurity, false) as row_level_security_enabled
from expected_tables
left join pg_class relation
  on relation.oid = to_regclass('public.' || expected_tables.table_name)
order by expected_tables.table_name;

select
  'hos-public' as bucket,
  exists(select 1 from storage.buckets where id = 'hos-public' and public) as configured
union all
select
  'hos-private',
  exists(select 1 from storage.buckets where id = 'hos-private' and not public);

select
  'public organization record' as check_name,
  exists(select 1 from public.organizations) as passed
union all
select
  'four starter programs',
  (select count(*) from public.programs where slug in (
    'education-sponsorship', 'nutrition-health', 'family-support', 'mentorship'
  )) = 4
union all
select
  'three historical team-year records',
  (select count(*) from public.team_years where year_label in (
    '2024–2025', '2025–2026', '2026–2027'
  )) = 3
union all
select
  'role-check function',
  to_regprocedure('public.has_any_role(text[])') is not null
union all
select
  'newsletter subscribe function',
  to_regprocedure('public.subscribe_newsletter(text,text,text,boolean)') is not null
union all
select
  'newsletter unsubscribe function',
  to_regprocedure('public.unsubscribe_newsletter(text)') is not null
union all
select
  'giving area category column',
  exists(
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'donation_campaigns'
      and column_name = 'category'
  )
union all
select
  'giving area image upload policy',
  exists(
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'authorized staff upload public giving and program media'
  )
union all
select
  'newsletter subscribers in Realtime',
  exists(
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'newsletter_subscribers'
  )
union all
select
  'admin staff directory function',
  to_regprocedure('public.get_staff_directory()') is not null
union all
select
  'Realtime publication available',
  exists(select 1 from pg_publication where pubname = 'supabase_realtime');

select
  tablename,
  count(*) as policy_count
from pg_policies
where schemaname = 'public'
  and tablename in (
    'organizations', 'programs', 'team_years', 'team_members',
    'contact_messages', 'families', 'children', 'donations', 'user_roles',
    'grant_opportunities'
  )
group by tablename
order by tablename;

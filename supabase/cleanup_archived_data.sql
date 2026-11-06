-- One-time cleanup of records marked archived, inactive, closed, cancelled, or unpublished.
-- This does not drop tables. Foreign-key cascades can remove linked records,
-- including student profiles/support updates when their child record is deleted.
-- Review this file before running; retained linked families are reported below.
begin;

do $$
declare
  deleted_rows bigint;
  retained_families bigint;
  retained_volunteers bigint;
begin
  delete from public.newsletter_subscribers
  where unsubscribed_at is not null or is_confirmed = false;
  get diagnostics deleted_rows = row_count;
  raise notice 'Purged % newsletter_subscribers', deleted_rows;

  delete from public.events
  where archived_at is not null
    or is_published = false
    or status in ('draft', 'cancelled', 'archived');
  get diagnostics deleted_rows = row_count;
  raise notice 'Purged % events', deleted_rows;

  delete from public.announcements
  where archived_at is not null
    or is_published = false
    or status in ('draft', 'archived');
  get diagnostics deleted_rows = row_count;
  raise notice 'Purged % announcements', deleted_rows;

  delete from public.donation_campaigns
  where archived_at is not null
    or is_published = false
    or status in ('inactive', 'archived', 'cancelled');
  get diagnostics deleted_rows = row_count;
  raise notice 'Purged % donation_campaigns', deleted_rows;

  delete from public.campaign_categories as category
  where (
      category.archived_at is not null
      or category.is_published = false
    )
    and not exists (
      select 1
      from public.donation_campaigns as campaign
      where campaign.category_id = category.id
    );
  get diagnostics deleted_rows = row_count;
  raise notice 'Purged % unreferenced campaign_categories', deleted_rows;

  delete from public.team_years as team_year
  where (team_year.active = false or team_year.is_published = false)
    and not exists (
      select 1
      from public.team_members as member
      where member.team_year_id = team_year.id
        and member.status = 'active'
        and member.is_published = true
    );
  get diagnostics deleted_rows = row_count;
  raise notice 'Purged % team_years (their team_members cascade)', deleted_rows;

  delete from public.team_members
  where status in ('inactive', 'archived') or is_published = false;
  get diagnostics deleted_rows = row_count;
  raise notice 'Purged % team_members', deleted_rows;

  delete from public.programs
  where is_published = false;
  get diagnostics deleted_rows = row_count;
  raise notice 'Purged % programs', deleted_rows;

  delete from public.partner_organizations
  where archived_at is not null or is_published = false;
  get diagnostics deleted_rows = row_count;
  raise notice 'Purged % partner_organizations', deleted_rows;

  delete from public.galleries
  where archived_at is not null or is_published = false;
  get diagnostics deleted_rows = row_count;
  raise notice 'Purged % galleries', deleted_rows;

  delete from public.website_sections
  where is_published = false;
  get diagnostics deleted_rows = row_count;
  raise notice 'Purged % website_sections', deleted_rows;

  delete from public.contact_details
  where archived_at is not null or is_public = false;
  get diagnostics deleted_rows = row_count;
  raise notice 'Purged % contact_details', deleted_rows;

  delete from public.social_links
  where archived_at is not null or is_active = false;
  get diagnostics deleted_rows = row_count;
  raise notice 'Purged % social_links', deleted_rows;

  delete from public.volunteer_assignments
  where status = 'cancelled';
  get diagnostics deleted_rows = row_count;
  raise notice 'Purged % volunteer_assignments', deleted_rows;

  delete from public.volunteers
  where status = 'inactive'
    and not exists (
      select 1
      from public.volunteer_assignments as assignment
      where assignment.volunteer_id = volunteers.id
    );
  get diagnostics deleted_rows = row_count;
  raise notice 'Purged % inactive volunteers without remaining assignments', deleted_rows;

  select count(*) into retained_volunteers
  from public.volunteers as volunteer
  where volunteer.status = 'inactive'
    and exists (
      select 1
      from public.volunteer_assignments as assignment
      where assignment.volunteer_id = volunteer.id
    );
  raise notice 'Retained % inactive volunteers still referenced by assignments', retained_volunteers;

  delete from public.donation_methods
  where is_active = false or is_public = false;
  get diagnostics deleted_rows = row_count;
  raise notice 'Purged % donation_methods', deleted_rows;

  delete from public.finance_transactions
  where archived_at is not null or status in ('draft', 'cancelled');
  get diagnostics deleted_rows = row_count;
  raise notice 'Purged % finance_transactions', deleted_rows;

  delete from public.secretariat_documents
  where archived_at is not null or status in ('draft', 'archived');
  get diagnostics deleted_rows = row_count;
  raise notice 'Purged % secretariat_documents', deleted_rows;

  delete from public.department_updates
  where status in ('draft', 'archived');
  get diagnostics deleted_rows = row_count;
  raise notice 'Purged % department_updates', deleted_rows;

  delete from public.grant_opportunities
  where archived_at is not null or status = 'archived';
  get diagnostics deleted_rows = row_count;
  raise notice 'Purged % grant_opportunities', deleted_rows;

  delete from public.email_notification_jobs
  where status = 'cancelled';
  get diagnostics deleted_rows = row_count;
  raise notice 'Purged % email_notification_jobs (delivery rows cascade)', deleted_rows;

  delete from public.student_public_profiles
  where is_published = false;
  get diagnostics deleted_rows = row_count;
  raise notice 'Purged % unpublished student_public_profiles', deleted_rows;

  delete from public.children
  where status in ('inactive', 'closed');
  get diagnostics deleted_rows = row_count;
  raise notice 'Purged % inactive/closed children (profiles and support updates cascade)', deleted_rows;

  delete from public.case_records
  where status = 'closed';
  get diagnostics deleted_rows = row_count;
  raise notice 'Purged % closed case_records (case_notes cascade)', deleted_rows;

  delete from public.families as family
  where family.status in ('inactive', 'closed')
    and not exists (select 1 from public.children child where child.family_id = family.id)
    and not exists (select 1 from public.case_records case_row where case_row.family_id = family.id)
    and not exists (select 1 from public.assistance_records assistance where assistance.family_id = family.id);
  get diagnostics deleted_rows = row_count;
  raise notice 'Purged % unreferenced inactive/closed families', deleted_rows;

  select count(*) into retained_families
  from public.families as family
  where family.status in ('inactive', 'closed')
    and (
      exists (select 1 from public.children child where child.family_id = family.id)
      or exists (select 1 from public.case_records case_row where case_row.family_id = family.id)
      or exists (select 1 from public.assistance_records assistance where assistance.family_id = family.id)
    );
  raise notice 'Retained % inactive/closed families still referenced by student, case, or assistance records', retained_families;
end;
$$;

commit;

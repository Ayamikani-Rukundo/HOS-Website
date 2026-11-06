begin;

alter table public.donation_campaigns
  add column if not exists category text;

update public.donation_campaigns as giving_area
set category = coalesce(category_record.name, 'General support')
from public.campaign_categories as category_record
where giving_area.category_id = category_record.id
  and giving_area.category is null;

update public.donation_campaigns
set category = coalesce(nullif(trim(title), ''), 'General support')
where category is null;

alter table public.donation_campaigns
  alter column category set default 'General support',
  alter column category set not null;

update public.donation_campaigns
set is_published = true
where status = 'active'
  and archived_at is null;

alter table public.donation_campaigns
  alter column is_published set default true;

update public.donation_methods
set is_active = true,
    is_public = true;

alter table public.donation_methods
  alter column is_active set default true,
  alter column is_public set default true;

update public.newsletter_subscribers
set is_confirmed = true
where unsubscribed_at is null;

delete from public.newsletter_subscribers
where unsubscribed_at is not null;

drop function if exists public.unsubscribe_newsletter(text);
create function public.unsubscribe_newsletter(p_token_hash text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_token_hash is null or p_token_hash !~ '^[a-f0-9]{64}$' then
    return false;
  end if;

  delete from public.newsletter_subscribers
  where unsubscribe_token_hash = p_token_hash;
  return found;
end;
$$;

create or replace function public.subscribe_newsletter(
  p_email text,
  p_token_hash text,
  p_source text,
  p_consented boolean
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_email is null
    or char_length(p_email) not between 5 and 254
    or p_email !~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$'
    or p_token_hash is null
    or p_token_hash !~ '^[a-f0-9]{64}$'
    or p_source is null
    or char_length(p_source) not between 1 and 200
    or p_consented is not true then
    return false;
  end if;

  insert into public.newsletter_subscribers (
    email, is_confirmed, unsubscribe_token_hash, consented_at, source, unsubscribed_at
  )
  values (
    lower(trim(p_email)), true, p_token_hash, now(), p_source, null
  )
  on conflict (email) do update
    set is_confirmed = true,
        unsubscribe_token_hash = excluded.unsubscribe_token_hash,
        consented_at = excluded.consented_at,
        source = excluded.source,
        unsubscribed_at = null;
  return true;
end;
$$;

revoke all on function public.subscribe_newsletter(text, text, text, boolean) from public;
revoke all on function public.unsubscribe_newsletter(text) from public;
grant execute on function public.subscribe_newsletter(text, text, text, boolean) to anon, authenticated;
grant execute on function public.unsubscribe_newsletter(text) to anon, authenticated;

drop policy if exists "authorized staff upload public giving and program media" on storage.objects;
create policy "authorized staff upload public giving and program media" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'hos-public'
    and (
      (
        name like 'donation-campaigns/%'
        and public.has_any_role(array['admin', 'fundraiser'])
      )
      or (
        name like 'programs/%'
        and public.has_any_role(array['admin', 'communications', 'program_manager'])
      )
      or (
        (name like 'partner-organizations/%' or name like 'partner_organizations/%')
        and public.has_any_role(array['admin', 'communications', 'volunteer_manager'])
      )
    )
  );

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
    and not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'newsletter_subscribers'
    )
  then
    alter publication supabase_realtime add table public.newsletter_subscribers;
  end if;
end $$;

commit;

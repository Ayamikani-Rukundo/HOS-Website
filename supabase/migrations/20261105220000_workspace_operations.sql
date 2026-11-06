create table if not exists public.finance_transactions (
  id uuid primary key default gen_random_uuid(),
  transaction_type text not null check (transaction_type in ('income', 'expense', 'team_contribution')),
  category text not null,
  description text not null,
  amount numeric(14,2) not null check (amount > 0),
  currency_code text not null default 'RWF',
  transaction_date date not null default current_date,
  payment_method text,
  reference_number text,
  document_url text,
  document_path text,
  document_name text,
  notes text,
  status text not null default 'confirmed' check (status in ('draft', 'confirmed', 'cancelled')),
  recorded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

create index if not exists idx_finance_transactions_date
  on public.finance_transactions(transaction_date desc)
  where archived_at is null;

alter table public.finance_transactions enable row level security;
grant select, insert, update, delete on public.finance_transactions to authenticated;

drop policy if exists "finance staff manage transactions" on public.finance_transactions;
create policy "finance staff manage transactions" on public.finance_transactions
  for all to authenticated
  using (public.has_any_role(array['admin', 'finance']))
  with check (public.has_any_role(array['admin', 'finance']));

drop trigger if exists set_finance_transactions_updated_at on public.finance_transactions;
create trigger set_finance_transactions_updated_at
  before update on public.finance_transactions
  for each row execute function public.handle_updated_at();

drop trigger if exists write_audit_event on public.finance_transactions;
create trigger write_audit_event
  after insert or update or delete on public.finance_transactions
  for each row execute function public.write_audit_event();

drop policy if exists "communications manage public programs" on public.programs;
create policy "program staff manage programs" on public.programs
  for all to authenticated
  using (public.has_any_role(array['admin', 'communications', 'program_manager']))
  with check (public.has_any_role(array['admin', 'communications', 'program_manager']));

drop policy if exists "newsletter managers read subscribers" on public.newsletter_subscribers;
drop policy if exists "newsletter managers update subscribers" on public.newsletter_subscribers;
create policy "communications and volunteers manage subscribers" on public.newsletter_subscribers
  for all to authenticated
  using (public.has_any_role(array['admin', 'communications', 'volunteer_manager']))
  with check (public.has_any_role(array['admin', 'communications', 'volunteer_manager']));
grant select, insert, update, delete on public.newsletter_subscribers to authenticated;

drop policy if exists "staff manage contact messages" on public.contact_messages;
create policy "communications and volunteers manage contact messages" on public.contact_messages
  for all to authenticated
  using (public.has_any_role(array['admin', 'communications', 'volunteer_manager']))
  with check (public.has_any_role(array['admin', 'communications', 'volunteer_manager']));

drop policy if exists "admins manage contact details" on public.contact_details;
drop policy if exists "communications manage contact details" on public.contact_details;
create policy "communications and volunteers manage contact details" on public.contact_details
  for all to authenticated
  using (public.has_any_role(array['admin', 'it_data', 'communications', 'volunteer_manager']))
  with check (public.has_any_role(array['admin', 'it_data', 'communications', 'volunteer_manager']));

drop policy if exists "admins manage social links" on public.social_links;
drop policy if exists "communications manage social links" on public.social_links;
create policy "communications and volunteers manage social links" on public.social_links
  for all to authenticated
  using (public.has_any_role(array['admin', 'it_data', 'communications', 'volunteer_manager']))
  with check (public.has_any_role(array['admin', 'it_data', 'communications', 'volunteer_manager']));

create or replace function public.purge_audit_events(p_from date, p_through date)
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
  if p_from is null or p_through is null or p_through < p_from then
    raise exception 'Choose a valid date range.';
  end if;

  delete from public.audit_events
  where occurred_at >= p_from::timestamptz
    and occurred_at < (p_through + 1)::timestamptz;
  get diagnostics removed_count = row_count;

  insert into public.audit_events (table_name, action, actor_id)
  values ('audit_events', 'DELETE', auth.uid());

  return removed_count;
end;
$$;

revoke all on function public.purge_audit_events(date, date) from public, anon;
grant execute on function public.purge_audit_events(date, date) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'secretariat-documents',
  'secretariat-documents',
  false,
  20971520,
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
    'image/jpeg',
    'image/png'
  ]
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'finance-documents',
  'finance-documents',
  false,
  20971520,
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
    'image/jpeg',
    'image/png'
  ]
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "secretariat staff manage private documents" on storage.objects;
create policy "secretariat staff manage private documents" on storage.objects
  for all to authenticated
  using (
    bucket_id = 'secretariat-documents'
    and public.has_any_role(array['admin', 'secretariat'])
  )
  with check (
    bucket_id = 'secretariat-documents'
    and public.has_any_role(array['admin', 'secretariat'])
  );

drop policy if exists "finance staff manage private documents" on storage.objects;
create policy "finance staff manage private documents" on storage.objects
  for all to authenticated
  using (
    bucket_id = 'finance-documents'
    and public.has_any_role(array['admin', 'finance'])
  )
  with check (
    bucket_id = 'finance-documents'
    and public.has_any_role(array['admin', 'finance'])
  );

do $$
declare
  target_table text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach target_table in array array[
      'organizations', 'programs', 'team_years', 'team_members', 'projects',
      'donation_campaigns', 'campaign_categories', 'impact_metrics',
      'success_stories', 'events', 'announcements', 'galleries',
      'contact_details', 'social_links', 'website_sections'
    ]
    loop
      if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = target_table
      ) then
        execute format('alter publication supabase_realtime add table public.%I', target_table);
      end if;
    end loop;
  end if;
end;
$$;

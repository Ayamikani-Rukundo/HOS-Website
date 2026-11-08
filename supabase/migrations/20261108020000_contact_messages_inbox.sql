begin;

alter table public.contact_messages
  add column if not exists is_read boolean not null default false;

create index if not exists idx_contact_messages_read_created
  on public.contact_messages(is_read, created_at desc);

commit;

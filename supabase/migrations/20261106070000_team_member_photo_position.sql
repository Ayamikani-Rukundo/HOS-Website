begin;

alter table public.team_members
  add column if not exists avatar_object_position text not null default '50% 50%';

commit;

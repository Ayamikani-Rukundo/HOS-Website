alter table public.galleries
  add column if not exists additional_images jsonb not null default '[]'::jsonb;

alter table public.galleries
  drop constraint if exists galleries_additional_images_is_array;

alter table public.galleries
  add constraint galleries_additional_images_is_array
  check (jsonb_typeof(additional_images) = 'array');

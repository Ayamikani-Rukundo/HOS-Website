create or replace function public.reset_website_page_view_analytics()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  removed_count integer;
begin
  if auth.uid() is null or not public.has_any_role(array['admin']) then
    raise exception 'Only administrators can reset website page-view analytics.';
  end if;

  delete from public.website_page_views
  where true;
  get diagnostics removed_count = row_count;

  return removed_count;
end;
$$;

revoke all on function public.reset_website_page_view_analytics() from public, anon;
grant execute on function public.reset_website_page_view_analytics() to authenticated;

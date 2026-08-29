-- Migration: 20260829090000_platform_data_purge.sql
-- Description: Authenticated caller-scoped platform data purge function

create or replace function public.purge_my_platform_data(platform_name text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target_uid uuid := auth.uid();
  normalized_platform text := lower(trim(platform_name));
  deleted_games integer := 0;
begin
  if target_uid is null then
    raise exception 'authentication required';
  end if;

  if normalized_platform not in ('steam', 'epic') then
    raise exception 'invalid platform';
  end if;

  delete from public.user_games
  where user_id = target_uid::text
    and launcher_type = normalized_platform;
  get diagnostics deleted_games = row_count;

  update public.profiles set
    steam_id = case when normalized_platform = 'steam' then null else steam_id end,
    steam_username = case when normalized_platform = 'steam' then null else steam_username end,
    steam_avatar = case when normalized_platform = 'steam' then null else steam_avatar end,
    last_steam_sync_at = case when normalized_platform = 'steam' then null else last_steam_sync_at end,
    achievement_summary = '{}'::jsonb,
    library_summary = '{}'::jsonb
  where uid = target_uid::text;

  return jsonb_build_object('deletedGames', deleted_games);
end;
$$;

revoke all on function public.purge_my_platform_data(text) from public;
grant execute on function public.purge_my_platform_data(text) to authenticated;

-- Migration: 20260831120210_award_xp_level_milestone.sql
-- Description: Phase 3.6 — when `award_xp` causes the user's level to change,
--              also insert a `level_milestone` row into `xp_events` so the
--              timeline component can render level-up events alongside
--              trophy unlocks. The marker row uses `amount=0` and carries the
--              `level_before` / `level_after` pair so it is visually distinct
--              from a normal XP gain in the UI.
--
-- The function is `create or replace`, so the change is additive and does
-- not break callers that only depend on the `level_progress` return value.

create or replace function public.award_xp(
  target_uid uuid,
  p_amount integer,
  p_source_type text,
  p_source_id uuid default null,
  p_reason text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns public.level_progress
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  before_row public.level_progress;
  after_row public.level_progress;
  new_total bigint;
  new_level integer;
  new_lvl_xp integer;
  new_tier text;
begin
  if p_source_type not in ('trophy_unlock', 'level_milestone', 'manual', 'correction') then
    raise exception 'invalid source_type: %', p_source_type;
  end if;

  before_row := public.ensure_level_progress(target_uid);

  new_total := greatest(0, before_row.total_xp + p_amount);

  select current_level, current_level_xp, tier
    into new_level, new_lvl_xp, new_tier
  from public.psn_level_from_xp(new_total);

  update public.level_progress
     set total_xp = new_total,
         current_level = new_level,
         current_level_xp = new_lvl_xp,
         tier = new_tier,
         last_xp_at = now(),
         updated_at = now()
   where user_id = target_uid
   returning * into after_row;

  insert into public.xp_events
    (user_id, source_type, source_id, amount, level_before, level_after, reason, metadata)
  values
    (target_uid, p_source_type, p_source_id, p_amount, before_row.current_level, after_row.current_level, p_reason, p_metadata);

  -- T3.6: when the level changes, append a marker row so the timeline
  -- shows the level transition even when the source was a normal XP gain.
  if before_row.current_level is distinct from after_row.current_level then
    insert into public.xp_events
      (user_id, source_type, source_id, amount, level_before, level_after, reason, metadata)
    values
      (
        target_uid,
        'level_milestone',
        null,
        0,
        before_row.current_level,
        after_row.current_level,
        coalesce(p_reason, 'level-up'),
        jsonb_build_object(
          'kind', 'level_milestone',
          'transition', true,
          'origin_source_type', p_source_type,
          'origin_source_id', p_source_id
        ) || coalesce(p_metadata, '{}'::jsonb)
      );
  end if;

  return after_row;
end;
$$;

revoke all on function public.award_xp(uuid, integer, text, uuid, text, jsonb) from public;
grant execute on function public.award_xp(uuid, integer, text, uuid, text, jsonb) to service_role;

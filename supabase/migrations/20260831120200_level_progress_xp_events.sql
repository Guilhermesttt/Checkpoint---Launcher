-- Migration: 20260831120200_level_progress_xp_events.sql
-- Description: Player level state and append-only XP event log, plus SQL functions
--              for safe XP award and level recompute. Mirrors the PSN bracket system
--              in src/utils/trophyTiers.ts so the client and the server stay aligned.

-- -----------------------------------------------------------------------------
-- Tables
-- -----------------------------------------------------------------------------

create table if not exists public.level_progress (
  user_id uuid primary key references auth.users(id) on delete cascade,
  current_level integer not null default 1 check (current_level between 1 and 999),
  -- XP accumulated within the current level (0..xp_for_next_level-1).
  current_level_xp integer not null default 0 check (current_level_xp >= 0),
  -- Lifetime XP across the whole account.
  total_xp bigint not null default 0 check (total_xp >= 0),
  -- PSN-style tier derived from current_level. Recomputed on every XP change.
  tier text not null default 'bronze' check (tier in ('bronze', 'silver', 'gold', 'platinum')),
  -- Most recent XP change (used by Realtime to debounce/display).
  last_xp_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists level_progress_set_updated_at on public.level_progress;
create trigger level_progress_set_updated_at
before update on public.level_progress
for each row execute function public.set_updated_at();

create index if not exists level_progress_leaderboard_idx
  on public.level_progress (total_xp desc, current_level desc);

alter table public.level_progress enable row level security;

drop policy if exists level_progress_select on public.level_progress;
create policy level_progress_select on public.level_progress
for select to authenticated
using (user_id = auth.uid());

revoke all on public.level_progress from public;
grant select on public.level_progress to authenticated, service_role;

-- Append-only audit log of every XP change. Drives the unlock notification
-- worker and the achievement history UI.
create table if not exists public.xp_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  -- Where the XP came from. Paired with source_id to point at the originator.
  source_type text not null check (source_type in (
    'trophy_unlock',     -- row in user_trophies
    'level_milestone',   -- level-up bonus
    'manual',            -- admin / support grant
    'correction'         -- negative adjustment to fix bad data
  )),
  source_id uuid,
  -- Positive for awards, negative for corrections. 0 is allowed (no-op marker).
  amount integer not null,
  -- Snapshot of the level/XP at the time the event was applied. Useful for
  -- recreating the timeline and for reconciliation audits.
  level_before integer,
  level_after integer,
  reason text check (char_length(reason) <= 280),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists xp_events_user_created_idx
  on public.xp_events (user_id, created_at desc);
create index if not exists xp_events_source_idx
  on public.xp_events (source_type, source_id);
create index if not exists xp_events_recent_idx
  on public.xp_events (created_at desc);

alter table public.xp_events enable row level security;

drop policy if exists xp_events_select on public.xp_events;
create policy xp_events_select on public.xp_events
for select to authenticated
using (user_id = auth.uid());

revoke all on public.xp_events from public;
grant select on public.xp_events to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Level math (mirrors PSN_LEVEL_BRACKETS in src/utils/trophyTiers.ts)
-- -----------------------------------------------------------------------------
-- Brackets are the same on client and server. The `trophyTiers.ts` export
-- `getTotalXpForLevel` and `calculatePlayerLevel` MUST stay in sync; the
-- SQL function below is the authoritative version used by the database.

create or replace function public.psn_xp_for_level(target_level integer)
returns integer
language sql
immutable
as $$
  with brackets(bracket_order, min_level, max_level, xp_per_level) as (
    values
      (1,  1,   20,  45),
      (2,  21,  99,  60),
      (3,  100, 199, 90),
      (4,  200, 299, 450),
      (5,  300, 399, 900),
      (6,  400, 499, 1350),
      (7,  500, 599, 1800),
      (8,  600, 699, 2250),
      (9,  700, 799, 2700),
      (10, 800, 999, 3150)
  )
  select coalesce(sum(greatest(0, b.xp_per_level)), 0)::integer
  from brackets b
  where b.min_level < target_level
    and b.max_level < target_level;
$$;

-- Returns (xp_required_to_reach_level, xp_required_to_leave_level_into_next)
create or replace function public.psn_xp_window(target_level integer)
returns table(xp_for_level integer, xp_for_next integer)
language sql
immutable
as $$
  with brackets(min_level, max_level, xp_per_level) as (
    values
      (1,  20,  45),
      (21,  99,  60),
      (100, 199, 90),
      (200, 299, 450),
      (300, 399, 900),
      (400, 499, 1350),
      (500, 599, 1800),
      (600, 699, 2250),
      (700, 799, 2700),
      (800, 999, 3150)
  ),
  picked as (
    select * from brackets
    where target_level between min_level and max_level
  )
  select
    public.psn_xp_for_level(picked.min_level) as xp_for_level,
    (picked.xp_per_level)::integer as xp_for_next
  from picked;
$$;

-- Returns the PSN tier for a given level.
create or replace function public.psn_tier_for_level(target_level integer)
returns text
language sql
immutable
as $$
  select case
    when target_level >= 999 then 'platinum'
    when target_level >= 600 then 'gold'
    when target_level >= 300 then 'silver'
    else 'bronze'
  end;
$$;

-- Compute the level/xp-from-total-xp. Used to materialize the new state.
create or replace function public.psn_level_from_xp(lifetime_xp bigint)
returns table(current_level integer, current_level_xp integer, tier text)
language plpgsql
immutable
as $$
declare
  remaining bigint := greatest(0, lifetime_xp);
  lvl integer := 1;
  xp_per integer := 45;
  lvl_xp integer := 0;
  b_min integer;
  b_max integer;
  b_xp integer;
begin
  if remaining = 0 then
    return query select 1, 0, public.psn_tier_for_level(1);
    return;
  end if;

  for b_min, b_max, b_xp in
    values
      (1,   20,  45),
      (21,  99,  60),
      (100, 199, 90),
      (200, 299, 450),
      (300, 399, 900),
      (400, 499, 1350),
      (500, 599, 1800),
      (600, 699, 2250),
      (700, 799, 2700),
      (800, 999, 3150)
  loop
    if lvl > b_max then
      continue;
    end if;
    xp_per := b_xp;
    -- Consume full brackets above us before capping inside the current bracket.
    if lvl < b_min then
      declare
        skip_levels integer := b_min - lvl;
        skip_xp bigint := skip_levels * b_xp;
      begin
        if remaining < skip_xp then
          -- Not enough to enter this bracket; interpolate within the previous bracket.
          exit;
        end if;
        remaining := remaining - skip_xp;
        lvl := b_min;
      end;
    end if;
    if remaining >= b_xp then
      declare
        levels_in_bracket integer := b_max - lvl + 1;
        bracket_total bigint := levels_in_bracket * b_xp;
      begin
        if remaining < bracket_total then
          lvl := lvl + (remaining / b_xp)::integer;
          lvl_xp := (remaining % b_xp)::integer;
          remaining := 0;
          exit;
        else
          remaining := remaining - bracket_total;
          lvl := b_max + 1;
        end if;
      end;
    else
      lvl_xp := remaining::integer;
      remaining := 0;
      exit;
    end if;
  end loop;

  lvl := least(999, greatest(1, lvl));
  if remaining > 0 then
    -- Overflow (already at 999). Dump all leftover XP into lvl_xp for visibility.
    lvl_xp := lvl_xp + remaining;
  end if;

  return query select lvl, lvl_xp, public.psn_tier_for_level(lvl);
end;
$$;

-- -----------------------------------------------------------------------------
-- Mutation helpers (idempotent, security definer, callable only by service_role)
-- -----------------------------------------------------------------------------

-- Ensure a level_progress row exists for the user. Idempotent.
create or replace function public.ensure_level_progress(target_uid uuid)
returns public.level_progress
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  result public.level_progress;
begin
  insert into public.level_progress (user_id)
  values (target_uid)
  on conflict (user_id) do nothing;

  select * into result from public.level_progress where user_id = target_uid;
  return result;
end;
$$;

revoke all on function public.ensure_level_progress(uuid) from public;
grant execute on function public.ensure_level_progress(uuid) to service_role;

-- Award XP atomically: recompute the level, log the event, return the new state.
-- `p_metadata` is merged into the xp_events row for traceability.
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

  return after_row;
end;
$$;

revoke all on function public.award_xp(uuid, integer, text, uuid, text, jsonb) from public;
grant execute on function public.award_xp(uuid, integer, text, uuid, text, jsonb) to service_role;

-- Snapshot a user's level for the next milestone lookup without re-querying the
-- whole table. The level-page UI calls this through a server-side function or
-- a thin SELECT.
create or replace function public.my_level_progress()
returns public.level_progress
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select * from public.level_progress where user_id = auth.uid();
$$;

revoke all on function public.my_level_progress() from public;
grant execute on function public.my_level_progress() to authenticated;

-- Leaderboard view: top 100 by lifetime XP. Open read for authenticated users.
drop view if exists public.level_leaderboard_view cascade;
create view public.level_leaderboard_view
with (security_invoker = true) as
  select
    lp.user_id,
    lp.current_level,
    lp.total_xp,
    lp.tier,
    coalesce(nullif(trim(p.display_name), ''), 'Jogador') as display_name
  from public.level_progress lp
  left join public.profiles p on p.uid = lp.user_id::text
  order by lp.total_xp desc, lp.current_level desc
  limit 100;

grant select on public.level_leaderboard_view to authenticated, service_role;
-- Migration: 20260831120100_user_trophies.sql
-- Description: Per-user trophy state (progress, unlock timestamp, notification state).
--              One row per (user, trophy_definition). All writes happen via service_role
--              from the trophy evaluator; clients only read.

create table if not exists public.user_trophies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  trophy_id uuid not null references public.trophy_definitions(id) on delete cascade,
  -- 0.0 to 1.0. Set to 1.0 when unlocked.
  progress numeric(5, 4) not null default 0 check (progress >= 0 and progress <= 1),
  unlocked_at timestamptz,
  -- Set when the notification worker has dispatched the unlock to email/push.
  notified_at timestamptz,
  -- Snapshot of the unlock context (e.g. game_appid, achievement_id, level_at_unlock).
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, trophy_id)
);

-- At most one unlocked row per (user, trophy): enforce that unlocked_at is set
-- iff progress = 1.0.
alter table public.user_trophies
  drop constraint if exists user_trophies_progress_unlocked_consistency;
alter table public.user_trophies
  add constraint user_trophies_progress_unlocked_consistency
  check (
    (progress = 1.0 and unlocked_at is not null)
    or (progress < 1.0 and unlocked_at is null)
  );

create index if not exists user_trophies_user_unlocked_idx
  on public.user_trophies (user_id, unlocked_at desc)
  where unlocked_at is not null;
create index if not exists user_trophies_user_in_progress_idx
  on public.user_trophies (user_id)
  where unlocked_at is null;
create index if not exists user_trophies_pending_notification_idx
  on public.user_trophies (notified_at)
  where unlocked_at is not null and notified_at is null;

drop trigger if exists user_trophies_set_updated_at on public.user_trophies;
create trigger user_trophies_set_updated_at
before update on public.user_trophies
for each row execute function public.set_updated_at();

alter table public.user_trophies enable row level security;

-- Users can only see their own trophy state. Hidden trophies (definitions with
-- is_hidden = true) are not exposed until they are unlocked for the caller.
-- The join inside the RLS USING clause filters out hidden-but-unlocked-by-others,
-- but more importantly hides hidden-still-locked trophies for everyone.
drop policy if exists user_trophies_select on public.user_trophies;
create policy user_trophies_select on public.user_trophies
for select to authenticated
using (
  user_id = auth.uid()
  and (
    unlocked_at is not null
    or not exists (
      select 1 from public.trophy_definitions d
      where d.id = user_trophies.trophy_id and d.is_hidden = true
    )
  )
);

-- No direct client INSERT/UPDATE/DELETE; the evaluator runs as service_role.
-- Defensive revoke keeps the surface tight.
revoke all on public.user_trophies from public;
grant select on public.user_trophies to authenticated, service_role;

-- Helpful aggregate view: per-user unlocked counts by tier. Drives the trophy
-- page counter without leaking hidden-locked counts.
drop view if exists public.user_trophy_stats_view cascade;
create view public.user_trophy_stats_view
with (security_invoker = true) as
  select
    ut.user_id,
    count(*) filter (where ut.unlocked_at is not null) as unlocked_total,
    count(*) filter (
      where ut.unlocked_at is not null
        and d.tier = 'platinum'
    ) as unlocked_platinum,
    count(*) filter (
      where ut.unlocked_at is not null
        and d.tier = 'gold'
    ) as unlocked_gold,
    count(*) filter (
      where ut.unlocked_at is not null
        and d.tier = 'silver'
    ) as unlocked_silver,
    count(*) filter (
      where ut.unlocked_at is not null
        and d.tier = 'bronze'
    ) as unlocked_bronze,
    coalesce(sum(d.xp_value) filter (where ut.unlocked_at is not null), 0) as unlocked_xp
  from public.user_trophies ut
  join public.trophy_definitions d on d.id = ut.trophy_id
  group by ut.user_id;

grant select on public.user_trophy_stats_view to authenticated, service_role;

-- Migration: 20260831130000_notification_preferences.sql
-- Description: Per-user notification preferences. Gates which trophy unlocks
--              generate an email (Resend) and in-app push (Electron).
--              Defaults are opt-in for everything so new users receive the
--              happy-path immediately; opt-out is one click away.

create table if not exists public.notification_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  -- Master switch; if false, no notification is generated for any event.
  enabled boolean not null default true,
  -- Email channel via Resend.
  email_enabled boolean not null default true,
  -- Minimum tier that triggers an email. 'bronze' sends everything, 'platinum'
  -- only the top-tier unlocks. Mirrors the tier check constraint below.
  email_min_tier text not null default 'silver'
    check (email_min_tier in ('bronze', 'silver', 'gold', 'platinum')),
  -- Optional address override. If null, the email from auth.users is used.
  email_override text,
  -- In-app push via Electron Notification. Replaces the prior client-only flag.
  push_enabled boolean not null default true,
  -- Locale used by the email template. Falls back to 'en'.
  locale text not null default 'pt-BR' check (locale in ('pt-BR', 'en', 'es')),
  -- Cadence: 'instant' sends one email per unlock, 'digest' batches.
  cadence text not null default 'instant' check (cadence in ('instant', 'digest')),
  -- Last email successfully sent (used to skip stale re-sends on retry).
  last_email_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists notification_preferences_set_updated_at on public.notification_preferences;
create trigger notification_preferences_set_updated_at
before update on public.notification_preferences
for each row execute function public.set_updated_at();

alter table public.notification_preferences enable row level security;

-- Each user can read and update their own preferences. No service-role reads
-- needed at runtime; the Edge Function uses a SECURITY DEFINER helper instead.
drop policy if exists notification_preferences_select on public.notification_preferences;
create policy notification_preferences_select on public.notification_preferences
for select to authenticated
using (user_id = auth.uid());

drop policy if exists notification_preferences_update on public.notification_preferences;
create policy notification_preferences_update on public.notification_preferences
for update to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists notification_preferences_insert on public.notification_preferences;
create policy notification_preferences_insert on public.notification_preferences
for insert to authenticated
with check (user_id = auth.uid());

-- Idempotent getter used by the Edge Function and the renderer.
create or replace function public.my_notification_preferences()
returns public.notification_preferences
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  result public.notification_preferences;
  target_uid uuid := auth.uid();
begin
  if target_uid is null then
    raise exception 'authentication required';
  end if;

  insert into public.notification_preferences (user_id)
  values (target_uid)
  on conflict (user_id) do nothing;

  select * into result from public.notification_preferences where user_id = target_uid;
  return result;
end;
$$;

revoke all on function public.my_notification_preferences() from public;
grant execute on function public.my_notification_preferences() to authenticated, service_role;

-- Worker-side view that lists pending unlocks joined with the recipient's
-- preferences. RLS-equivalent filtering is done via WHERE so the worker can
-- run with a single query.
create or replace function public.pending_trophy_notifications(p_limit integer default 50)
returns table(
  user_trophy_id uuid,
  user_id uuid,
  email text,
  locale text,
  email_min_tier text,
  email_enabled boolean,
  push_enabled boolean,
  cadence text,
  trophy_title text,
  trophy_description text,
  trophy_tier text,
  trophy_xp integer,
  unlocked_at timestamptz
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    ut.id as user_trophy_id,
    ut.user_id,
    coalesce(p.email_override, u.email) as email,
    coalesce(np.locale, 'pt-BR') as locale,
    coalesce(np.email_min_tier, 'silver') as email_min_tier,
    coalesce(np.email_enabled, true) as email_enabled,
    coalesce(np.push_enabled, true) as push_enabled,
    coalesce(np.cadence, 'instant') as cadence,
    d.title as trophy_title,
    d.description as trophy_description,
    d.tier as trophy_tier,
    d.xp_value as trophy_xp,
    ut.unlocked_at
  from public.user_trophies ut
  join public.trophy_definitions d on d.id = ut.trophy_id
  left join public.notification_preferences np on np.user_id = ut.user_id
  left join auth.users u on u.id = ut.user_id
  where ut.unlocked_at is not null
    and ut.notified_at is null
  order by ut.unlocked_at asc
  limit greatest(1, least(p_limit, 500));
$$;

revoke all on function public.pending_trophy_notifications(integer) from public;
grant execute on function public.pending_trophy_notifications(integer) to service_role;

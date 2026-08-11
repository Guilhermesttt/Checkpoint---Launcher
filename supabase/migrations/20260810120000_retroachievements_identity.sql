alter table public.profiles
  add column if not exists retroachievements_ulid text,
  add column if not exists retroachievements_username text;

create unique index if not exists profiles_retroachievements_ulid_unique
  on public.profiles (retroachievements_ulid)
  where retroachievements_ulid is not null;

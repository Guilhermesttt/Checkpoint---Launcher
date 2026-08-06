begin;

create extension if not exists pgcrypto;
create extension if not exists pg_trgm;
create schema if not exists private;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

alter table public.profiles
  add column if not exists email text,
  add column if not exists display_name text,
  add column if not exists photo_url text,
  add column if not exists bio text,
  add column if not exists location text,
  add column if not exists pronouns text,
  add column if not exists website text,
  add column if not exists favorite_genres text[] default '{}',
  add column if not exists steam_id text,
  add column if not exists steam_username text,
  add column if not exists steam_avatar text,
  add column if not exists discord_id text,
  add column if not exists discord_username text,
  add column if not exists discord_avatar text,
  add column if not exists discord_friends jsonb default '[]'::jsonb,
  add column if not exists status text default 'offline',
  add column if not exists playing text,
  add column if not exists presence_updated_at timestamptz,
  add column if not exists last_steam_sync_at timestamptz,
  add column if not exists onboarding_completed_at timestamptz,
  add column if not exists achievement_summary jsonb default '{}'::jsonb,
  add column if not exists library_summary jsonb default '{}'::jsonb,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

update public.profiles p
set
  display_name = coalesce(
    nullif(trim(p.display_name), ''),
    nullif(split_part(coalesce(p.email, u.email, ''), '@', 1), ''),
    'Jogador'
  ),
  email = coalesce(p.email, u.email),
  favorite_genres = coalesce(p.favorite_genres, '{}'),
  discord_friends = coalesce(p.discord_friends, '[]'::jsonb),
  status = case when p.status in ('online', 'playing', 'offline') then p.status else 'offline' end,
  created_at = coalesce(p.created_at, now()),
  updated_at = coalesce(p.updated_at, now())
from auth.users u
where u.id = p.uid;

alter table public.profiles
  alter column display_name set not null,
  alter column created_at set default now(),
  alter column updated_at set default now();

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.profiles'::regclass and contype = 'p'
  ) then
    alter table public.profiles add primary key (uid);
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'profiles_uid_auth_users_fk'
  ) then
    alter table public.profiles
      add constraint profiles_uid_auth_users_fk
      foreign key (uid) references auth.users(id) on delete cascade;
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_status_check'
  ) then
    alter table public.profiles
      add constraint profiles_status_check
      check (status in ('online', 'playing', 'offline'));
  end if;
end
$$;

create unique index if not exists profiles_steam_id_unique
  on public.profiles (steam_id) where steam_id is not null;
create unique index if not exists profiles_discord_id_unique
  on public.profiles (discord_id) where discord_id is not null;
create index if not exists profiles_display_name_trgm
  on public.profiles using gin (lower(display_name) gin_trgm_ops);

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (uid, email, display_name, photo_url)
  values (
    new.id,
    new.email,
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
      nullif(trim(new.raw_user_meta_data ->> 'name'), ''),
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      'Jogador'
    ),
    coalesce(new.raw_user_meta_data ->> 'avatar_url', new.raw_user_meta_data ->> 'picture')
  )
  on conflict (uid) do update set
    email = excluded.email,
    display_name = coalesce(nullif(public.profiles.display_name, ''), excluded.display_name),
    photo_url = coalesce(public.profiles.photo_url, excluded.photo_url);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert or update of email, raw_user_meta_data on auth.users
for each row execute function public.handle_new_auth_user();

alter table public.public_profiles
  add column if not exists display_name text,
  add column if not exists photo_url text,
  add column if not exists bio text,
  add column if not exists website text,
  add column if not exists favorite_genres text[] default '{}',
  add column if not exists stats jsonb default '{}'::jsonb,
  add column if not exists platforms jsonb default '{}'::jsonb,
  add column if not exists top_games jsonb default '[]'::jsonb,
  add column if not exists favorite_games jsonb default '[]'::jsonb,
  add column if not exists achievements jsonb default '{}'::jsonb,
  add column if not exists revision integer default 0,
  add column if not exists updated_at timestamptz default now();

update public.public_profiles
set
  display_name = coalesce(nullif(trim(display_name), ''), 'Jogador'),
  favorite_genres = coalesce(favorite_genres, '{}'),
  stats = coalesce(stats, '{}'::jsonb),
  platforms = coalesce(platforms, '{}'::jsonb),
  top_games = coalesce(top_games, '[]'::jsonb),
  favorite_games = coalesce(favorite_games, '[]'::jsonb),
  achievements = coalesce(achievements, '{}'::jsonb);

alter table public.public_profiles alter column display_name set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.public_profiles'::regclass and contype = 'p'
  ) then
    alter table public.public_profiles add primary key (uid);
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'public_profiles_uid_auth_users_fk'
  ) then
    alter table public.public_profiles
      add constraint public_profiles_uid_auth_users_fk
      foreign key (uid) references auth.users(id) on delete cascade;
  end if;
end
$$;

create index if not exists public_profiles_display_name_trgm
  on public.public_profiles using gin (lower(display_name) gin_trgm_ops);

drop trigger if exists public_profiles_set_updated_at on public.public_profiles;
create trigger public_profiles_set_updated_at
before update on public.public_profiles
for each row execute function public.set_updated_at();

create or replace function public.sync_public_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.public_profiles (
    uid, display_name, photo_url, bio, website, favorite_genres, updated_at
  )
  values (
    new.uid, new.display_name, new.photo_url, new.bio, new.website,
    coalesce(new.favorite_genres, '{}'), now()
  )
  on conflict (uid) do update set
    display_name = excluded.display_name,
    photo_url = excluded.photo_url,
    bio = excluded.bio,
    website = excluded.website,
    favorite_genres = excluded.favorite_genres,
    updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_sync_public_profile on public.profiles;
create trigger profiles_sync_public_profile
after insert or update of display_name, photo_url, bio, website, favorite_genres
on public.profiles
for each row execute function public.sync_public_profile();

insert into public.public_profiles (
  uid, display_name, photo_url, bio, website, favorite_genres, updated_at
)
select
  uid, display_name, photo_url, bio, website, coalesce(favorite_genres, '{}'), now()
from public.profiles
on conflict (uid) do update set
  display_name = excluded.display_name,
  photo_url = excluded.photo_url,
  bio = excluded.bio,
  website = excluded.website,
  favorite_genres = excluded.favorite_genres,
  updated_at = now();

do $$
begin
  if to_regclass('public.friendship') is not null
     and to_regclass('public.friendships') is null then
    alter table public.friendship rename to friendships;
  end if;
end
$$;

create table if not exists public.friendships (
  requester_id uuid not null references auth.users(id) on delete cascade,
  addressee_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (requester_id, addressee_id),
  constraint friendships_not_self check (requester_id <> addressee_id),
  constraint friendships_status_check check (status in ('pending', 'accepted'))
);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.friendships'::regclass and contype = 'p'
  ) then
    alter table public.friendships
      add primary key (requester_id, addressee_id);
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'friendships_requester_auth_fk'
  ) then
    alter table public.friendships
      add constraint friendships_requester_auth_fk
      foreign key (requester_id) references auth.users(id) on delete cascade;
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'friendships_addressee_auth_fk'
  ) then
    alter table public.friendships
      add constraint friendships_addressee_auth_fk
      foreign key (addressee_id) references auth.users(id) on delete cascade;
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'friendships_not_self'
  ) then
    alter table public.friendships
      add constraint friendships_not_self check (requester_id <> addressee_id);
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'friendships_status_check'
  ) then
    alter table public.friendships
      add constraint friendships_status_check check (status in ('pending', 'accepted'));
  end if;
end
$$;

create unique index if not exists friendships_pair_unique
  on public.friendships (
    least(requester_id, addressee_id),
    greatest(requester_id, addressee_id)
  );
create index if not exists friendships_requester_status_idx
  on public.friendships (requester_id, status);
create index if not exists friendships_addressee_status_idx
  on public.friendships (addressee_id, status);

drop trigger if exists friendships_set_updated_at on public.friendships;
create trigger friendships_set_updated_at
before update on public.friendships
for each row execute function public.set_updated_at();

create or replace function private.are_friends(first_user uuid, second_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.friendships
    where status = 'accepted'
      and (
        (requester_id = first_user and addressee_id = second_user)
        or (requester_id = second_user and addressee_id = first_user)
      )
  );
$$;

create or replace function private.has_relationship(first_user uuid, second_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.friendships
    where (
      (requester_id = first_user and addressee_id = second_user)
      or (requester_id = second_user and addressee_id = first_user)
    )
  );
$$;

alter table public.chats
  add column if not exists direct_key text,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

create unique index if not exists chats_direct_key_unique
  on public.chats (direct_key);

drop trigger if exists chats_set_updated_at on public.chats;
create trigger chats_set_updated_at
before update on public.chats
for each row execute function public.set_updated_at();

create table if not exists public.chat_participants (
  chat_id uuid not null references public.chats(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  last_read_at timestamptz,
  primary key (chat_id, user_id)
);

alter table public.chat_participants
  add column if not exists joined_at timestamptz default now(),
  add column if not exists last_read_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.chat_participants'::regclass and contype = 'p'
  ) then
    alter table public.chat_participants add primary key (chat_id, user_id);
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'chat_participants_chat_fk'
  ) then
    alter table public.chat_participants
      add constraint chat_participants_chat_fk
      foreign key (chat_id) references public.chats(id) on delete cascade;
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'chat_participants_user_fk'
  ) then
    alter table public.chat_participants
      add constraint chat_participants_user_fk
      foreign key (user_id) references auth.users(id) on delete cascade;
  end if;
end
$$;

create index if not exists chat_participants_user_idx
  on public.chat_participants (user_id, chat_id);

create or replace function private.is_chat_participant(target_chat uuid, target_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.chat_participants
    where chat_id = target_chat and user_id = target_user
  );
$$;

alter table public.chat_messages
  add column if not exists receiver_id uuid references auth.users(id) on delete cascade,
  add column if not exists read boolean default false,
  add column if not exists attachment_name text,
  add column if not exists attachment_url text,
  add column if not exists attachment_type text,
  add column if not exists attachment_size bigint,
  add column if not exists attachment_path text,
  add column if not exists created_at timestamptz default now();

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'chat_messages_text_length_check'
  ) then
    alter table public.chat_messages
      add constraint chat_messages_text_length_check
      check (char_length(text) <= 2000);
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'chat_messages_attachment_size_check'
  ) then
    alter table public.chat_messages
      add constraint chat_messages_attachment_size_check
      check (attachment_size is null or attachment_size between 1 and 8388608);
  end if;
end
$$;

create index if not exists chat_messages_chat_created_idx
  on public.chat_messages (chat_id, created_at desc);
create index if not exists chat_messages_receiver_unread_idx
  on public.chat_messages (receiver_id, read, created_at desc);

alter table public.activities
  add column if not exists user_name text,
  add column if not exists user_avatar text,
  add column if not exists game_id text,
  add column if not exists game_title text,
  add column if not exists game_image text,
  add column if not exists achievement_id text,
  add column if not exists achievement_name text,
  add column if not exists achievement_icon text,
  add column if not exists caption text,
  add column if not exists audience_ids uuid[] default '{}',
  add column if not exists created_at timestamptz default now();

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'activities_kind_check'
  ) then
    alter table public.activities
      add constraint activities_kind_check
      check (kind in ('game-start', 'achievement', 'capture'));
  end if;
end
$$;

create unique index if not exists activities_achievement_dedupe
  on public.activities (user_id, game_id, achievement_id)
  where kind = 'achievement';
create index if not exists activities_created_idx
  on public.activities (created_at desc);
create index if not exists activities_user_created_idx
  on public.activities (user_id, created_at desc);
create index if not exists activities_audience_gin
  on public.activities using gin (audience_ids);

alter table public.user_games alter column id drop default;
alter table public.user_games alter column id type text using id::text;
alter table public.user_games alter column id set default gen_random_uuid()::text;
alter table public.user_games
  add column if not exists data jsonb default '{}'::jsonb,
  add column if not exists steam_app_id text,
  add column if not exists epic_catalog_id text,
  add column if not exists is_favorite boolean default false,
  add column if not exists updated_at timestamptz default now();

create unique index if not exists user_games_user_id_id_unique
  on public.user_games (user_id, id);
create index if not exists user_games_user_launcher_idx
  on public.user_games (user_id, launcher_type);
create index if not exists user_games_user_steam_idx
  on public.user_games (user_id, steam_app_id)
  where steam_app_id is not null;

drop trigger if exists user_games_set_updated_at on public.user_games;
create trigger user_games_set_updated_at
before update on public.user_games
for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.public_profiles enable row level security;
alter table public.friendships enable row level security;
alter table public.chats enable row level security;
alter table public.chat_participants enable row level security;
alter table public.chat_messages enable row level security;
alter table public.activities enable row level security;
alter table public.user_games enable row level security;

revoke all on table public.profiles from anon;
revoke all on table public.public_profiles from anon;
revoke all on table public.friendships from anon;
revoke all on table public.chats from anon;
revoke all on table public.chat_participants from anon;
revoke all on table public.chat_messages from anon;
revoke all on table public.activities from anon;
revoke all on table public.user_games from anon;

revoke all on table public.profiles from authenticated;
revoke all on table public.public_profiles from authenticated;
revoke all on table public.friendships from authenticated;
revoke all on table public.chats from authenticated;
revoke all on table public.chat_participants from authenticated;
revoke all on table public.chat_messages from authenticated;
revoke all on table public.activities from authenticated;
revoke all on table public.user_games from authenticated;

grant usage on schema public to authenticated;
grant usage on schema private to authenticated;
grant execute on function private.are_friends(uuid, uuid) to authenticated;
grant execute on function private.has_relationship(uuid, uuid) to authenticated;
grant execute on function private.is_chat_participant(uuid, uuid) to authenticated;
grant select on public.profiles to authenticated;
grant insert (
  uid,
  display_name,
  photo_url,
  bio,
  location,
  pronouns,
  website,
  favorite_genres
) on public.profiles to authenticated;
grant update (
  display_name,
  photo_url,
  bio,
  location,
  pronouns,
  website,
  favorite_genres,
  onboarding_completed_at,
  last_steam_sync_at,
  achievement_summary,
  library_summary
) on public.profiles to authenticated;
grant select, insert, update on public.public_profiles to authenticated;
grant select on public.friendships to authenticated;
grant select on public.chats to authenticated;
grant select on public.chat_participants to authenticated;
grant update (last_read_at) on public.chat_participants to authenticated;
grant select, insert on public.chat_messages to authenticated;
grant update (read) on public.chat_messages to authenticated;
grant select on public.activities to authenticated;
grant select, insert, update, delete on public.user_games to authenticated;

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
for select to authenticated using (uid = auth.uid());
drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own on public.profiles
for insert to authenticated with check (uid = auth.uid());
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
for update to authenticated using (uid = auth.uid()) with check (uid = auth.uid());

drop policy if exists public_profiles_read_authenticated on public.public_profiles;
drop policy if exists public_profiles_read_related on public.public_profiles;
create policy public_profiles_read_related on public.public_profiles
for select to authenticated
using (uid = auth.uid() or private.has_relationship(uid, auth.uid()));
drop policy if exists public_profiles_insert_own on public.public_profiles;
create policy public_profiles_insert_own on public.public_profiles
for insert to authenticated with check (uid = auth.uid());
drop policy if exists public_profiles_update_own on public.public_profiles;
create policy public_profiles_update_own on public.public_profiles
for update to authenticated using (uid = auth.uid()) with check (uid = auth.uid());

drop policy if exists friendships_read_participant on public.friendships;
create policy friendships_read_participant on public.friendships
for select to authenticated
using (requester_id = auth.uid() or addressee_id = auth.uid());

drop policy if exists chats_read_participant on public.chats;
create policy chats_read_participant on public.chats
for select to authenticated
using (private.is_chat_participant(id, auth.uid()));

drop policy if exists chat_participants_read_chat on public.chat_participants;
create policy chat_participants_read_chat on public.chat_participants
for select to authenticated
using (private.is_chat_participant(chat_id, auth.uid()));
drop policy if exists chat_participants_update_self on public.chat_participants;
create policy chat_participants_update_self on public.chat_participants
for update to authenticated
using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists chat_messages_read_participant on public.chat_messages;
create policy chat_messages_read_participant on public.chat_messages
for select to authenticated
using (private.is_chat_participant(chat_id, auth.uid()));
drop policy if exists chat_messages_insert_sender on public.chat_messages;
create policy chat_messages_insert_sender on public.chat_messages
for insert to authenticated
with check (
  sender_id = auth.uid()
  and private.is_chat_participant(chat_id, auth.uid())
  and receiver_id <> auth.uid()
  and private.is_chat_participant(chat_id, receiver_id)
);
drop policy if exists chat_messages_update_receiver on public.chat_messages;
create policy chat_messages_update_receiver on public.chat_messages
for update to authenticated
using (receiver_id = auth.uid()) with check (receiver_id = auth.uid());

drop policy if exists activities_read_audience on public.activities;
create policy activities_read_audience on public.activities
for select to authenticated
using (user_id = auth.uid() or auth.uid() = any(audience_ids));

drop policy if exists user_games_select_own on public.user_games;
create policy user_games_select_own on public.user_games
for select to authenticated using (user_id = auth.uid());
drop policy if exists user_games_insert_own on public.user_games;
create policy user_games_insert_own on public.user_games
for insert to authenticated with check (user_id = auth.uid());
drop policy if exists user_games_update_own on public.user_games;
create policy user_games_update_own on public.user_games
for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists user_games_delete_own on public.user_games;
create policy user_games_delete_own on public.user_games
for delete to authenticated using (user_id = auth.uid());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'attachments',
  'attachments',
  false,
  8388608,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists attachments_read_participants on storage.objects;
create policy attachments_read_participants on storage.objects
for select to authenticated
using (
  bucket_id = 'attachments'
  and private.is_chat_participant((storage.foldername(name))[1]::uuid, auth.uid())
);
drop policy if exists attachments_insert_participants on storage.objects;
create policy attachments_insert_participants on storage.objects
for insert to authenticated
with check (
  bucket_id = 'attachments'
  and private.is_chat_participant((storage.foldername(name))[1]::uuid, auth.uid())
);
drop policy if exists attachments_delete_owner on storage.objects;
create policy attachments_delete_owner on storage.objects
for delete to authenticated
using (
  bucket_id = 'attachments'
  and owner_id = auth.uid()::text
);

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'chat_messages'
  ) then
    alter publication supabase_realtime add table public.chat_messages;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'activities'
  ) then
    alter publication supabase_realtime add table public.activities;
  end if;
end
$$;

commit;

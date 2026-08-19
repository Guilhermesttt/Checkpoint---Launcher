-- Authoritative membership for WebRTC signalling. Room metadata is public only
-- when the host explicitly opens the room; passwords never leave the server.
create schema if not exists private;

create table if not exists public.voice_rooms (
  id uuid primary key default gen_random_uuid(),
  host_uid uuid not null references auth.users(id) on delete cascade,
  room_name text not null check (char_length(room_name) between 1 and 80),
  category text not null default 'resenha_games' check (category in ('resenha_games', 'gameplay_foco', 'estudos_foco', 'casual_chat')),
  is_private boolean not null default false,
  password_hash text,
  icon text default '🎮',
  avatar_url text,
  theme_color text default '#8B5CF6',
  max_participants smallint not null default 4 check (max_participants between 2 and 4),
  status text not null default 'active' check (status in ('active', 'ended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  ended_at timestamptz
);

alter table public.voice_rooms
  add column if not exists icon text default '🎮',
  add column if not exists avatar_url text,
  add column if not exists theme_color text default '#8B5CF6';

create table if not exists public.voice_room_members (
  room_id uuid not null references public.voice_rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null default 'Jogador',
  avatar_url text,
  joined_at timestamptz not null default now(),
  removed_at timestamptz,
  primary key (room_id, user_id)
);

create index if not exists voice_room_members_active_idx
  on public.voice_room_members (room_id, user_id) where removed_at is null;
create index if not exists voice_rooms_public_active_idx
  on public.voice_rooms (created_at desc) where status = 'active' and is_private = false;
create index if not exists voice_rooms_host_idx
  on public.voice_rooms (host_uid, status);

alter table public.voice_rooms enable row level security;
alter table public.voice_room_members enable row level security;

-- Public view that completely omits password_hash for safety
drop view if exists public.public_voice_rooms_view cascade;
create view public.public_voice_rooms_view
with (security_invoker = true) as
  select
    id,
    host_uid,
    room_name,
    category,
    is_private,
    icon,
    avatar_url,
    theme_color,
    max_participants,
    status,
    created_at,
    updated_at
  from public.voice_rooms
  where status = 'active' and is_private = false;

grant select on public.public_voice_rooms_view to authenticated, service_role, anon;
grant all on public.voice_rooms to authenticated, service_role;
grant all on public.voice_room_members to authenticated, service_role;

-- RLS policies for voice_rooms
drop policy if exists voice_rooms_select on public.voice_rooms;
create policy voice_rooms_select on public.voice_rooms
for select to authenticated
using (
  (status = 'active' and is_private = false)
  or host_uid = auth.uid()
  or exists (
    select 1 from public.voice_room_members
    where room_id = public.voice_rooms.id and user_id = auth.uid() and removed_at is null
  )
);

drop policy if exists voice_rooms_insert on public.voice_rooms;
create policy voice_rooms_insert on public.voice_rooms
for insert to authenticated
with check (
  host_uid = auth.uid()
);

drop policy if exists voice_rooms_update on public.voice_rooms;
create policy voice_rooms_update on public.voice_rooms
for update to authenticated
using (
  host_uid = auth.uid()
)
with check (
  host_uid = auth.uid()
);

drop policy if exists voice_rooms_delete on public.voice_rooms;
create policy voice_rooms_delete on public.voice_rooms
for delete to authenticated
using (
  host_uid = auth.uid()
);

-- RLS policies for voice_room_members
drop policy if exists voice_room_members_select on public.voice_room_members;
create policy voice_room_members_select on public.voice_room_members
for select to authenticated
using (
  exists (
    select 1 from public.voice_rooms
    where id = public.voice_room_members.room_id and (
      (is_private = false and status = 'active')
      or host_uid = auth.uid()
    )
  )
  or user_id = auth.uid()
);

drop policy if exists voice_room_members_insert on public.voice_room_members;
create policy voice_room_members_insert on public.voice_room_members
for insert to authenticated
with check (
  user_id = auth.uid()
);

drop policy if exists voice_room_members_update on public.voice_room_members;
create policy voice_room_members_update on public.voice_room_members
for update to authenticated
using (
  user_id = auth.uid()
  or exists (
    select 1 from public.voice_rooms
    where id = public.voice_room_members.room_id and host_uid = auth.uid()
  )
);

create or replace function private.is_voice_room_member(target_room uuid, target_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.voice_room_members
    where room_id = target_room and user_id = target_user and removed_at is null
  );
$$;

grant usage on schema private to authenticated;
grant execute on function private.is_voice_room_member(uuid, uuid) to authenticated;

-- Supabase Realtime Broadcast/Presence authorization. The topic format is
-- `voice:room:<uuid>`; only an active room member may publish or receive it.
drop policy if exists voice_room_realtime_read on realtime.messages;
create policy voice_room_realtime_read on realtime.messages
for select to authenticated
using (
  realtime.topic() like 'voice:room:%'
  and private.is_voice_room_member(split_part(realtime.topic(), ':', 3)::uuid, auth.uid())
);

drop policy if exists voice_room_realtime_write on realtime.messages;
create policy voice_room_realtime_write on realtime.messages
for insert to authenticated
with check (
  realtime.topic() like 'voice:room:%'
  and private.is_voice_room_member(split_part(realtime.topic(), ':', 3)::uuid, auth.uid())
);

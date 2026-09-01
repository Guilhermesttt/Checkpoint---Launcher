-- Migration: 20260831120000_trophy_definitions.sql
-- Description: Catalog of all unlockable trophies/achievements in the Phelierium launcher.
--              Criteria are stored as structured jsonb so the runtime evaluator can stay
--              schema-driven without code changes when new trophy types are added.

create table if not exists public.trophy_definitions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  title text not null check (char_length(title) between 1 and 120),
  description text not null check (char_length(description) between 1 and 500),
  -- PSN-style tier (single source of truth lives in src/utils/trophyTiers.ts).
  tier text not null check (tier in ('bronze', 'silver', 'gold', 'platinum')),
  xp_value integer not null check (xp_value >= 0),
  category text not null check (category in (
    'achievement',          -- individual achievement/trophy unlock
    'completion',           -- full game completion (e.g. platinum)
    'library',              -- library size / genre breadth
    'leveling',             -- level milestones
    'social',               -- friends / chat / voice activity
    'platform',             -- epic/steam integration milestones
    'session'               -- streaks and engagement
  )),
  -- Structured criterion. Schema is interpreted by the trophy evaluator:
  --   { "type": "trophy_count",     "op": ">=", "value": 10, "tier": "gold" }
  --   { "type": "level_reached",    "value": 50 }
  --   { "type": "game_completion",  "op": "all_100", "count": 3 }
  --   { "type": "library_size",     "op": ">=", "value": 25 }
  --   { "type": "platform_linked",  "platforms": ["epic", "steam"] }
  criteria jsonb not null,
  icon_url text,
  is_hidden boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists trophy_definitions_category_idx
  on public.trophy_definitions (category) where is_active = true;
create index if not exists trophy_definitions_tier_idx
  on public.trophy_definitions (tier) where is_active = true;

drop trigger if exists trophy_definitions_set_updated_at on public.trophy_definitions;
create trigger trophy_definitions_set_updated_at
before update on public.trophy_definitions
for each row execute function public.set_updated_at();

alter table public.trophy_definitions enable row level security;

-- Catalog is read-only for clients; writes happen via service_role from migrations
-- or trusted admin code paths.
drop policy if exists trophy_definitions_select on public.trophy_definitions;
create policy trophy_definitions_select on public.trophy_definitions
for select to authenticated
using (is_active = true);

-- Hidden trophies are not exposed via RLS until the user unlocks them; the
-- unlocked reveal is handled in user_trophies RLS by joining this table.
revoke all on public.trophy_definitions from public;
grant select on public.trophy_definitions to authenticated, service_role;

-- Seed: a small starter set so the catalog is not empty on first deploy.
insert into public.trophy_definitions
  (code, title, description, tier, xp_value, category, criteria, is_hidden)
values
  ('first_trophy',
   'Primeira Conquista',
   'Desbloqueie sua primeira conquista.',
   'bronze', 15, 'achievement',
   '{"type":"trophy_count","op":">=","value":1}'::jsonb, false),
  ('ten_trophies',
   'Colecionador Iniciante',
   'Desbloqueie 10 conquistas.',
   'bronze', 15, 'achievement',
   '{"type":"trophy_count","op":">=","value":10}'::jsonb, false),
  ('fifty_trophies',
   'Colecionador Dedicado',
   'Desbloqueie 50 conquistas.',
   'silver', 30, 'achievement',
   '{"type":"trophy_count","op":">=","value":50}'::jsonb, false),
  ('hundred_trophies',
   'Centenário',
   'Desbloqueie 100 conquistas.',
   'gold', 90, 'achievement',
   '{"type":"trophy_count","op":">=","value":100}'::jsonb, false),
  ('first_platinum',
   'Platina Inaugural',
   'Platine um jogo pela primeira vez.',
   'gold', 90, 'completion',
   '{"type":"trophy_count","op":">=","value":1,"tier":"platinum"}'::jsonb, false),
  ('five_platinums',
   'Platina Quíntupla',
   'Platine cinco jogos diferentes.',
   'platinum', 300, 'completion',
   '{"type":"trophy_count","op":">=","value":5,"tier":"platinum"}'::jsonb, false),
  ('level_10',
   'Nível 10',
   'Alcance o nível 10.',
   'bronze', 15, 'leveling',
   '{"type":"level_reached","value":10}'::jsonb, false),
  ('level_50',
   'Nível 50',
   'Alcance o nível 50.',
   'silver', 30, 'leveling',
   '{"type":"level_reached","value":50}'::jsonb, false),
  ('level_100',
   'Nível 100',
   'Alcance o nível 100.',
   'gold', 90, 'leveling',
   '{"type":"level_reached","value":100}'::jsonb, false),
  ('link_both_platforms',
   'Conector',
   'Conecte Epic Games e Steam.',
   'silver', 30, 'platform',
   '{"type":"platform_linked","platforms":["epic","steam"]}'::jsonb, false),
  ('library_25',
   'Biblioteca Sólida',
   'Tenha 25 jogos na biblioteca.',
   'bronze', 15, 'library',
   '{"type":"library_size","op":">=","value":25}'::jsonb, false),
  ('library_100',
   'Biblioteca Vasta',
   'Tenha 100 jogos na biblioteca.',
   'silver', 30, 'library',
   '{"type":"library_size","op":">=","value":100}'::jsonb, false),
  ('hidden_secret',
   '???',
   'Troféu oculto. Continue jogando para descobrir.',
   'platinum', 300, 'session',
   '{"type":"secret","value":"keep_playing"}'::jsonb, true)
on conflict (code) do nothing;

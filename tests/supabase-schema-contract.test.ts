// @vitest-environment node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260729193000_checkpoint_social_realtime.sql",
  ),
  "utf8",
).replace(/\r\n/g, "\n");
const fifoMigration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260730120000_chat_messages_fifo.sql",
  ),
  "utf8",
).replace(/\r\n/g, "\n");
const retentionMigration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260730130000_chat_retention.sql",
  ),
  "utf8",
).replace(/\r\n/g, "\n");
const privacyMigration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260801090000_profile_visibility.sql",
  ),
  "utf8",
).replace(/\r\n/g, "\n");
const profileControlsMigration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260802120000_profile_controls_permissions.sql",
  ),
  "utf8",
).replace(/\r\n/g, "\n");
const retroAchievementsIdentityMigrationPath = resolve(
  process.cwd(),
  "supabase/migrations/20260810120000_retroachievements_identity.sql",
);
const trophyDefinitionsMigration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260831120000_trophy_definitions.sql",
  ),
  "utf8",
).replace(/\r\n/g, "\n");
const userTrophiesMigration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260831120100_user_trophies.sql",
  ),
  "utf8",
).replace(/\r\n/g, "\n");
const levelProgressMigration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260831120200_level_progress_xp_events.sql",
  ),
  "utf8",
).replace(/\r\n/g, "\n");
const notificationPreferencesMigration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260831130000_notification_preferences.sql",
  ),
  "utf8",
).replace(/\r\n/g, "\n");

describe("contrato da migration Supabase", () => {
  it("versiona o grafo social e o chat normalizado", () => {
    expect(migration).toContain("public.friendships");
    expect(migration).toContain("public.chats");
    expect(migration).toContain("public.chat_participants");
    expect(migration).toContain("public.chat_messages");
    expect(migration).toContain("chats_direct_key_unique");
  });

  it("protege dados com RLS e anexos privados", () => {
    expect(migration).toContain("enable row level security");
    expect(migration).toContain("profiles_select_own");
    expect(migration).toContain("chat_messages_read_participant");
    expect(migration).toContain("'attachments',\n  'attachments',\n  false");
    expect(migration).toContain("attachments_read_participants");
  });

  it("habilita Realtime para mensagens e atividades", () => {
    expect(migration).toContain(
      "alter publication supabase_realtime add table public.chat_messages",
    );
    expect(migration).toContain(
      "alter publication supabase_realtime add table public.activities",
    );
  });

  it("provisiona perfis completos a partir de auth.users", () => {
    expect(migration).toContain("function public.handle_new_auth_user()");
    expect(migration).toContain("trigger on_auth_user_created");
    expect(migration).toContain("display_name set not null");
  });

  it("ordena o chat por uma sequencia FIFO gerada no banco", () => {
    expect(fifoMigration).toContain("chat_messages_sequence_id_seq");
    expect(fifoMigration).toContain("sequence_id");
    expect(fifoMigration).toContain("chat_messages_chat_sequence_idx");
  });

  it("indexa a data usada para limpar mensagens expiradas", () => {
    expect(retentionMigration).toContain("chat_messages_retention_idx");
    expect(retentionMigration).toContain("created_at asc");
  });

  it("adiciona visibilidade de perfil com padrao publico e valores restritos", () => {
    expect(privacyMigration).toContain("profile_visibility text not null default 'public'");
    expect(privacyMigration).toContain("profile_visibility in ('public', 'private')");
  });

  it("permite ao usuario criar, editar e alterar a privacidade do proprio perfil", () => {
    expect(profileControlsMigration).toContain(
      "add column if not exists profile_visibility text not null default 'public'",
    );
    expect(profileControlsMigration.indexOf("add column if not exists profile_visibility"))
      .toBeLessThan(profileControlsMigration.indexOf("grant update (profile_visibility)"));
    expect(profileControlsMigration).toContain("grant update (profile_visibility)");
    expect(profileControlsMigration).toContain("grant insert (");
    expect(profileControlsMigration).toContain("uid,");
  });

  it("persiste a identidade estavel da RetroAchievements no perfil", () => {
    const retroAchievementsIdentityMigration = readFileSync(
      retroAchievementsIdentityMigrationPath,
      "utf8",
    ).replace(/\r\n/g, "\n");

    expect(retroAchievementsIdentityMigration).toMatch(
      /add column if not exists retroachievements_ulid text/i,
    );
    expect(retroAchievementsIdentityMigration).toMatch(
      /add column if not exists retroachievements_username text/i,
    );
    expect(retroAchievementsIdentityMigration).toContain(
      "profiles_retroachievements_ulid_unique",
    );
  });
});

describe("contrato da migration do sistema de troféus", () => {
  describe("trophy_definitions (catálogo)", () => {
    it("cria a tabela com chaves e restrições esperadas", () => {
      expect(trophyDefinitionsMigration).toMatch(
        /create table if not exists public\.trophy_definitions/i,
      );
      expect(trophyDefinitionsMigration).toContain("code text not null unique");
      expect(trophyDefinitionsMigration).toMatch(
        /tier in \('bronze', 'silver', 'gold', 'platinum'\)/i,
      );
      expect(trophyDefinitionsMigration).toContain("criteria jsonb not null");
      expect(trophyDefinitionsMigration).toContain("is_hidden boolean not null default false");
    });

    it("habilita RLS e expõe apenas a leitura para usuários autenticados", () => {
      expect(trophyDefinitionsMigration).toMatch(
        /alter table public\.trophy_definitions enable row level security/i,
      );
      expect(trophyDefinitionsMigration).toContain("trophy_definitions_select");
      expect(trophyDefinitionsMigration).toContain("for select to authenticated");
      expect(trophyDefinitionsMigration).toContain(
        "grant select on public.trophy_definitions to authenticated, service_role",
      );
      expect(trophyDefinitionsMigration).toContain("revoke all on public.trophy_definitions from public");
    });

    it("semear pelo menos 10 troféus cobrindo todas as categorias principais", () => {
      for (const code of [
        "first_trophy",
        "ten_trophies",
        "fifty_trophies",
        "hundred_trophies",
        "first_platinum",
        "five_platinums",
        "level_10",
        "level_50",
        "level_100",
        "link_both_platforms",
        "library_25",
        "library_100",
      ]) {
        expect(trophyDefinitionsMigration).toContain(`'${code}'`);
      }
    });
  });

  describe("user_trophies (estado por usuário)", () => {
    it("cria a tabela com unicidade por (user, trophy) e snapshot de contexto", () => {
      expect(userTrophiesMigration).toMatch(
        /create table if not exists public\.user_trophies/i,
      );
      expect(userTrophiesMigration).toContain("unique (user_id, trophy_id)");
      expect(userTrophiesMigration).toContain("progress numeric(5, 4)");
      expect(userTrophiesMigration).toContain("notified_at timestamptz");
    });

    it("impede unlock parcial: progress<1 só com unlocked_at=NULL", () => {
      expect(userTrophiesMigration).toContain(
        "user_trophies_progress_unlocked_consistency",
      );
      expect(userTrophiesMigration).toMatch(/progress = 1\.0 and unlocked_at is not null/);
      expect(userTrophiesMigration).toMatch(/progress < 1\.0 and unlocked_at is null/);
    });

    it("RLS só permite ver os próprios troféus e esconde os ocultos não desbloqueados", () => {
      expect(userTrophiesMigration).toMatch(
        /alter table public\.user_trophies enable row level security/i,
      );
      expect(userTrophiesMigration).toContain("user_trophies_select");
      expect(userTrophiesMigration).toContain("user_id = auth.uid()");
      expect(userTrophiesMigration).toContain("is_hidden = true");
    });

    it("exponibiliza uma view agregada de contadores por usuário", () => {
      expect(userTrophiesMigration).toMatch(
        /create view public\.user_trophy_stats_view/i,
      );
      expect(userTrophiesMigration).toContain("security_invoker = true");
      expect(userTrophiesMigration).toContain("unlocked_total");
      expect(userTrophiesMigration).toContain("unlocked_xp");
    });
  });

  describe("level_progress + xp_events (progressão e auditoria)", () => {
    it("cria a tabela de progresso com 1:1 em auth.users", () => {
      expect(levelProgressMigration).toMatch(
        /create table if not exists public\.level_progress/i,
      );
      expect(levelProgressMigration).toContain(
        "user_id uuid primary key references auth.users(id) on delete cascade",
      );
      expect(levelProgressMigration).toMatch(
        /tier in \('bronze', 'silver', 'gold', 'platinum'\)/i,
      );
    });

    it("xp_events é append-only com fonte e reason opcionais", () => {
      expect(levelProgressMigration).toMatch(
        /create table if not exists public\.xp_events/i,
      );
      expect(levelProgressMigration).toContain("source_type text not null");
      // Allowed source types: trophy_unlock, level_milestone, manual, correction.
      for (const src of ["trophy_unlock", "level_milestone", "manual", "correction"]) {
        expect(levelProgressMigration).toContain(`'${src}'`);
      }
      expect(levelProgressMigration).toContain("level_before integer");
      expect(levelProgressMigration).toContain("level_after integer");
    });

    it("codifica a tabela PSN em SQL com 10 brackets idênticos aos do cliente", () => {
      // O client-side fica em src/utils/trophyTiers.ts; qualquer divergência
      // entre cliente e servidor deve quebrar este teste. Os valores devem
      // bater com PSN_LEVEL_BRACKETS lá (45, 60, 90, 450, 900, 1350, 1800, 2250, 2700, 3150).
      const expected = [45, 60, 90, 450, 900, 1350, 1800, 2250, 2700, 3150];
      // Each XP value must appear at least twice (psn_xp_for_level + the
      // picked/loop tables inside psn_level_from_xp).
      for (const xp of expected) {
        const matches = levelProgressMigration.match(new RegExp(`\\b${xp}\\b`, "g")) || [];
        if (matches.length < 2) {
          throw new Error(
            `Expected XP bracket value ${xp} to appear at least twice in the migration; saw ${matches.length}`,
          );
        }
      }
    });

    it("oferece função imutável psn_xp_for_level reutilizável", () => {
      expect(levelProgressMigration).toContain("create or replace function public.psn_xp_for_level");
      expect(levelProgressMigration).toContain("returns integer");
      expect(levelProgressMigration).toContain("language sql");
      expect(levelProgressMigration).toContain("immutable");
    });

    it("oferece função psn_level_from_xp que retorna nível + xp + tier", () => {
      expect(levelProgressMigration).toContain("create or replace function public.psn_level_from_xp");
      expect(levelProgressMigration).toContain("returns table");
    });

    it("expõe award_xp idempotente apenas para service_role", () => {
      expect(levelProgressMigration).toContain("create or replace function public.award_xp");
      expect(levelProgressMigration).toMatch(
        /security definer[\s\S]*set search_path = public, pg_temp/,
      );
      expect(levelProgressMigration).toContain(
        "grant execute on function public.award_xp",
      );
      expect(levelProgressMigration).toContain("to service_role");
    });

    it("publica leaderboard dos top 100 por XP com nome do perfil", () => {
      expect(levelProgressMigration).toContain("create view public.level_leaderboard_view");
      expect(levelProgressMigration).toContain("security_invoker = true");
      expect(levelProgressMigration).toContain("order by lp.total_xp desc");
      expect(levelProgressMigration).toContain("limit 100");
    });
  });

  describe("notification_preferences (Phase 4)", () => {
    it("cria a tabela com 1:1 em auth.users e defaults opt-in", () => {
      expect(notificationPreferencesMigration).toMatch(
        /create table if not exists public\.notification_preferences/i,
      );
      expect(notificationPreferencesMigration).toContain(
        "user_id uuid primary key references auth.users(id) on delete cascade",
      );
      expect(notificationPreferencesMigration).toContain("enabled boolean not null default true");
      expect(notificationPreferencesMigration).toContain("email_enabled boolean not null default true");
      expect(notificationPreferencesMigration).toContain("push_enabled boolean not null default true");
    });

    it("restringe o tier mínimo de email a um dos 4 tiers oficiais", () => {
      expect(notificationPreferencesMigration).toMatch(
        /email_min_tier[^,]*check[^)]*bronze.*silver.*gold.*platinum/i,
      );
    });

    it("RLS: o usuário lê/atualiza apenas o próprio registro", () => {
      expect(notificationPreferencesMigration).toMatch(
        /alter table public\.notification_preferences enable row level security/i,
      );
      expect(notificationPreferencesMigration).toContain("notification_preferences_select");
      expect(notificationPreferencesMigration).toContain("notification_preferences_update");
      expect(notificationPreferencesMigration).toContain("notification_preferences_insert");
      for (const p of ["notification_preferences_select", "notification_preferences_update", "notification_preferences_insert"]) {
        expect(notificationPreferencesMigration).toContain(`${p} on public.notification_preferences`);
      }
    });

    it("expõe my_notification_preferences para o usuário criar a própria linha", () => {
      expect(notificationPreferencesMigration).toContain(
        "create or replace function public.my_notification_preferences()",
      );
      expect(notificationPreferencesMigration).toContain("on conflict (user_id) do nothing");
    });

    it("expõe pending_trophy_notifications apenas para service_role", () => {
      expect(notificationPreferencesMigration).toContain(
        "create or replace function public.pending_trophy_notifications",
      );
      expect(notificationPreferencesMigration).toMatch(
        /grant execute on function public\.pending_trophy_notifications[\s\S]*to service_role/,
      );
    });

    it("pending_trophy_notifications retorna dados mínimos do destinatário + troféu", () => {
      expect(notificationPreferencesMigration).toContain("returns table");
      for (const col of [
        "user_trophy_id",
        "user_id",
        "email",
        "locale",
        "email_min_tier",
        "email_enabled",
        "trophy_title",
        "trophy_tier",
        "trophy_xp",
        "unlocked_at",
      ]) {
        expect(notificationPreferencesMigration).toContain(col);
      }
    });
  });
});

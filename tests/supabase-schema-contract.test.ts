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
);
const fifoMigration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260730120000_chat_messages_fifo.sql",
  ),
  "utf8",
);
const retentionMigration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260730130000_chat_retention.sql",
  ),
  "utf8",
);
const privacyMigration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260801090000_profile_visibility.sql",
  ),
  "utf8",
);

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
});

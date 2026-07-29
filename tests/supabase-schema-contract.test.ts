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
});

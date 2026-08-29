import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("platform-purge-migration", () => {
  const sql = fs.readFileSync(
    path.resolve("supabase/migrations/20260829090000_platform_data_purge.sql"),
    "utf8",
  );

  it("creates an authenticated caller-scoped RPC that never takes a target UID parameter", () => {
    expect(sql).toContain("create or replace function public.purge_my_platform_data(platform_name text)");
    expect(sql).toContain("auth.uid()");
    expect(sql).toContain("grant execute on function public.purge_my_platform_data(text) to authenticated");
    expect(sql).toContain("revoke all on function public.purge_my_platform_data(text) from public");
  });

  it("restricts platform_name to steam or epic and clears matching profile fields", () => {
    expect(sql).toContain("normalized_platform not in ('steam', 'epic')");
    expect(sql).toContain("last_steam_sync_at");
    expect(sql).toContain("achievement_summary = '{}'::jsonb");
    expect(sql).toContain("library_summary = '{}'::jsonb");
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

const { single, select, upsert, update, eq, from, getSession } = vi.hoisted(() => {
  const single = vi.fn();
  const select = vi.fn(() => ({ single }));
  const eq = vi.fn(() => ({ select }));
  const upsert = vi.fn(() => ({ select }));
  const update = vi.fn(() => ({ eq }));
  return {
    single,
    select,
    upsert,
    update,
    eq,
    from: vi.fn(() => ({ upsert, update })),
    getSession: vi.fn(),
  };
});

vi.mock("../src/services/supabase", () => ({
  supabase: { auth: { getSession }, from },
}));

import { saveCurrentUserProfile } from "../src/services/profile";

describe("persistencia da edicao de perfil", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSession.mockResolvedValue({ data: { session: { user: { id: "user-1" } } } });
    single.mockResolvedValue({ data: { uid: "user-1" }, error: null });
  });

  it("cria o perfil ausente ou atualiza o perfil autenticado", async () => {
    await saveCurrentUserProfile({
      profile: {
        displayName: "Jogador",
        bio: "Bio",
        location: "Sao Paulo",
        pronouns: "ele/dele",
        website: "https://example.com",
        favoriteGenres: ["RPG"],
      },
    });

    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({
      uid: "user-1",
      display_name: "Jogador",
    }), { onConflict: "uid" });
    expect(select).toHaveBeenCalledWith("uid");
  });

  it("executa fallback de update quando o upsert falhar", async () => {
    single.mockResolvedValueOnce({ data: null, error: new Error("Permission denied for table profiles") });
    single.mockResolvedValueOnce({ data: { uid: "user-1" }, error: null });

    const result = await saveCurrentUserProfile({
      profile: {
        displayName: "Jogador Atualizado",
        bio: "Bio nova",
        location: "",
        pronouns: "",
        website: "",
        favoriteGenres: [],
      },
    });

    expect(result.displayName).toBe("Jogador Atualizado");
    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      display_name: "Jogador Atualizado",
    }));
  });

  it("nao confirma sucesso quando o banco nao devolve o perfil salvo", async () => {
    single.mockResolvedValueOnce({ data: null, error: null });
    single.mockResolvedValueOnce({ data: null, error: null });

    await expect(saveCurrentUserProfile({
      profile: {
        displayName: "Jogador",
        bio: "",
        location: "",
        pronouns: "",
        website: "",
        favoriteGenres: [],
      },
    })).rejects.toThrow(/salvar o perfil/i);
  });
});

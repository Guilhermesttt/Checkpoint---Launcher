import { beforeEach, describe, expect, it, vi } from "vitest";

const { single, select, eq, update, from, getSession } = vi.hoisted(() => {
  const single = vi.fn();
  const select = vi.fn(() => ({ single }));
  const eq = vi.fn(() => ({ select }));
  const update = vi.fn(() => ({ eq }));
  return {
    single,
    select,
    eq,
    update,
    from: vi.fn(() => ({ update })),
    getSession: vi.fn(),
  };
});

vi.mock("../src/services/supabase", () => ({
  supabase: { auth: { getSession }, from },
}));

import { saveProfileVisibility } from "../src/services/profilePrivacy";

describe("privacidade do perfil", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSession.mockResolvedValue({ data: { session: { user: { id: "user-1" } } } });
    single.mockResolvedValue({ data: { profile_visibility: "private" }, error: null });
  });

  it("persiste a escolha no perfil autenticado", async () => {
    await expect(saveProfileVisibility("private")).resolves.toBe("private");
    expect(update).toHaveBeenCalledWith({ profile_visibility: "private" });
    expect(eq).toHaveBeenCalledWith("uid", "user-1");
    expect(select).toHaveBeenCalledWith("profile_visibility");
  });

  it("propaga falhas de persistencia", async () => {
    single.mockResolvedValueOnce({ data: null, error: new Error("Falha de rede") });
    await expect(saveProfileVisibility("private")).rejects.toThrow("Falha de rede");
  });

  it("rejeita uma visibilidade invalida devolvida pelo banco", async () => {
    single.mockResolvedValueOnce({ data: { profile_visibility: "friends" }, error: null });
    await expect(saveProfileVisibility("private")).rejects.toThrow(/visibilidade/i);
  });
});

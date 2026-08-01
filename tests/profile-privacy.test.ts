import { beforeEach, describe, expect, it, vi } from "vitest";

const { eq, update, from, getSession } = vi.hoisted(() => {
  const eq = vi.fn();
  const update = vi.fn(() => ({ eq }));
  return {
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
    eq.mockResolvedValue({ error: null });
  });

  it("persiste a escolha no perfil autenticado", async () => {
    await expect(saveProfileVisibility("private")).resolves.toBe("private");
    expect(update).toHaveBeenCalledWith({ profile_visibility: "private" });
    expect(eq).toHaveBeenCalledWith("uid", "user-1");
  });

  it("propaga falhas de persistencia", async () => {
    eq.mockResolvedValueOnce({ error: new Error("Falha de rede") });
    await expect(saveProfileVisibility("private")).rejects.toThrow("Falha de rede");
  });
});

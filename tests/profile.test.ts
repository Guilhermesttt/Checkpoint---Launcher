import { describe, expect, it } from "vitest";
import { normalizeEditableProfile, PROFILE_LIMITS } from "../src/services/profile";

describe("edição de perfil", () => {
  it("normaliza campos e limita gêneros públicos", () => {
    expect(normalizeEditableProfile({
      displayName: "  Guilherme   Santana ",
      bio: "Gamer e dev",
      location: "  São Paulo  ",
      pronouns: "ele/dele",
      website: "https://example.com/guilherme",
      favoriteGenres: ["RPG", "FPS", "RPG", "Corrida", "Ação", "Terror", "Estratégia"],
    })).toMatchObject({
      displayName: "Guilherme Santana",
      location: "São Paulo",
      favoriteGenres: ["RPG", "FPS", "Corrida", "Ação", "Terror", "Estratégia"],
    });
  });

  it("rejeita site sem HTTPS e nome curto", () => {
    const base = {
      displayName: "Guilherme",
      bio: "",
      location: "",
      pronouns: "",
      website: "",
      favoriteGenres: [],
    };
    expect(() => normalizeEditableProfile({ ...base, website: "http://example.com" })).toThrow(/https/i);
    expect(() => normalizeEditableProfile({ ...base, displayName: "G" })).toThrow(/2 caracteres/i);
    expect(PROFILE_LIMITS.avatarBytes).toBe(5 * 1024 * 1024);
  });
});

// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import {
  getAdjacentSidebarCategory,
  readLastNavigation,
  writeLastCategory,
  writeLastSettingsTab,
} from "../src/services/launcherNavigation";

describe("restauracao da navegacao do launcher", () => {
  beforeEach(() => localStorage.clear());

  it("descarta categoria e subaba invalidas", () => {
    localStorage.setItem("checkpoint_last_category_user-1", "UNKNOWN");
    localStorage.setItem("checkpoint_last_settings_tab_user-1", "modal");

    expect(readLastNavigation("user-1")).toEqual({
      category: "ALL",
      settingsTab: "general",
    });
  });

  it("restaura uma categoria estavel e a subaba de ajustes", () => {
    writeLastCategory("user-1", "SETTINGS");
    writeLastSettingsTab("user-1", "connections");

    expect(readLastNavigation("user-1")).toEqual({
      category: "SETTINGS",
      settingsTab: "connections",
    });
  });

  it("preserva filtros de genero sem aceitar superficies transitorias", () => {
    writeLastCategory("user-1", "ACTION");
    writeLastCategory("user-2", "CHAT");

    expect(readLastNavigation("user-1").category).toBe("ACTION");
    expect(readLastNavigation("user-2").category).toBe("ALL");
  });
});

describe("navegacao sequencial da sidebar pelo controle", () => {
  it("avanca com R2 na mesma ordem visual da sidebar", () => {
    const visited = ["ALL"];
    let current: string | null = "ALL";

    while (current) {
      current = getAdjacentSidebarCategory(current, 1);
      if (current) visited.push(current);
    }

    expect(visited).toEqual([
      "ALL",
      "FAVORITES",
      "STEAM",
      "EPIC",
      "LOCAL",
      "FRIENDS",
      "FEED",
      "SPOTIFY",
      "MODS",
      "PROFILE",
    ]);
  });

  it("mantem os limites e volta uma categoria por vez com L2", () => {
    expect(getAdjacentSidebarCategory("ALL", -1)).toBeNull();
    expect(getAdjacentSidebarCategory("STEAM", -1)).toBe("FAVORITES");
    expect(getAdjacentSidebarCategory("PROFILE", 1)).toBeNull();
    expect(getAdjacentSidebarCategory("SETTINGS", 1)).toBeNull();
  });
});

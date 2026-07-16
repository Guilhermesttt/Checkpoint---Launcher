// @vitest-environment jsdom
import fs from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

type OverlayCallback = (payload: Record<string, unknown>) => void;

describe("overlay de conquistas", () => {
  let unlock: OverlayCallback;

  beforeEach(() => {
    vi.useFakeTimers();
    const html = fs.readFileSync(path.resolve("electron/overlay.html"), "utf8");
    const script = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
    if (!script) throw new Error("Script do overlay nao encontrado.");

    document.body.innerHTML = '<div id="achievement-stack"></div><div id="social-stack"></div>';
    Object.defineProperty(window, "achievementOverlay", {
      configurable: true,
      value: {
        onUnlock: (callback: OverlayCallback) => { unlock = callback; },
        onWelcome: () => undefined,
        onSocial: () => undefined,
        onPlaySound: () => undefined,
      },
    });
    window.eval(script);
  });

  it("renderiza nome, descricao e imagem recebidos do schema", () => {
    unlock({
      gameId: "steam_2050650",
      achievementId: "5",
      duplicate: false,
      achievement: {
        id: "5",
        name: "Minha obra-prima",
        description: "Obtenha a arma exclusiva.",
        icon: "https://cdn.example.com/re4-achievement.jpg",
      },
    });

    const card = document.querySelector(".achievement-card");
    expect(card?.querySelector(".achievement-title")?.textContent).toBe("Minha obra-prima");
    expect(card?.querySelector(".achievement-description")?.textContent).toBe("Obtenha a arma exclusiva.");
    expect(card?.querySelector("img")?.getAttribute("src")).toContain("re4-achievement.jpg");
  });

  it("substitui uma imagem quebrada pelo trofeu", () => {
    unlock({
      gameId: "steam_2050650",
      achievementId: "5",
      achievement: { id: "5", name: "Conquista", icon: "https://cdn.example.com/missing.jpg" },
    });

    const avatar = document.querySelector(".achievement-card .icon-avatar");
    avatar?.querySelector("img")?.dispatchEvent(new Event("error"));
    expect(avatar?.querySelector("svg")).not.toBeNull();
    expect(avatar?.querySelector("img")).toBeNull();
  });
});

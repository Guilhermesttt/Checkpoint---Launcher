// @vitest-environment jsdom
import fs from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

type OverlayCallback = (payload: Record<string, unknown>) => void;

describe("overlay de conquistas", () => {
  let unlock: OverlayCallback;
  let panelVisibility: OverlayCallback;
  let panelAction: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    panelAction = vi.fn(() => Promise.resolve());
    const html = fs.readFileSync(path.resolve("electron/overlay.html"), "utf8");
    const script = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
    if (!script) throw new Error("Script do overlay nao encontrado.");

    document.body.className = "";
    document.body.innerHTML = `
      <div id="achievement-stack"></div><div id="social-stack"></div>
      <section id="command-panel">
        <div id="panel-game-backdrop"></div><span id="panel-game"></span>
        <span id="achievement-game-label"></span>
        <span id="panel-profile-name"></span><span id="sidebar-profile-name"></span>
        <img id="sidebar-profile-avatar" /><img id="panel-profile-avatar" /><img id="profile-page-avatar" />
        <span id="profile-page-name"></span><span id="profile-page-status"></span><div id="profile-discord"><span id="profile-discord-name"></span></div>
        <span id="profile-friends-total"></span><span id="profile-online-total"></span><span id="profile-achievements-total"></span>
        <span id="panel-friend-count"></span><span id="panel-online-count"></span>
        <span id="online-heading-count"></span><span id="offline-heading-count"></span><b id="nav-unread"></b>
        <input id="friend-search" /><button id="show-all-friends"></button>
        <div id="panel-friends-view"><div id="panel-friends-online"></div><div id="panel-friends-offline"></div></div>
        <div id="panel-chat-list"><div id="conversation-list"></div></div><div id="panel-chat-view"></div>
        <div id="context-game-art"></div><span id="context-game-title"></span><span id="context-game-message"></span><span id="context-game-kicker"></span>
        <div id="game-page-art"></div><span id="game-page-title"></span><span id="game-page-message"></span><span id="game-live-status"><span id="game-live-label"></span></span>
        <span id="game-session-duration"></span><span id="game-total-playtime"></span><span id="game-achievement-ratio"></span><span id="game-friends-playing"></span>
        <span id="game-platform"></span><span id="game-executable"></span><span id="game-developer"></span><span id="game-release-date"></span><span id="game-window-mode"></span><span id="game-resolution"></span>
        <span id="panel-unlocked"></span><span id="panel-available"></span>
        <div id="panel-achievement-progress"></div><div id="panel-achievements"></div>
        <button id="panel-close"></button><button id="panel-close-top"></button><button id="chat-back"></button><form id="chat-form"><button id="chat-attach" type="button"></button><input id="chat-input" /></form><input id="chat-image-input" type="file" />
        <span id="chat-name"></span><img id="chat-avatar" /><span id="chat-status"></span>
        <span id="chat-typing"></span><span id="chat-error"></span><button id="chat-send"></button><div id="chat-messages"></div>
        <input id="setting-social" type="checkbox" /><input id="setting-achievements" type="checkbox" /><input id="setting-animations" type="checkbox" />
        <button id="record-capture-shortcut"><span id="record-shortcut-label"></span><kbd id="capture-shortcut-value"></kbd></button><span id="capture-shortcut-label"></span><span id="capture-setting-feedback"></span>
        <button id="capture-now"></button><button id="open-captures-folder"></button><div id="capture-gallery"></div>
      </section>
      <div id="capture-viewer" aria-hidden="true">
        <button id="capture-viewer-close"></button>
        <button id="capture-viewer-previous"></button>
        <img id="capture-viewer-image" />
        <button id="capture-viewer-next"></button>
        <span id="capture-viewer-name"></span><span id="capture-viewer-date"></span><span id="capture-viewer-counter"></span>
      </div>
    `;
    Object.defineProperty(window, "achievementOverlay", {
      configurable: true,
      value: {
        onUnlock: (callback: OverlayCallback) => { unlock = callback; },
        onWelcome: () => undefined,
        onSocial: () => undefined,
        onPlaySound: () => undefined,
        onPanelVisibility: (callback: OverlayCallback) => { panelVisibility = callback; },
        onPanelState: () => undefined,
        panelAction,
      },
    });
    window.eval(script);
  });

  it("mantem todas as paginas do painel no mesmo nivel de navegacao", () => {
    const html = fs.readFileSync(path.resolve("electron/overlay.html"), "utf8");
    const parsed = new DOMParser().parseFromString(html, "text/html");
    const content = parsed.querySelector(".panel-content");
    const views = ["friends", "chats", "game", "achievements", "media", "settings", "profile"];

    expect(content).not.toBeNull();
    views.forEach((view) => {
      expect(content?.querySelector(`:scope > [data-panel-view="${view}"]`)).not.toBeNull();
    });
  });

  it("mantem os toasts compactos mesmo em uma janela fullscreen", () => {
    const html = fs.readFileSync(path.resolve("electron/overlay.html"), "utf8");
    const cardRule = html.match(/\.overlay-card\s*\{([\s\S]*?)\}/)?.[1] || "";

    expect(html).toContain("--overlay-width: min(392px, calc(100vw - 32px))");
    expect(cardRule).toContain("container-type: inline-size");
    expect(cardRule).toContain("aspect-ratio: 447 / 157");
  });

  it("usa no overlay um logo incluido no pacote do Electron", () => {
    const html = fs.readFileSync(path.resolve("electron/overlay.html"), "utf8");
    const parsed = new DOMParser().parseFromString(html, "text/html");

    expect(parsed.querySelector(".panel-logo img")?.getAttribute("src")).toBe("../assets/icon.png");
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

  it("renderiza o painel interativo com amigos e progresso", () => {
    panelVisibility({
      open: true,
      state: {
        friends: [{ id: "friend-1", name: "Gui", status: "playing", playing: "Portal 2" }],
        achievements: { unlocked: 54, available: 1274 },
        currentGame: {
          id: "portal-2",
          title: "Portal 2",
          image: "",
          platform: "Steam",
          developer: "Valve",
          totalPlaytimeMinutes: 125,
          sessionStartedAt: "2026-07-16T12:00:00.000Z",
        },
        settings: { captureShortcut: "F8" },
        captures: [{ id: "capture-1", name: "Portal 2.png", url: "data:image/png;base64,AA==", createdAt: "2026-07-16T12:30:00.000Z" }],
      },
    });

    expect(document.getElementById("command-panel")?.classList.contains("is-open")).toBe(true);
    expect(document.querySelector(".friend-name")?.textContent).toBe("Gui");
    expect(document.getElementById("panel-unlocked")?.textContent).toBe("54");
    expect(document.getElementById("panel-game")?.textContent).toContain("Portal 2");
    expect(document.getElementById("game-platform")?.textContent).toBe("Steam");
    expect(document.getElementById("game-total-playtime")?.textContent).toBe("2h 5min");
    expect(document.querySelectorAll(".capture-card")).toHaveLength(1);
  });

  it("mantem avatar base64 completo e usa iniciais quando a imagem falha", () => {
    const avatarData = `data:image/webp;base64,${"A".repeat(8_000)}`;
    panelVisibility({
      open: true,
      state: {
        friends: [{
          id: "friend-avatar",
          name: "Gui Rosa",
          status: "online",
          avatar: avatarData,
        }],
      },
    });

    const avatar = document.querySelector<HTMLImageElement>(
      "#panel-friends-online .friend-avatar",
    );
    expect(avatar?.src).toBe(avatarData);

    avatar?.dispatchEvent(new Event("error"));
    expect(avatar?.src).toMatch(/^data:image\/svg\+xml/);
    expect(avatar?.src).toContain("GR");
  });

  it("mostra conquistas do jogo e permite conversar sem fechar o overlay", () => {
    panelVisibility({
      open: true,
      state: {
        friends: [{ id: "cp-friend:friend-1", name: "Mileide", status: "online", canChat: true, unread: 2 }],
        achievements: {
          unlocked: 1,
          available: 2,
          items: [
            { id: "A", name: "Primeira conquista", description: "Teste", achieved: true },
            { id: "B", name: "Conquista bloqueada", description: "Teste", achieved: false },
          ],
        },
        currentGame: { id: "re4", title: "Resident Evil 4", image: "" },
        chat: {
          friendId: "cp-friend:friend-1",
          friendName: "Mileide",
          messages: [{ id: "m1", text: "Bora jogar?", createdAt: "2026-07-16T12:00:00.000Z", mine: false }],
        },
      },
    });

    expect(document.querySelectorAll(".achievement-item")).toHaveLength(2);
    expect(document.querySelector(".achievement-item.is-locked")).not.toBeNull();
    expect(document.querySelector(".chat-message")?.textContent).toContain("Bora jogar?");

    const input = document.getElementById("chat-input") as HTMLInputElement;
    input.value = "Vamos";
    document.getElementById("chat-form")?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    expect(panelAction).toHaveBeenCalledWith({ kind: "send-message", text: "Vamos" });
  });

  it("mantem o compositor visivel, renderiza imagens e envia o estado de digitacao", () => {
    const html = fs.readFileSync(path.resolve("electron/overlay.html"), "utf8");
    const chatViewRule = html.match(
      /\.panel-view\[data-panel-view="chats"\]\.is-active\s*\{([\s\S]*?)\}/,
    )?.[1] || "";

    expect(chatViewRule).toContain("height: 100%");
    expect(chatViewRule).toContain("min-height: 0");
    expect(chatViewRule).toContain("overflow: hidden");

    panelVisibility({
      open: true,
      state: {
        chat: {
          friendId: "cp-friend:friend-1",
          friendName: "Mileide",
          messages: [{
            id: "image-1",
            text: "",
            attachmentUrl: "https://cdn.example.com/image.png",
            attachmentName: "image.png",
            createdAt: "2026-07-16T12:00:00.000Z",
            mine: false,
          }],
        },
      },
    });

    expect(document.querySelector(".chat-message-image")?.getAttribute("src"))
      .toContain("cdn.example.com/image.png");

    const input = document.getElementById("chat-input") as HTMLInputElement;
    input.value = "Ola";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    expect(panelAction).toHaveBeenCalledWith({ kind: "set-typing", typing: true });

    vi.advanceTimersByTime(2_500);
    expect(panelAction).toHaveBeenCalledWith({ kind: "set-typing", typing: false });
  });

  it("grava uma combinação personalizada para captura", async () => {
    panelVisibility({ open: true, state: { settings: { captureShortcut: "F8" } } });
    panelAction.mockResolvedValueOnce({ ok: true, shortcut: "CommandOrControl+K" });

    document.getElementById("record-capture-shortcut")?.click();
    window.dispatchEvent(new KeyboardEvent("keydown", {
      key: "k",
      code: "KeyK",
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    }));
    await Promise.resolve();

    expect(panelAction).toHaveBeenCalledWith({ kind: "set-capture-shortcut", shortcut: "CommandOrControl+K" });
    expect(document.getElementById("capture-shortcut-value")?.textContent).toBe("Ctrl + K");
  });

  it("pede confirmação e exclui uma captura pela galeria", async () => {
    panelVisibility({
      open: true,
      state: {
        settings: { captureShortcut: "F8" },
        captures: [{ id: "capture-1", name: "Portal 2.png", url: "data:image/png;base64,AA==", createdAt: "2026-07-16T12:30:00.000Z" }],
      },
    });
    panelAction.mockResolvedValueOnce({ ok: true });

    const deleteButton = document.querySelector<HTMLButtonElement>(".capture-delete");
    deleteButton?.click();
    expect(deleteButton?.classList.contains("is-confirming")).toBe(true);
    expect(panelAction).not.toHaveBeenCalledWith({ kind: "delete-capture", captureId: "capture-1" });
    deleteButton?.click();
    await Promise.resolve();

    expect(panelAction).toHaveBeenCalledWith({ kind: "delete-capture", captureId: "capture-1" });
  });

  it("abre, navega e fecha as capturas dentro do overlay", () => {
    panelVisibility({
      open: true,
      state: {
        settings: { captureShortcut: "F8" },
        captures: [
          { id: "capture-1", name: "Portal 2.png", url: "data:image/png;base64,AA==", createdAt: "2026-07-16T12:30:00.000Z" },
          { id: "capture-2", name: "Half-Life 2.png", url: "data:image/png;base64,BB==", createdAt: "2026-07-16T12:31:00.000Z" },
        ],
      },
    });

    document.querySelector<HTMLElement>(".capture-card")?.click();
    expect(document.getElementById("capture-viewer")?.classList.contains("is-open")).toBe(true);
    expect(document.getElementById("capture-viewer-name")?.textContent).toBe("Portal 2.png");
    expect(document.getElementById("capture-viewer-counter")?.textContent).toBe("1 de 2");

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    expect(document.getElementById("capture-viewer-name")?.textContent).toBe("Half-Life 2.png");
    expect(document.getElementById("capture-viewer-counter")?.textContent).toBe("2 de 2");

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(document.getElementById("capture-viewer")?.classList.contains("is-open")).toBe(false);
  });
});

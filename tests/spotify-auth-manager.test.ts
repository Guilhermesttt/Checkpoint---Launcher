import { createRequire } from "node:module";
import { describe, expect, it, vi } from "vitest";

const require = createRequire(import.meta.url);
const { createSpotifyAuthManager } = require("../electron/spotify-auth-manager.cjs");

class FakeAuthWindow {
  static latest: FakeAuthWindow | null = null;
  listeners = new Map<string, (...args: unknown[]) => void>();
  webListeners = new Map<string, (...args: unknown[]) => void>();
  loadedUrl = "";
  destroyed = false;
  webContents = {
    on: (name: string, listener: (...args: unknown[]) => void) => this.webListeners.set(name, listener),
  };

  constructor() {
    FakeAuthWindow.latest = this;
  }
  once(name: string, listener: (...args: unknown[]) => void) { this.listeners.set(name, listener); }
  on(name: string, listener: (...args: unknown[]) => void) { this.listeners.set(name, listener); }
  loadURL(url: string) { this.loadedUrl = url; }
  show() {}
  close() { this.destroyed = true; }
  isDestroyed() { return this.destroyed; }
  navigate(url: string) {
    this.webListeners.get("will-navigate")?.({ preventDefault: vi.fn() }, url);
  }
}

describe("gerenciador OAuth Spotify", () => {
  it("sinaliza tokens antigos que precisam autorizar os novos escopos", () => {
    const manager = createSpotifyAuthManager({
      BrowserWindow: FakeAuthWindow,
      fetchImpl: vi.fn(),
      credentialStore: {
        read: () => ({
          accessToken: "access",
          refreshToken: "refresh",
          expiresAt: Date.now() + 60_000,
          scope: "streaming user-read-private",
          account: { id: "id", displayName: "Player", imageUrl: "", product: "premium" },
        }),
        write: vi.fn(),
        clear: vi.fn(),
      },
    });

    expect(manager.getStatus()).toMatchObject({
      connected: true,
      requiresReauthorization: true,
    });
  });

  it("troca o callback PKCE por tokens e retorna a conta conectada", async () => {
    const write = vi.fn();
    const fetchImpl = vi.fn(async (url: string) => {
      if (url.includes("/api/token")) {
        return new Response(JSON.stringify({
          access_token: "access",
          refresh_token: "refresh",
          expires_in: 3600,
          scope: "streaming",
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify({ id: "spotify-user", display_name: "Player" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });
    const manager = createSpotifyAuthManager({
      BrowserWindow: FakeAuthWindow,
      fetchImpl,
      credentialStore: { read: () => null, write, clear: vi.fn() },
      redirectUri: "http://127.0.0.1:43821/callback",
    });

    const connecting = manager.connect("client-id");
    const authWindow = FakeAuthWindow.latest;
    expect(authWindow?.loadedUrl).toContain("accounts.spotify.com/authorize");
    const state = new URL(authWindow!.loadedUrl).searchParams.get("state");
    authWindow?.navigate(`http://127.0.0.1:43821/callback?code=code-1&state=${state}`);

    await expect(connecting).resolves.toMatchObject({
      connected: true,
      account: { id: "spotify-user", displayName: "Player" },
    });
    expect(write).toHaveBeenCalledWith(expect.objectContaining({ refreshToken: "refresh" }));
  });

  it("rejeita callback com state diferente", async () => {
    const manager = createSpotifyAuthManager({
      BrowserWindow: FakeAuthWindow,
      fetchImpl: vi.fn(),
      credentialStore: { read: () => null, write: vi.fn(), clear: vi.fn() },
      redirectUri: "http://127.0.0.1:43821/callback",
    });
    const connecting = manager.connect("client-id");
    FakeAuthWindow.latest?.navigate("http://127.0.0.1:43821/callback?code=x&state=wrong");
    await expect(connecting).rejects.toThrow("state");
  });

  it("explica como recuperar quando o Spotify recusa a autorizacao", async () => {
    const manager = createSpotifyAuthManager({
      BrowserWindow: FakeAuthWindow,
      fetchImpl: vi.fn(),
      credentialStore: { read: () => null, write: vi.fn(), clear: vi.fn() },
      redirectUri: "http://127.0.0.1:43821/callback",
    });
    const connecting = manager.connect("client-id");
    const authWindow = FakeAuthWindow.latest;
    const state = new URL(authWindow!.loadedUrl).searchParams.get("state");

    authWindow?.navigate(`http://127.0.0.1:43821/callback?error=access_denied&state=${state}`);

    await expect(connecting).rejects.toThrow(
      "Autorizacao do Spotify recusada. Clique em Aceitar e confirme que esta conta Premium foi adicionada em Users Management no painel do app.",
    );
  });

  it("explica o bloqueio de uma conta fora do Users Management", async () => {
    const fetchImpl = vi.fn(async (url: string) => {
      if (url.includes("/api/token")) {
        return new Response(JSON.stringify({
          access_token: "access",
          refresh_token: "refresh",
          expires_in: 3600,
          scope: "streaming",
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      return new Response("", { status: 403 });
    });
    const manager = createSpotifyAuthManager({
      BrowserWindow: FakeAuthWindow,
      fetchImpl,
      credentialStore: { read: () => null, write: vi.fn(), clear: vi.fn() },
      redirectUri: "http://127.0.0.1:43821/callback",
    });

    const connecting = manager.connect("client-id");
    const authWindow = FakeAuthWindow.latest;
    const state = new URL(authWindow!.loadedUrl).searchParams.get("state");
    authWindow?.navigate(`http://127.0.0.1:43821/callback?code=code-1&state=${state}`);

    await expect(connecting).rejects.toThrow(/403.*Users Management/i);
  });
});

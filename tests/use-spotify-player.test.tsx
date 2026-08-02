// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useSpotifyPlayer } from "../src/hooks/useSpotifyPlayer";

afterEach(() => {
  vi.useRealTimers();
  Reflect.deleteProperty(window, "electronAPI");
  Reflect.deleteProperty(window, "Spotify");
});

describe("useSpotifyPlayer", () => {
  it("explica quando o Client ID ainda nao foi configurado", async () => {
    const { result } = renderHook(() => useSpotifyPlayer(""));
    await waitFor(() => expect(result.current.status).toBe("unconfigured"));
    expect(result.current.error).toContain("VITE_SPOTIFY_CLIENT_ID");
  });

  it("consulta a conexao protegida pelo Electron", async () => {
    const getSpotifyStatus = vi.fn().mockResolvedValue({ connected: false, account: null });
    Object.defineProperty(window, "electronAPI", {
      configurable: true,
      value: { getSpotifyStatus },
    });
    const { result } = renderHook(() => useSpotifyPlayer("client-id"));

    await waitFor(() => expect(result.current.status).toBe("disconnected"));
    expect(getSpotifyStatus).toHaveBeenCalledOnce();
  });

  it("nao quebra quando o preload Electron ainda nao possui os metodos Spotify", async () => {
    Object.defineProperty(window, "electronAPI", {
      configurable: true,
      value: { openExternalUrl: vi.fn() },
    });

    const { result } = renderHook(() => useSpotifyPlayer("client-id"));

    await waitFor(() => expect(result.current.status).toBe("unsupported"));
    expect(result.current.error).toContain("Atualize o Checkpoint Launcher");
  });

  it("abandona o SDK travado e passa a controlar o dispositivo Spotify ativo", async () => {
    vi.useFakeTimers();
    const disconnect = vi.fn();
    class HangingSpotifyPlayer {
      addListener() { return true; }
      connect() { return new Promise<boolean>(() => undefined); }
      disconnect() { disconnect(); }
      activateElement() { return Promise.resolve(); }
      togglePlay() { return Promise.resolve(); }
      nextTrack() { return Promise.resolve(); }
      previousTrack() { return Promise.resolve(); }
      setVolume() { return Promise.resolve(); }
    }
    Object.defineProperty(window, "Spotify", {
      configurable: true,
      value: { Player: HangingSpotifyPlayer },
    });
    Object.defineProperty(window, "electronAPI", {
      configurable: true,
      value: {
        getSpotifyStatus: vi.fn().mockResolvedValue({
          connected: true,
          account: { id: "spotify-user", displayName: "Player", imageUrl: "", product: "premium" },
        }),
        getSpotifyAccessToken: vi.fn().mockResolvedValue({ accessToken: "access" }),
      },
    });

    const { result } = renderHook(() => useSpotifyPlayer("client-id"));
    await act(async () => { await Promise.resolve(); });
    expect(result.current.status).toBe("connecting");

    await act(async () => {
      vi.advanceTimersByTime(15_000);
      await Promise.resolve();
    });

    expect(result.current.status).toBe("ready");
    expect(result.current.remoteMode).toBe(true);
    expect(result.current.error).toContain("dispositivo Spotify ativo");
    expect(disconnect).toHaveBeenCalledOnce();
  });

  it("recria o SDK depois que o dispositivo fica indisponivel", async () => {
    const instances: ResilientSpotifyPlayer[] = [];
    class ResilientSpotifyPlayer {
      listeners = new Map<string, (payload: { device_id: string; message: string }) => void>();
      constructor() { instances.push(this); }
      addListener(event: string, callback: (payload: { device_id: string; message: string }) => void) { this.listeners.set(event, callback); return true; }
      async connect() { this.listeners.get("ready")?.({ device_id: `device-${instances.length}`, message: "" }); return true; }
      disconnect() {}
      activateElement() { return Promise.resolve(); }
      togglePlay() { return Promise.resolve(); }
      nextTrack() { return Promise.resolve(); }
      previousTrack() { return Promise.resolve(); }
      setVolume() { return Promise.resolve(); }
      seek() { return Promise.resolve(); }
    }
    Object.defineProperty(window, "Spotify", { configurable: true, value: { Player: ResilientSpotifyPlayer } });
    Object.defineProperty(window, "electronAPI", {
      configurable: true,
      value: {
        getSpotifyStatus: vi.fn().mockResolvedValue({ connected: true, account: { id: "id", displayName: "Player", imageUrl: "", product: "premium" } }),
        getSpotifyAccessToken: vi.fn().mockResolvedValue({ accessToken: "access" }),
        connectSpotify: vi.fn().mockResolvedValue({ account: { id: "id", displayName: "Player", imageUrl: "", product: "premium" } }),
      },
    });
    const { result } = renderHook(() => useSpotifyPlayer("client-id"));
    await waitFor(() => expect(result.current.status).toBe("ready"));
    act(() => instances[0].listeners.get("not_ready")?.({ device_id: "device-1", message: "offline" }));
    await waitFor(() => expect(result.current.status).toBe("error"));
    await act(async () => { await result.current.connect(); });
    expect(instances).toHaveLength(2);
    expect(result.current.status).toBe("ready");
  });

  it("reflete play e pause imediatamente, bloqueia duplicatas e desfaz em falha", async () => {
    let rejectToggle!: (reason: Error) => void;
    const togglePlay = vi.fn(() => new Promise<void>((_resolve, reject) => {
      rejectToggle = reject;
    }));
    const seek = vi.fn().mockResolvedValue(undefined);
    const instances: OptimisticSpotifyPlayer[] = [];
    class OptimisticSpotifyPlayer {
      listeners = new Map<string, (payload: any) => void>();
      constructor() { instances.push(this); }
      addListener(event: string, callback: (payload: any) => void) { this.listeners.set(event, callback); return true; }
      async connect() { this.listeners.get("ready")?.({ device_id: "device-1" }); return true; }
      disconnect() {}
      activateElement() { return Promise.resolve(); }
      togglePlay() { return togglePlay(); }
      nextTrack() { return Promise.resolve(); }
      previousTrack() { return Promise.resolve(); }
      setVolume() { return Promise.resolve(); }
      seek(positionMs: number) { return seek(positionMs); }
    }
    Object.defineProperty(window, "Spotify", {
      configurable: true,
      value: { Player: OptimisticSpotifyPlayer },
    });
    Object.defineProperty(window, "electronAPI", {
      configurable: true,
      value: {
        getSpotifyStatus: vi.fn().mockResolvedValue({
          connected: true,
          requiresReauthorization: false,
          account: { id: "id", displayName: "Player", imageUrl: "", product: "premium" },
        }),
        getSpotifyAccessToken: vi.fn().mockResolvedValue({ accessToken: "access" }),
      },
    });
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ currently_playing: null, queue: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const { result } = renderHook(() => useSpotifyPlayer("client-id"));
    await waitFor(() => expect(result.current.status).toBe("ready"));
    const instance = instances[0];
    act(() => instance!.listeners.get("player_state_changed")?.({
      paused: true,
      position: 1_000,
      duration: 60_000,
      track_window: { current_track: {
        id: "track", uri: "spotify:track:track", name: "Track",
        artists: [{ name: "Artist" }], album: { images: [] },
      } },
    }));

    let firstCommand!: Promise<void>;
    act(() => { firstCommand = result.current.togglePlay(); });
    expect(result.current.playback.paused).toBe(false);
    expect(result.current.pendingCommands.has("toggle")).toBe(true);
    act(() => { void result.current.togglePlay(); });
    expect(togglePlay).toHaveBeenCalledOnce();

    await act(async () => {
      rejectToggle(new Error("playback failed"));
      await firstCommand.catch(() => undefined);
    });
    expect(result.current.playback.paused).toBe(true);
    expect(result.current.pendingCommands.has("toggle")).toBe(false);
    await act(async () => { await result.current.seek(5_000); });
    expect(seek).toHaveBeenCalledOnce();
    fetchSpy.mockRestore();
  });
});

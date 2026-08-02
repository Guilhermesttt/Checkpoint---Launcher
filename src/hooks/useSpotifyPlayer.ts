import * as React from "react";
import {
  addSpotifyTrackToQueue,
  getSpotifyQueue,
  getSpotifyClientId,
  playSpotifyContext,
  resolveSpotifyPlaybackDevice,
  searchSpotifyTracks,
  setSpotifyShuffle,
  startSpotifyTrackSequence,
  spotifyRequest,
  type SpotifyQueueSnapshot,
  type SpotifyTrack,
} from "../services/spotify";
import {
  EMPTY_SPOTIFY_PLAYBACK,
  advanceSpotifyPlayback,
  applySpotifyPlaybackCommand,
  buildSpotifyPlaybackSequence,
  mapSpotifyPlaybackState,
  mapSpotifyWebApiPlayback,
  type SpotifyPlaybackSnapshot,
} from "../services/spotifyPlayback";

type SpotifyStatus = "loading" | "unconfigured" | "unsupported" | "disconnected" | "connecting" | "ready" | "error";

const SPOTIFY_DESKTOP_UNAVAILABLE_MESSAGE =
  "Atualize o Checkpoint Launcher para usar o Spotify. A integração não está disponível nesta versão do aplicativo ou no navegador.";

const hasSpotifyDesktopApi = () => {
  const api = window.electronAPI;
  return typeof api?.getSpotifyStatus === "function";
};

interface SpotifyPlayerInstance {
  addListener(event: "ready" | "not_ready", callback: (payload: { device_id: string }) => void): boolean;
  addListener(event: "player_state_changed", callback: (payload: unknown) => void): boolean;
  addListener(
    event: "initialization_error" | "authentication_error" | "account_error" | "playback_error",
    callback: (payload: { message: string }) => void,
  ): boolean;
  connect: () => Promise<boolean>;
  disconnect: () => void;
  activateElement: () => Promise<void>;
  togglePlay: () => Promise<void>;
  nextTrack: () => Promise<void>;
  previousTrack: () => Promise<void>;
  setVolume: (volume: number) => Promise<void>;
  seek: (positionMs: number) => Promise<void>;
}

interface SpotifySdkWindow extends Window {
  Spotify?: {
    Player: new (options: {
      name: string;
      getOAuthToken: (callback: (token: string) => void) => void;
      volume: number;
      enableMediaSession: boolean;
    }) => SpotifyPlayerInstance;
  };
  onSpotifyWebPlaybackSDKReady?: () => void;
}

let spotifySdkPromise: Promise<NonNullable<SpotifySdkWindow["Spotify"]>> | null = null;

const withTimeout = <T,>(promise: Promise<T>, milliseconds: number, message: string) =>
  new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error(message)), milliseconds);
    promise.then(
      (value) => {
        window.clearTimeout(timer);
        resolve(value);
      },
      (reason) => {
        window.clearTimeout(timer);
        reject(reason);
      },
    );
  });

const loadSpotifySdk = () => {
  const spotifyWindow = window as SpotifySdkWindow;
  if (spotifyWindow.Spotify) return Promise.resolve(spotifyWindow.Spotify);
  if (spotifySdkPromise) return spotifySdkPromise;
  spotifySdkPromise = new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => reject(new Error("Spotify Web Playback SDK nao respondeu.")), 15_000);
    spotifyWindow.onSpotifyWebPlaybackSDKReady = () => {
      window.clearTimeout(timeout);
      if (spotifyWindow.Spotify) resolve(spotifyWindow.Spotify);
      else reject(new Error("Spotify Web Playback SDK indisponivel."));
    };
    const existing = document.querySelector<HTMLScriptElement>('script[data-checkpoint-spotify-sdk="true"]');
    if (existing) return;
    const script = document.createElement("script");
    script.src = "https://sdk.scdn.co/spotify-player.js";
    script.async = true;
    script.dataset.checkpointSpotifySdk = "true";
    script.onerror = () => reject(new Error("Nao foi possivel carregar o player do Spotify."));
    document.head.appendChild(script);
  });
  return spotifySdkPromise;
};

export const useSpotifyPlayer = (clientIdOverride?: string) => {
  const clientId = clientIdOverride ?? getSpotifyClientId();
  const desktopApiAvailable = hasSpotifyDesktopApi();
  const playerRef = React.useRef<SpotifyPlayerInstance | null>(null);
  const deviceIdRef = React.useRef("");
  const playbackRef = React.useRef<SpotifyPlaybackSnapshot>(EMPTY_SPOTIFY_PLAYBACK);
  const pendingCommandKeysRef = React.useRef(new Set<string>());
  const [status, setStatus] = React.useState<SpotifyStatus>(() => !clientId
    ? "unconfigured"
    : desktopApiAvailable ? "loading" : "unsupported");
  const [error, setError] = React.useState(() => !clientId
    ? "Configure VITE_SPOTIFY_CLIENT_ID para conectar o Spotify."
    : desktopApiAvailable ? "" : SPOTIFY_DESKTOP_UNAVAILABLE_MESSAGE);
  const [account, setAccount] = React.useState<{ id: string; displayName: string; imageUrl: string; product: string } | null>(null);
  const [playback, setPlayback] = React.useState<SpotifyPlaybackSnapshot>(EMPTY_SPOTIFY_PLAYBACK);
  const [queue, setQueue] = React.useState<SpotifyQueueSnapshot>({ current: null, upcoming: [] });
  const [shuffle, setShuffle] = React.useState(false);
  const [pendingCommands, setPendingCommands] = React.useState<ReadonlySet<string>>(new Set());
  const [remoteMode, setRemoteMode] = React.useState(false);

  const updatePlayback = React.useCallback((
    next: SpotifyPlaybackSnapshot | ((current: SpotifyPlaybackSnapshot) => SpotifyPlaybackSnapshot),
  ) => {
    setPlayback((current) => {
      const resolved = typeof next === "function" ? next(current) : next;
      playbackRef.current = resolved;
      return resolved;
    });
  }, []);

  const getAccessToken = React.useCallback(async () => {
    const api = window.electronAPI;
    if (typeof api?.getSpotifyAccessToken !== "function") {
      throw new Error(SPOTIFY_DESKTOP_UNAVAILABLE_MESSAGE);
    }
    const response = await api.getSpotifyAccessToken(clientId);
    if (!response?.accessToken) throw new Error("Token Spotify indisponivel.");
    return response.accessToken;
  }, [clientId]);

  const initializePlayer = React.useCallback(async () => {
    if (playerRef.current) return;
    const sdk = await loadSpotifySdk();
    const player = new sdk.Player({
      name: "Checkpoint Launcher",
      getOAuthToken: (callback) => { void getAccessToken().then(callback).catch((reason) => setError(String(reason))); },
      volume: 0.55,
      enableMediaSession: true,
    });
    let resolveReady!: () => void;
    let rejectReady!: (reason: Error) => void;
    const readyPromise = new Promise<void>((resolve, reject) => {
      resolveReady = resolve;
      rejectReady = reject;
    });
    const releaseFailedPlayer = () => {
      if (playerRef.current !== player) return;
      player.disconnect();
      playerRef.current = null;
      deviceIdRef.current = "";
    };
    player.addListener("ready", ({ device_id }: { device_id: string }) => {
      if (playerRef.current !== player) return;
      deviceIdRef.current = device_id;
      setStatus("ready");
      setError("");
      resolveReady();
    });
    player.addListener("not_ready", () => {
      if (playerRef.current !== player) return;
      releaseFailedPlayer();
      setStatus("error");
      setError("O dispositivo Checkpoint ficou indisponivel no Spotify.");
      rejectReady(new Error("O dispositivo Checkpoint ficou indisponivel no Spotify."));
    });
    player.addListener("player_state_changed", (state) => updatePlayback(mapSpotifyPlaybackState(state)));
    player.addListener("initialization_error", ({ message }: { message: string }) => { releaseFailedPlayer(); setStatus("error"); setError(message); rejectReady(new Error(message)); });
    player.addListener("authentication_error", ({ message }: { message: string }) => { releaseFailedPlayer(); setStatus("error"); setError(message); rejectReady(new Error(message)); });
    player.addListener("account_error", () => { const message = "A reproducao dentro do launcher exige Spotify Premium."; releaseFailedPlayer(); setStatus("error"); setError(message); rejectReady(new Error(message)); });
    player.addListener("playback_error", ({ message }: { message: string }) => setError(message));
    playerRef.current = player;
    await withTimeout((async () => {
      const connected = await player.connect();
      if (!connected) throw new Error("O Spotify nao conseguiu registrar o Checkpoint como dispositivo.");
      await readyPromise;
    })(), 12_000, "O player interno do Spotify demorou para responder.");
  }, [getAccessToken, updatePlayback]);

  const enableRemoteFallback = React.useCallback((reason?: unknown) => {
    playerRef.current?.disconnect();
    playerRef.current = null;
    deviceIdRef.current = "";
    setRemoteMode(true);
    setStatus("ready");
    setError(reason instanceof Error
      ? `Player interno indisponivel; controlando seu dispositivo Spotify ativo. ${reason.message}`
      : "Controlando seu dispositivo Spotify ativo.");
  }, []);

  React.useEffect(() => {
    if (!clientId || !desktopApiAvailable) {
      return;
    }
    const api = window.electronAPI;
    if (typeof api?.getSpotifyStatus !== "function") return;
    let cancelled = false;
    void api.getSpotifyStatus()
      .then((result) => {
        if (cancelled) return;
        setAccount(result.account);
        if (result.requiresReauthorization) {
          setStatus("disconnected");
          setError("Reconecte o Spotify uma vez para liberar playlists e fila.");
          return;
        }
        if (!result.connected) {
          setStatus("disconnected");
          return;
        }
        setStatus("connecting");
        void initializePlayer().catch((reason) => { if (!cancelled) enableRemoteFallback(reason); });
      })
      .catch((reason) => {
        if (!cancelled) { setStatus("error"); setError(reason instanceof Error ? reason.message : String(reason)); }
      });
    return () => {
      cancelled = true;
      playerRef.current?.disconnect();
      playerRef.current = null;
    };
  }, [clientId, desktopApiAvailable, enableRemoteFallback, initializePlayer]);

  const syncRemotePlayback = React.useCallback(async () => {
    const state = await spotifyRequest(await getAccessToken(), "/me/player");
    updatePlayback(mapSpotifyWebApiPlayback(state));
  }, [getAccessToken, updatePlayback]);

  const refreshQueue = React.useCallback(async () => {
    const nextQueue = await getSpotifyQueue(await getAccessToken());
    setQueue(nextQueue);
    return nextQueue;
  }, [getAccessToken]);

  React.useEffect(() => {
    if (!remoteMode || status !== "ready") return;
    const sync = () => void syncRemotePlayback().catch(() => undefined);
    sync();
    const timer = window.setInterval(sync, 8_000);
    return () => window.clearInterval(timer);
  }, [remoteMode, status, syncRemotePlayback]);

  React.useEffect(() => {
    if (playback.paused || !playback.track) return;
    const timer = window.setInterval(() => {
      updatePlayback((current) => advanceSpotifyPlayback(current, 1_000));
    }, 1_000);
    return () => window.clearInterval(timer);
  }, [playback.paused, playback.track, updatePlayback]);

  React.useEffect(() => {
    if (status !== "ready") return;
    void refreshQueue().catch(() => undefined);
  }, [refreshQueue, status]);

  const runOptimisticCommand = React.useCallback(async (
    key: string,
    optimistic: (current: SpotifyPlaybackSnapshot) => SpotifyPlaybackSnapshot,
    execute: () => Promise<unknown>,
  ) => {
    if (pendingCommandKeysRef.current.has(key)) return;
    const previous = playbackRef.current;
    pendingCommandKeysRef.current.add(key);
    setPendingCommands(new Set(pendingCommandKeysRef.current));
    updatePlayback(optimistic);
    try {
      await execute();
    } catch (reason) {
      updatePlayback(previous);
      throw reason;
    } finally {
      pendingCommandKeysRef.current.delete(key);
      setPendingCommands(new Set(pendingCommandKeysRef.current));
    }
  }, [updatePlayback]);

  React.useEffect(() => {
    window.dispatchEvent(new CustomEvent("checkpoint:spotify-playback", {
      detail: { playing: Boolean(playback.track && !playback.paused) },
    }));
  }, [playback.paused, playback.track]);

  const connect = React.useCallback(async () => {
    if (!clientId) return;
    const api = window.electronAPI;
    if (typeof api?.connectSpotify !== "function") {
      setStatus("unsupported");
      setError(SPOTIFY_DESKTOP_UNAVAILABLE_MESSAGE);
      return;
    }
    setStatus("connecting");
    setError("");
    try {
      const result = await api.connectSpotify(clientId);
      if (!result) throw new Error("Electron indisponivel para autenticar o Spotify.");
      setAccount(result.account);
      await initializePlayer().catch(enableRemoteFallback);
    } catch (reason) {
      setStatus("error");
      setError(reason instanceof Error ? reason.message : String(reason));
    }
  }, [clientId, enableRemoteFallback, initializePlayer]);

  const disconnect = React.useCallback(async () => {
    playerRef.current?.disconnect();
    playerRef.current = null;
    deviceIdRef.current = "";
    const api = window.electronAPI;
    if (typeof api?.disconnectSpotify !== "function") {
      setStatus("unsupported");
      setError(SPOTIFY_DESKTOP_UNAVAILABLE_MESSAGE);
      return;
    }
    await api.disconnectSpotify();
    setAccount(null);
    updatePlayback(EMPTY_SPOTIFY_PLAYBACK);
    setQueue({ current: null, upcoming: [] });
    setRemoteMode(false);
    setStatus("disconnected");
    setError("");
  }, [updatePlayback]);

  const playTrack = React.useCallback(async (track: SpotifyTrack, candidates: SpotifyTrack[] = []) => {
    await playerRef.current?.activateElement();
    const token = await getAccessToken();
    const deviceId = await resolveSpotifyPlaybackDevice(token, deviceIdRef.current);
    deviceIdRef.current = deviceId;
    const previous = playbackRef.current;
    const sequence = buildSpotifyPlaybackSequence(track, candidates);
    updatePlayback({ paused: false, positionMs: 0, durationMs: track.durationMs, track });
    try {
      await startSpotifyTrackSequence(
        token,
        track.uri,
        sequence.slice(1).map((item) => item.uri),
        deviceId,
      );
    } catch (reason) {
      updatePlayback(previous);
      throw reason;
    }
    await refreshQueue().catch(() => undefined);
  }, [getAccessToken, refreshQueue, updatePlayback]);

  const search = React.useCallback(async (query: string) =>
    searchSpotifyTracks(await getAccessToken(), query), [getAccessToken]);

  const playContext = React.useCallback(async (contextUri: string) => {
    const token = await getAccessToken();
    const deviceId = await resolveSpotifyPlaybackDevice(token, deviceIdRef.current);
    deviceIdRef.current = deviceId;
    await playSpotifyContext(token, contextUri, deviceId);
    window.setTimeout(() => {
      void syncRemotePlayback().catch(() => undefined);
      void refreshQueue().catch(() => undefined);
    }, 1_000);
  }, [getAccessToken, refreshQueue, syncRemotePlayback]);

  const remoteCommand = React.useCallback(async (endpoint: string, method: string) => {
    const deviceId = deviceIdRef.current;
    const targetEndpoint = deviceId
      ? `${endpoint}${endpoint.includes("?") ? "&" : "?"}device_id=${encodeURIComponent(deviceId)}`
      : endpoint;
    await spotifyRequest(await getAccessToken(), targetEndpoint, { method });
  }, [getAccessToken]);

  const seek = React.useCallback(async (positionMs: number) => {
    const boundedPosition = Math.max(
      0,
      Math.min(playback.durationMs || Number.MAX_SAFE_INTEGER, Math.round(positionMs)),
    );
    await runOptimisticCommand(
      "seek",
      (current) => applySpotifyPlaybackCommand(current, "seek", boundedPosition),
      () => playerRef.current
        ? playerRef.current.seek(boundedPosition)
        : remoteCommand(`/me/player/seek?position_ms=${boundedPosition}`, "PUT"),
    );
  }, [playback.durationMs, remoteCommand, runOptimisticCommand]);

  const togglePlay = React.useCallback(async () => {
    const wasPaused = playbackRef.current.paused;
    await runOptimisticCommand(
      "toggle",
      (current) => applySpotifyPlaybackCommand(current, "toggle"),
      () => playerRef.current
        ? playerRef.current.togglePlay()
        : remoteCommand(wasPaused ? "/me/player/play" : "/me/player/pause", "PUT"),
    );
  }, [remoteCommand, runOptimisticCommand]);

  const nextTrack = React.useCallback(async () => {
    const predicted = queue.upcoming[0] || null;
    await runOptimisticCommand(
      "next",
      (current) => predicted
        ? { paused: false, positionMs: 0, durationMs: predicted.durationMs, track: predicted }
        : current,
      () => playerRef.current
        ? playerRef.current.nextTrack()
        : remoteCommand("/me/player/next", "POST"),
    );
    await refreshQueue().catch(() => undefined);
  }, [queue.upcoming, refreshQueue, remoteCommand, runOptimisticCommand]);

  const previousTrack = React.useCallback(async () => {
    await runOptimisticCommand(
      "previous",
      (current) => ({ ...current, positionMs: 0 }),
      () => playerRef.current
        ? playerRef.current.previousTrack()
        : remoteCommand("/me/player/previous", "POST"),
    );
    await refreshQueue().catch(() => undefined);
  }, [refreshQueue, remoteCommand, runOptimisticCommand]);

  const addToQueue = React.useCallback(async (track: SpotifyTrack) => {
    await addSpotifyTrackToQueue(
      await getAccessToken(),
      track.uri,
      deviceIdRef.current,
    );
    await refreshQueue().catch(() => undefined);
  }, [getAccessToken, refreshQueue]);

  const toggleShuffle = React.useCallback(async () => {
    if (pendingCommandKeysRef.current.has("shuffle")) return;
    const previous = shuffle;
    const next = !previous;
    pendingCommandKeysRef.current.add("shuffle");
    setPendingCommands(new Set(pendingCommandKeysRef.current));
    setShuffle(next);
    try {
      await setSpotifyShuffle(
        await getAccessToken(),
        next,
        deviceIdRef.current,
      );
    } catch (reason) {
      setShuffle(previous);
      throw reason;
    } finally {
      pendingCommandKeysRef.current.delete("shuffle");
      setPendingCommands(new Set(pendingCommandKeysRef.current));
    }
  }, [getAccessToken, shuffle]);

  return {
    status,
    error,
    account,
    remoteMode,
    playback,
    queue,
    shuffle,
    pendingCommands,
    connect,
    disconnect,
    search,
    playTrack,
    playContext,
    togglePlay,
    nextTrack,
    previousTrack,
    refreshQueue,
    addToQueue,
    toggleShuffle,
    getAccessToken,
    seek,
    setVolume: (volume: number) => playerRef.current
      ? playerRef.current.setVolume(Math.max(0, Math.min(1, volume)))
      : remoteCommand(`/me/player/volume?volume_percent=${Math.round(Math.max(0, Math.min(1, volume)) * 100)}`, "PUT"),
  };
};

export type SpotifyPlayerController = ReturnType<typeof useSpotifyPlayer>;

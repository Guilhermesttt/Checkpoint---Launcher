// @vitest-environment jsdom
import React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const player: {
    status: string;
    error: string;
    account: null;
    remoteMode: boolean;
    playback: {
      paused: boolean;
      positionMs: number;
      durationMs: number;
      track: null | {
        id: string;
        uri: string;
        title: string;
        artist: string;
        coverUrl: string;
        spotifyUrl: string;
        durationMs: number;
      };
    };
    connect: ReturnType<typeof vi.fn>;
    disconnect: ReturnType<typeof vi.fn>;
    search: ReturnType<typeof vi.fn>;
    playTrack: ReturnType<typeof vi.fn>;
    togglePlay: ReturnType<typeof vi.fn>;
    nextTrack: ReturnType<typeof vi.fn>;
    previousTrack: ReturnType<typeof vi.fn>;
    setVolume: ReturnType<typeof vi.fn>;
  } = {
    status: "disconnected",
    error: "",
    account: null,
    remoteMode: false,
    playback: { paused: true, positionMs: 0, durationMs: 0, track: null },
    connect: vi.fn(),
    disconnect: vi.fn(),
    search: vi.fn().mockResolvedValue([]),
    playTrack: vi.fn(),
    togglePlay: vi.fn(),
    nextTrack: vi.fn(),
    previousTrack: vi.fn(),
    setVolume: vi.fn(),
  };
  return {
    connect: vi.fn(),
    sendChatMessage: vi.fn().mockResolvedValue({}),
    player,
  };
});

vi.mock("../src/hooks/useSpotifyPlayer", () => ({ useSpotifyPlayer: () => mocks.player }));
vi.mock("../src/services/chat", () => ({ sendChatMessage: mocks.sendChatMessage }));

import SpotifyDock from "../src/components/spotify/SpotifyDock";

describe("SpotifyDock", () => {
  beforeEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    cleanup();
    mocks.sendChatMessage.mockClear();
    mocks.player.search.mockReset().mockResolvedValue([]);
    mocks.player.playTrack.mockReset();
    mocks.player.status = "disconnected";
    mocks.player.playback = { paused: true, positionMs: 0, durationMs: 0, track: null };
  });

  it("oferece conexao sem ocupar uma pagina do launcher", () => {
    render(<SpotifyDock friends={[]} />);
    fireEvent.click(screen.getByRole("button", { name: /abrir spotify/i }));
    fireEvent.click(screen.getByRole("button", { name: /conectar spotify/i }));
    expect(mocks.player.connect).toHaveBeenCalled();
  });

  it("mantem o dock abaixo do cabecalho sem cobrir perfil ou dicas de navegacao", () => {
    render(<SpotifyDock friends={[]} />);

    const dock = screen.getByTestId("spotify-dock");
    expect(dock.className).toContain("top-24");
    expect(dock.className).not.toContain("top-6");
    expect(dock.className).not.toContain("bottom-6");
  });

  it("sugere musica uma vez depois de um intervalo aleatorio", () => {
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(0);
    const onNotify = vi.fn();
    render(<SpotifyDock friends={[]} onNotify={onNotify} />);

    act(() => vi.advanceTimersByTime(119_999));
    expect(onNotify).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(1));
    expect(onNotify).toHaveBeenCalledWith(
      "Ei, você! Que tal uma musiquinha para elevar o teu game?",
      "info",
    );

    act(() => vi.advanceTimersByTime(240_000));
    expect(onNotify).toHaveBeenCalledTimes(1);
  });

  it("nao interrompe o usuario com sugestao quando ja existe musica tocando", () => {
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(0);
    mocks.player.status = "ready";
    mocks.player.playback = {
      paused: false,
      positionMs: 10_000,
      durationMs: 180_000,
      track: {
        id: "playing-track",
        uri: "spotify:track:playing-track",
        title: "Genesis",
        artist: "Justice",
        coverUrl: "cover.jpg",
        spotifyUrl: "https://open.spotify.com/track/playing-track",
        durationMs: 180_000,
      },
    };
    const onNotify = vi.fn();
    render(<SpotifyDock friends={[]} onNotify={onNotify} />);

    act(() => vi.advanceTimersByTime(120_000));

    expect(onNotify).not.toHaveBeenCalled();
  });

  it("mostra a faixa e convida amigos para uma Checkpoint Session", async () => {
    mocks.player.status = "ready";
    mocks.player.playback = {
      paused: false,
      positionMs: 30_000,
      durationMs: 180_000,
      track: {
        id: "track",
        uri: "spotify:track:track",
        title: "Genesis",
        artist: "Justice",
        coverUrl: "cover.jpg",
        spotifyUrl: "https://open.spotify.com/track/track",
        durationMs: 180_000,
      },
    };
    render(<SpotifyDock friends={[{ id: "cp-friend:friend-1", name: "Alex", status: "online", source: "checkpoint" }]} />);
    fireEvent.click(screen.getByRole("button", { name: /abrir spotify/i }));
    expect(screen.getAllByText("Genesis")).not.toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: /criar session/i }));
    fireEvent.click(screen.getByRole("checkbox", { name: /alex/i }));
    fireEvent.click(screen.getByRole("button", { name: /enviar convite/i }));

    await waitFor(() => expect(mocks.sendChatMessage).toHaveBeenCalledWith(
      "friend-1",
      expect.stringContaining("https://open.spotify.com/track/track"),
    ));
  });

  it("mostra no dock quando o Spotify nao consegue iniciar a faixa", async () => {
    const resultTrack = {
      id: "track-error",
      uri: "spotify:track:track-error",
      title: "Stress",
      artist: "Justice",
      coverUrl: "cover.jpg",
      spotifyUrl: "https://open.spotify.com/track/track-error",
      durationMs: 220_000,
    };
    mocks.player.status = "ready";
    mocks.player.search.mockResolvedValue([resultTrack]);
    mocks.player.playTrack.mockRejectedValue(new Error("Abra o Spotify em outro dispositivo."));
    const onNotify = vi.fn();
    render(<SpotifyDock friends={[]} onNotify={onNotify} />);
    fireEvent.click(screen.getByRole("button", { name: /abrir spotify/i }));
    fireEvent.change(screen.getByPlaceholderText(/buscar música ou artista/i), {
      target: { value: "Stress" },
    });
    fireEvent.click(screen.getByRole("button", { name: /buscar no spotify/i }));
    await screen.findByText("Stress");

    fireEvent.click(screen.getByText("Stress"));

    await waitFor(() => expect(onNotify).toHaveBeenCalledWith(
      "Abra o Spotify em outro dispositivo.",
      "error",
    ));
  });
});

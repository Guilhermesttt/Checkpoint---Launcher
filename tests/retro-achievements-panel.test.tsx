// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { getRetroAchievementProgress } = vi.hoisted(() => ({
  getRetroAchievementProgress: vi.fn(),
}));

vi.mock("../src/services/retroAchievements", async () => {
  const actual = await vi.importActual<typeof import("../src/services/retroAchievements")>("../src/services/retroAchievements");
  return { ...actual, getRetroAchievementProgress };
});

import { RetroAchievementsPanel } from "../src/features/retro/components/RetroAchievementsPanel";

const game = {
  id: "gow",
  title: "God of War",
  subtitle: "EDIÇÃO CLÁSSICA",
  year: 2005,
  console: "PS2",
  publisher: "SONY",
  accent: "#b52322",
  retroAchievementsGameId: 2782,
};

describe("RetroAchievementsPanel", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("shows personal normal and hardcore progress with accessible badges", async () => {
    getRetroAchievementProgress.mockResolvedValue({
      game: { id: 2782, title: "God of War", consoleName: "PlayStation 2" },
      summary: {
        total: 12,
        normalUnlocked: 4,
        hardcoreUnlocked: 4,
        normalPercent: 33,
        hardcorePercent: 33,
        userTotalPlaytime: 90,
        highestAwardKind: "mastered",
        highestAwardDate: "2026-08-10T12:00:00Z",
      },
      achievements: [{
        id: 1,
        title: "That Was Easy",
        description: "Defeat the Hydra",
        points: 10,
        badgeUrl: "https://media.retroachievements.org/Badge/1.png",
        displayOrder: 1,
        unlocked: true,
        unlockedHardcore: true,
        dateEarned: "2026-08-09T12:00:00Z",
        dateEarnedHardcore: "2026-08-10T12:00:00Z",
      }],
      source: "fresh",
    });

    render(<RetroAchievementsPanel game={game} accountLinked onEditGame={vi.fn()} />);

    expect(await screen.findByText("4 / 12")).toBeInTheDocument();
    expect(screen.getByText("Hardcore 33%")).toBeInTheDocument();
    expect(screen.getByText("Masterizado")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "That Was Easy desbloqueada" })).toHaveAttribute("src", expect.stringContaining("Badge"));
    expect(screen.getByText("10 pts")).toBeInTheDocument();
  });

  it("routes missing account and missing game links to their supplied actions", () => {
    const onOpenSettingsConnections = vi.fn();
    const onEditGame = vi.fn();
    const { rerender } = render(
      <RetroAchievementsPanel game={game} accountLinked={false} onEditGame={onEditGame} onOpenSettingsConnections={onOpenSettingsConnections} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Vincular conta RetroAchievements" }));
    expect(onOpenSettingsConnections).toHaveBeenCalledTimes(1);

    rerender(<RetroAchievementsPanel game={{ ...game, retroAchievementsGameId: undefined }} accountLinked onEditGame={onEditGame} />);
    fireEvent.click(screen.getByRole("button", { name: "Vincular God of War ao RetroAchievements" }));
    expect(onEditGame).toHaveBeenCalledWith(expect.objectContaining({ id: "gow" }));
  });

  it("shows stale cache and retries a safe request error", async () => {
    getRetroAchievementProgress
      .mockRejectedValueOnce(new Error("Serviço temporariamente indisponível."))
      .mockResolvedValueOnce({
        game: { id: 2782, title: "God of War", consoleName: "PlayStation 2" },
        summary: { total: 0, normalUnlocked: 0, hardcoreUnlocked: 0, normalPercent: 0, hardcorePercent: 0, userTotalPlaytime: 0 },
        achievements: [],
        source: "stale",
      });

    render(<RetroAchievementsPanel game={game} accountLinked onEditGame={vi.fn()} />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Serviço temporariamente indisponível.");
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));

    await waitFor(() => expect(screen.getByText("Dados em cache")).toBeInTheDocument());
    expect(screen.getByText("Nenhuma conquista disponível para este jogo.")).toBeInTheDocument();
  });
});

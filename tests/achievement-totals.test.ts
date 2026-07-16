import { describe, expect, it } from "vitest";
import { calculateAchievementTotals } from "../src/utils/achievementTotals";
import type { Game } from "../src/types/domain";

const game = (id: string, total: number, unlocked: number): Game => ({
  id,
  title: id,
  image: "",
  totalAchievements: total,
  completedAchievements: unlocked,
});

describe("totais de conquistas do perfil", () => {
  it("soma todos os jogos sem limite de quantidade", () => {
    const games = Array.from({ length: 120 }, (_, index) => game(String(index), 10, 2));
    expect(calculateAchievementTotals(games)).toEqual({
      unlocked: 240,
      available: 1200,
      gamesWithAchievements: 120,
    });
  });

  it("nunca mostra menos conquistas disponiveis do que desbloqueadas", () => {
    expect(calculateAchievementTotals([game("local", 0, 4)])).toEqual({
      unlocked: 4,
      available: 4,
      gamesWithAchievements: 1,
    });
  });
});

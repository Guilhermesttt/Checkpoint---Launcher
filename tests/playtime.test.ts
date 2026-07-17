import { describe, expect, it } from "vitest";
import {
  calculateTotalPlayedMinutes,
  formatPlayedHours,
  getGamePlayedMinutes,
} from "../src/utils/playtime";
import type { Game } from "../src/types/domain";

const game = (id: string, values: Partial<Game>): Game => ({
  id,
  title: id,
  image: "",
  ...values,
});

describe("formatacao de tempo jogado", () => {
  it("soma em minutos inteiros sem expor imprecisao de ponto flutuante", () => {
    const games = [
      game("a", { hoursPlayed: 2100.1 }),
      game("b", { hoursPlayed: 9.1 }),
    ];

    const totalMinutes = calculateTotalPlayedMinutes(games);
    expect(totalMinutes).toBe(126_552);
    expect(formatPlayedHours(totalMinutes / 60)).toBe("2.109,2");
  });

  it("usa a maior fonte de tempo conhecida para cada jogo", () => {
    expect(getGamePlayedMinutes(game("steam", {
      hoursPlayed: 1,
      locallyTrackedMinutes: 90,
      steamPlaytimeMinutes: 125,
    }))).toBe(125);
  });

  it("mostra no maximo uma casa decimal", () => {
    expect(formatPlayedHours(10)).toBe("10");
    expect(formatPlayedHours(10.26)).toBe("10,3");
    expect(formatPlayedHours(Number.NaN)).toBe("0");
  });
});

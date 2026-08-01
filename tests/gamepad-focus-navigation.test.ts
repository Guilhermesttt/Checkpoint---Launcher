import { describe, expect, it } from "vitest";
import { rankSpatialCandidates } from "../src/utils/spatialFocus";

const rect = (left: number, top: number, width = 100, height = 40) => ({
  left,
  right: left + width,
  top,
  bottom: top + height,
  width,
  height,
});

describe("navegacao espacial do controle", () => {
  it("prioriza o controle alinhado abaixo em vez de um diagonal mais proximo", () => {
    const current = rect(0, 0);
    const diagonal = { id: "diagonal", rect: rect(150, 45) };
    const aligned = { id: "aligned", rect: rect(0, 90) };

    expect(rankSpatialCandidates(current, [diagonal, aligned], "down")[0]?.id).toBe("aligned");
  });

  it("mantem ordem estavel quando os candidatos tem a mesma geometria", () => {
    const current = rect(0, 0);
    const candidates = [
      { id: "first", rect: rect(0, 80) },
      { id: "second", rect: rect(0, 80) },
    ];

    expect(rankSpatialCandidates(current, candidates, "down").map(({ id }) => id)).toEqual([
      "first",
      "second",
    ]);
  });
});

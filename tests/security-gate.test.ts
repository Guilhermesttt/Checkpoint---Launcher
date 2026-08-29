import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { CONTROLS } from "../scripts/security-gate.cjs";

describe("security-gate", () => {
  it("defines all 20 required security release controls", () => {
    expect(CONTROLS).toHaveLength(20);
    const ids = CONTROLS.map((c: any) => c.id);
    for (let i = 1; i <= 20; i++) {
      expect(ids).toContain(i);
    }
  });

  it("checks that package.json has security:gate script configured", () => {
    const pkg = JSON.parse(
      fs.readFileSync(path.resolve("package.json"), "utf8"),
    );
    expect(pkg.scripts["security:gate"]).toBe("node scripts/security-gate.cjs");
    expect(pkg.scripts["security:secrets"]).toBe("node scripts/scan-secrets.cjs");
  });
});

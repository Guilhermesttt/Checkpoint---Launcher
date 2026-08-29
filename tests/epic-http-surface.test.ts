import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("epic-http-surface", () => {
  const serverSource = fs.readFileSync(path.resolve("server/index.mjs"), "utf8");
  const packageJson = JSON.parse(fs.readFileSync(path.resolve("package.json"), "utf8"));

  it("does not expose private Epic credential routes on the HTTP server", () => {
    const forbiddenRoutes = [
      "/api/epic/auth",
      "/api/epic/library",
      "/api/epic/token",
      "/api/epic/status",
      "/api/epic/logout",
      "/api/epic/achievements",
    ];

    for (const route of forbiddenRoutes) {
      expect(serverSource).not.toContain(`"${route}"`);
      expect(serverSource).not.toContain(`'${route}'`);
    }
  });

  it("does not import legacy server/legendary.mjs", () => {
    expect(serverSource).not.toContain('from "./legendary.mjs"');
    expect(serverSource).not.toContain("from './legendary.mjs'");
    expect(fs.existsSync(path.resolve("server/legendary.mjs"))).toBe(false);
  });

  it("excludes bin directory from electron-builder packaged files", () => {
    const files = packageJson.build?.files || [];
    expect(files).not.toContain("bin/**/*");
    expect(files).not.toContain("bin/**");
  });

  it("keeps only public catalog routes", () => {
    expect(serverSource).toContain('"/api/epic/search"');
    expect(serverSource).toContain('"/api/epic/app-details"');
  });
});

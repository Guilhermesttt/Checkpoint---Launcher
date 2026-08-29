import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("content-security-policy", () => {
  const indexHtml = fs.readFileSync(path.resolve("index.html"), "utf8");
  const serverSource = fs.readFileSync(path.resolve("server/index.mjs"), "utf8");

  it("declares strict CSP meta tag in index.html for packaged desktop renderer", () => {
    expect(indexHtml).toContain('http-equiv="Content-Security-Policy"');
    expect(indexHtml).toContain("default-src 'self'");
    expect(indexHtml).toContain("script-src 'self'");
    expect(indexHtml).toContain("style-src 'self' 'unsafe-inline'");
    expect(indexHtml).toContain("object-src 'none'");
    expect(indexHtml).toContain("frame-src 'none'");
    expect(indexHtml).toContain("frame-ancestors 'none'");
    expect(indexHtml).not.toContain("'unsafe-eval'");
  });

  it("ensures express server is API-only without serving desktop SPA statically or via wildcard", () => {
    expect(serverSource).not.toContain('express.static(path.join(__dirname, "../dist"))');
    expect(serverSource).not.toContain('app.get("/{*path}"');
    expect(serverSource).toContain('res.status(404).json({ error: "Rota nao encontrada." })');
  });

  it("configures strict Helmet CSP headers on server without unsafe-inline in script-src", () => {
    expect(serverSource).toContain("helmet({");
    expect(serverSource).toContain('scriptSrc: ["\'self\'"]');
    expect(serverSource).toContain('objectSrc: ["\'none\'"]');
    expect(serverSource).toContain('baseUri: ["\'none\'"]');
    expect(serverSource).toContain('frameAncestors: ["\'none\'"]');
  });
});

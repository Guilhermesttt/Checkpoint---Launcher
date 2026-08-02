import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("tipografia do overlay", () => {
  it("empacota Inter e Unbounded localmente com CSP restrita", () => {
    const html = readFileSync(
      path.join(process.cwd(), "electron", "overlay.html"),
      "utf8",
    );

    expect(html).toContain("@fontsource-variable/inter/files/inter-latin-ext-wght-normal.woff2");
    expect(html).toContain("@fontsource-variable/unbounded/files/unbounded-latin-ext-wght-normal.woff2");
    expect(html).toContain("style-src 'unsafe-inline'; font-src 'self'");
    expect(html).not.toContain("fonts.googleapis.com");
    expect(html).toContain('--overlay-font-display: "Unbounded"');
    expect(html).toContain('--overlay-font-body: "Inter"');
    expect(html).toContain("font-family: var(--overlay-font-display);");
  });
});

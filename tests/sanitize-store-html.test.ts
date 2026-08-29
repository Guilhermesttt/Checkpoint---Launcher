// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { sanitizeStoreHtml } from "../src/utils/sanitizeStoreHtml";

describe("sanitizeStoreHtml", () => {
  it("removes dangerous tags, handlers, and disallowed attributes", () => {
    expect(
      sanitizeStoreHtml('<img src=x onerror="alert(1)"><p style="color:red">Safe</p>'),
    ).toBe("<p>Safe</p>");

    expect(
      sanitizeStoreHtml('<svg><script>alert(1)</script></svg><a href="javascript:alert(1)">x</a>'),
    ).toBe("x");

    expect(
      sanitizeStoreHtml('<iframe src="https://evil.com"></iframe><script>evil()</script><b>Bold</b>'),
    ).toBe("<b>Bold</b>");
  });

  it("handles null, undefined, and non-string inputs safely", () => {
    expect(sanitizeStoreHtml(null)).toBe("");
    expect(sanitizeStoreHtml(undefined)).toBe("");
    expect(sanitizeStoreHtml(123)).toBe("");
    expect(sanitizeStoreHtml({})).toBe("");
  });

  it("ensures GameDetailPanel uses sanitizeStoreHtml for dangerouslySetInnerHTML", () => {
    const detailPanelSource = fs.readFileSync(
      path.resolve("src/components/GameDetailPanel.tsx"),
      "utf8",
    );
    const matches = detailPanelSource.match(/dangerouslySetInnerHTML=\{\s*\{\s*__html:\s*([^}]+)\s*\}\s*\}/g);
    expect(matches).not.toBeNull();
    for (const match of matches || []) {
      // Must not directly use steamAppDetails.* without sanitizeStoreHtml or sanitized memo
      expect(match).not.toMatch(/steamAppDetails\./);
    }
  });
});

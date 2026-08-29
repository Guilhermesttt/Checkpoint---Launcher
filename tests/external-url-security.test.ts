import { describe, expect, it } from "vitest";
import { assertAllowedExternalUrl } from "../server/security-boundaries.mjs";

describe("external-url-security", () => {
  it("rejects non-allowlisted protocols and malicious inputs", () => {
    const maliciousUrls = [
      "javascript:alert(document.cookie)",
      "vbscript:msgbox(1)",
      "data:text/html,<script>alert(1)</script>",
      "file://C:/Windows/System32/calc.exe",
      "\\\\malicious-share\\evil.exe",
      "ftp://example.com/file",
      "https://user:pass@legit-site.com",
      "https://evil.com/\u0000payload",
    ];

    for (const url of maliciousUrls) {
      expect(() => assertAllowedExternalUrl(url)).toThrow();
    }
  });

  it("accepts valid https, steam, epic, and checkpoint protocol URLs", () => {
    const validUrls = [
      "https://store.steampowered.com/app/10",
      "https://store.epicgames.com/en-US/p/game",
      "https://discord.com/oauth2/authorize?client_id=123",
      "steam://rungameid/570",
      "com.epicgames.launcher://apps/Sugar?action=launch",
      "checkpoint://auth/callback?token=test",
      "nxm://skyrim/mods/123/files/456",
    ];

    for (const url of validUrls) {
      expect(typeof assertAllowedExternalUrl(url)).toBe("string");
    }
  });
});

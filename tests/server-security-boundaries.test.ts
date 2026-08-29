import { describe, expect, it } from "vitest";
import {
  normalizeSafeError,
  validateHttpsUrl,
  assertAllowedExternalUrl,
} from "../server/security-boundaries.mjs";

describe("server-security-boundaries", () => {
  it("normalizes errors to remove paths, secrets, and internal details", () => {
    const sensitiveError = new Error("token=secret_12345 path=C:\\Users\\Alice\\database.sqlite");
    expect(normalizeSafeError(sensitiveError)).toEqual({
      error: "Falha ao processar a solicitacao.",
    });
  });

  it("validates https URLs and rejects credentials or insecure protocols in production", () => {
    expect(() => validateHttpsUrl("http://example.com", { production: true })).toThrow("HTTPS obrigatorio.");
    expect(() => validateHttpsUrl("https://user:pass@example.com")).toThrow("Credenciais na URL nao permitidas.");
    expect(validateHttpsUrl("https://api.steampowered.com/test", { production: true })).toBe("https://api.steampowered.com/test");
  });

  it("validates external URLs allowing only safe protocols and rejecting dangerous schemes", () => {
    expect(assertAllowedExternalUrl("https://google.com")).toBe("https://google.com/");
    expect(assertAllowedExternalUrl("steam://rungameid/730")).toBe("steam://rungameid/730");
    expect(assertAllowedExternalUrl("com.epicgames.launcher://apps/cat-id")).toBe("com.epicgames.launcher://apps/cat-id");

    expect(() => assertAllowedExternalUrl("javascript:alert(1)")).toThrow();
    expect(() => assertAllowedExternalUrl("data:text/html,evil")).toThrow();
    expect(() => assertAllowedExternalUrl("file:///C:/Windows/System32/cmd.exe")).toThrow();
    expect(() => assertAllowedExternalUrl("http://example.com\x00extra")).toThrow();
  });
});

import { describe, expect, it } from "vitest";
import {
  renderTrophyUnlockEmail,
  normalizeLocale,
  escape,
  type TrophyUnlockInput,
  type TrophyTier,
} from "../supabase/functions/_shared/email-template";

const baseInput: TrophyUnlockInput = {
  trophyTitle: "Primeira Platina",
  trophyDescription: "Platine seu primeiro jogo.",
  tier: "platinum",
  xp: 300,
  unlockedAtIso: "2026-08-31T12:00:00.000Z",
  playerName: "Tester",
  trophyPageUrl: "https://checkpointlauncher.com/trophies",
  level: 21,
  totalXp: 915,
};

describe("email-template: trophy unlock", () => {
  describe("normalizeLocale", () => {
    it("accepts supported locales verbatim", () => {
      expect(normalizeLocale("pt-BR")).toBe("pt-BR");
      expect(normalizeLocale("en")).toBe("en");
      expect(normalizeLocale("es")).toBe("es");
    });
    it("falls back to en for unknown or missing values", () => {
      expect(normalizeLocale("de")).toBe("en");
      expect(normalizeLocale("")).toBe("en");
      expect(normalizeLocale(null)).toBe("en");
      expect(normalizeLocale(undefined)).toBe("en");
    });
  });

  describe("escape", () => {
    it("neutralizes HTML and quote characters", () => {
      expect(escape(`<script>alert("x")</script>`)).toBe(
        "&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;",
      );
    });
    it("strips CR/LF to block header injection", () => {
      expect(escape("a\nb\r\nc")).toBe("a b c");
    });
  });

  describe("renderTrophyUnlockEmail", () => {
    it("returns a subject, text body, and HTML body", () => {
      const out = renderTrophyUnlockEmail(baseInput, "pt-BR");
      expect(out.subject).toMatch(/Platina/);
      expect(out.text).toContain("Tester");
      expect(out.text).toContain("+300 XP");
      expect(out.html).toContain("<!doctype html>");
      // pt-BR copy localizes the tier label: "platinum" -> "Platina"
      expect(out.html).toContain("Platina");
    });

    it("uses pt-BR copy by default", () => {
      const out = renderTrophyUnlockEmail(baseInput, "pt-BR");
      expect(out.subject).toContain("Platina");
      expect(out.text).toContain("Olá");
    });

    it("falls back to en for unknown locale", () => {
      const out = renderTrophyUnlockEmail(baseInput, "de");
      expect(out.subject).toContain("Platinum");
      expect(out.text).toContain("Hi Tester");
    });

    it("uses en copy when locale is en", () => {
      const out = renderTrophyUnlockEmail(baseInput, "en");
      expect(out.text).toContain("Hi Tester");
      expect(out.text).toContain("+300 XP");
    });

    it("uses es copy when locale is es", () => {
      const out = renderTrophyUnlockEmail(baseInput, "es");
      expect(out.subject).toContain("Platino");
      expect(out.text).toContain("¡Hola");
    });

    it("applies the tier palette to the HTML body", () => {
      for (const [tier, hex] of [
        ["platinum", "#38bdf8"],
        ["gold", "#fbbf24"],
        ["silver", "#f1f5f9"],
        ["bronze", "#cd7f32"],
      ] as Array<[TrophyTier, string]>) {
        const out = renderTrophyUnlockEmail({ ...baseInput, tier }, "en");
        expect(out.html).toContain(hex);
        expect(out.subject.toLowerCase()).toContain(tier);
      }
    });

    it("falls back to bronze when an unknown tier is passed", () => {
      const out = renderTrophyUnlockEmail(
        { ...baseInput, tier: "mythic" as unknown as TrophyTier },
        "en",
      );
      // subject uses the tier label, so Bronze should appear.
      expect(out.subject).toContain("Bronze");
    });

    it("escapes player-controlled fields to block injection", () => {
      const evil: TrophyUnlockInput = {
        ...baseInput,
        trophyTitle: `Evil<script>alert(1)</script>`,
        trophyDescription: `Desc\nBcc: attacker@example.com`,
        playerName: `Hacker<img src=x>`,
        trophyPageUrl: `https://x.com?a=b&c=<d>`,
      };
      const out = renderTrophyUnlockEmail(evil, "en");
      // No raw <script> or <img tags must remain in the HTML.
      expect(out.html).not.toMatch(/<script>/i);
      expect(out.html).not.toMatch(/<img /i);
      // And the CRLF in description must not have leaked into the headers.
      expect(out.subject).not.toMatch(/Bcc:/i);
    });

    it("renders a working trophy page CTA URL in the plain body", () => {
      const out = renderTrophyUnlockEmail(baseInput, "pt-BR");
      expect(out.text).toContain("https://checkpointlauncher.com/trophies");
    });

    it("uses the iconUrl when provided", () => {
      const out = renderTrophyUnlockEmail(
        { ...baseInput, iconUrl: "https://cdn.example/trophy.png" },
        "en",
      );
      expect(out.html).toContain("https://cdn.example/trophy.png");
    });
  });
});

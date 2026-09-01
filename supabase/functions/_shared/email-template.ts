// supabase/functions/_shared/email-template.ts
// Pure, dependency-free renderer for trophy-unlock emails. Returns both the
// plain-text and the HTML body so Resend can fan out either or both.
//
// Conventions:
// - Tier visuals mirror src/utils/trophyTiers.ts (Phelierium palette).
// - Locale fallback is "en" if the user-supplied locale is not supported.
// - Output is sanitized through a small escape() to prevent HTML/email-header
//   injection. Always pipe user-controlled strings through escape() first.
//
// This file is intentionally runtime-agnostic (no Deno / Node imports) so it
// can be unit-tested under Vitest (see tests/email-template.test.ts).

export type TrophyTier = "platinum" | "gold" | "silver" | "bronze";
export type SupportedLocale = "pt-BR" | "en" | "es";

export interface TrophyUnlockInput {
  trophyTitle: string;
  trophyDescription: string;
  tier: TrophyTier;
  xp: number;
  unlockedAtIso: string;
  /** Display name of the player (already resolved server-side, not from the body). */
  playerName: string;
  /** Optional URL to the trophy icon. Falls back to a CSS gradient if absent. */
  iconUrl?: string;
  /** Absolute link to the trophy page in the launcher. */
  trophyPageUrl: string;
  /** Current level/XP, used in the body footer. Optional. */
  level?: number;
  totalXp?: number;
}

export interface RenderedEmail {
  subject: string;
  text: string;
  html: string;
  // Resend sends a single content tree; we expose both so the caller decides.
}

const TIER_PALETTE: Record<TrophyTier, { hex: string }> = {
  platinum: { hex: "#38bdf8" },
  gold:     { hex: "#fbbf24" },
  silver:   { hex: "#f1f5f9" },
  bronze:   { hex: "#cd7f32" },
};

const TIER_LABEL: Record<SupportedLocale, Record<TrophyTier, string>> = {
  "pt-BR": { platinum: "Platina", gold: "Ouro",   silver: "Prata",   bronze: "Bronze" },
  en:      { platinum: "Platinum", gold: "Gold",   silver: "Silver",  bronze: "Bronze" },
  es:      { platinum: "Platino", gold: "Oro",    silver: "Plata",   bronze: "Bronce" },
};

const SUPPORTED: ReadonlyArray<SupportedLocale> = ["pt-BR", "en", "es"];

export function normalizeLocale(input: string | null | undefined): SupportedLocale {
  if (input && (SUPPORTED as readonly string[]).includes(input)) {
    return input as SupportedLocale;
  }
  return "en";
}

interface Copy {
  subject: (tierLabel: string) => string;
  greeting: (name: string) => string;
  intro: (tierLabel: string) => string;
  bodyParagraph: (title: string, description: string) => string;
  xpLine: (xp: number) => string;
  cta: string;
  footer: (appName: string) => string;
}

const COPY: Record<SupportedLocale, Copy> = {
  "pt-BR": {
    subject: (tierLabel) => `Novo troféu ${tierLabel} desbloqueado!`,
    greeting: (name) => `Olá, ${name}!`,
    intro: (tierLabel) => `Você acabou de desbloquear um troféu ${tierLabel}.`,
    bodyParagraph: (title, description) => `${title}\n${description}`,
    xpLine: (xp) => `+${xp} XP adicionados à sua conta.`,
    cta: "Ver troféu no launcher",
    footer: (appName) => `${appName} — Troféu enviado automaticamente. Para parar de receber emails, ajuste em Configurações → Notificações.`,
  },
  en: {
    subject: (tierLabel) => `New ${tierLabel} trophy unlocked!`,
    greeting: (name) => `Hi ${name}!`,
    intro: (tierLabel) => `You just unlocked a ${tierLabel} trophy.`,
    bodyParagraph: (title, description) => `${title}\n${description}`,
    xpLine: (xp) => `+${xp} XP added to your account.`,
    cta: "View trophy in the launcher",
    footer: (appName) => `${appName} — This is an automated trophy email. To stop receiving emails, go to Settings → Notifications.`,
  },
  es: {
    subject: (tierLabel) => `¡Nuevo trofeo ${tierLabel} desbloqueado!`,
    greeting: (name) => `¡Hola, ${name}!`,
    intro: (tierLabel) => `Acabas de desbloquear un trofeo ${tierLabel}.`,
    bodyParagraph: (title, description) => `${title}\n${description}`,
    xpLine: (xp) => `+${xp} XP añadidos a tu cuenta.`,
    cta: "Ver trofeo en el launcher",
    footer: (appName) => `${appName} — Correo automático de trofeo. Para dejar de recibirlos, ve a Configuración → Notificaciones.`,
  },
};

const APP_NAME = "Phelierium";

/**
 * Escape characters that have meaning in HTML or in RFC 5322 headers.
 * Mirrors the small library used by the renderer to keep the function pure.
 */
export function escape(input: string): string {
  return String(input)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    // Strip CR/LF so an attacker cannot inject additional headers.
    .replace(/[\r\n]+/g, " ");
}

function renderText(input: TrophyUnlockInput, copy: Copy, tierLabel: string): string {
  const lines: string[] = [
    copy.greeting(input.playerName),
    "",
    copy.intro(tierLabel),
    "",
    copy.bodyParagraph(input.trophyTitle, input.trophyDescription),
    "",
    copy.xpLine(input.xp),
  ];
  if (typeof input.level === "number" && typeof input.totalXp === "number") {
    lines.push(`Level ${input.level} · ${input.totalXp} XP total.`);
  }
  lines.push("");
  lines.push(`${copy.cta}: ${input.trophyPageUrl}`);
  lines.push("");
  lines.push(copy.footer(APP_NAME));
  return lines.join("\n");
}

function renderHtml(input: TrophyUnlockInput, copy: Copy, tierLabel: string): string {
  const tier = TIER_PALETTE[input.tier];
  const titleHtml = `<h1 style="margin:0 0 8px;font-size:22px;color:${tier.hex};font-family:system-ui,Segoe UI,Roboto,sans-serif;">${escape(input.trophyTitle)}</h1>`;
  const descHtml = `<p style="margin:0 0 16px;font-size:15px;color:#cbd5e1;font-family:system-ui,Segoe UI,Roboto,sans-serif;">${escape(input.trophyDescription)}</p>`;
  const xpHtml = `<p style="margin:0 0 16px;font-size:15px;color:#e2e8f0;font-family:system-ui,Segoe UI,Roboto,sans-serif;"><strong>+${input.xp} XP</strong></p>`;
  const iconHtml = input.iconUrl
    ? `<img src="${escape(input.iconUrl)}" alt="" width="64" height="64" style="display:block;margin:0 auto 16px;border-radius:8px;" />`
    : `<div aria-hidden="true" style="width:64px;height:64px;margin:0 auto 16px;border-radius:8px;background:linear-gradient(135deg,${tier.hex},#0f172a);"></div>`;
  const ctaHtml = `<a href="${escape(input.trophyPageUrl)}" style="display:inline-block;padding:10px 18px;border-radius:8px;background:${tier.hex};color:#0f172a;font-weight:600;text-decoration:none;font-family:system-ui,Segoe UI,Roboto,sans-serif;">${escape(copy.cta)}</a>`;
  const levelHtml = (typeof input.level === "number" && typeof input.totalXp === "number")
    ? `<p style="margin:16px 0 0;font-size:13px;color:#94a3b8;font-family:system-ui,Segoe UI,Roboto,sans-serif;">${escape(`Level ${input.level} · ${input.totalXp} XP total`)}</p>`
    : "";

  return `<!doctype html>
<html lang="en">
  <body style="margin:0;padding:0;background:#0f172a;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;padding:32px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background:#1e293b;border-radius:12px;padding:32px;">
            <tr>
              <td>
                <p style="margin:0 0 16px;font-size:13px;letter-spacing:0.08em;text-transform:uppercase;color:${tier.hex};font-family:system-ui,Segoe UI,Roboto,sans-serif;">${escape(tierLabel)}</p>
                ${iconHtml}
                ${titleHtml}
                ${descHtml}
                ${xpHtml}
                <p style="margin:0 0 24px;">${ctaHtml}</p>
                ${levelHtml}
                <hr style="border:none;border-top:1px solid #334155;margin:24px 0;" />
                <p style="margin:0;font-size:12px;color:#64748b;font-family:system-ui,Segoe UI,Roboto,sans-serif;">${escape(copy.footer(APP_NAME))}</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export function renderTrophyUnlockEmail(
  rawInput: TrophyUnlockInput,
  rawLocale: string | null | undefined,
): RenderedEmail {
  const locale = normalizeLocale(rawLocale);
  const copy = COPY[locale];
  const tier: TrophyTier = (["platinum", "gold", "silver", "bronze"] as TrophyTier[]).includes(rawInput.tier)
    ? rawInput.tier
    : "bronze";
  const tierLabel = TIER_LABEL[locale][tier];
  const input: TrophyUnlockInput = { ...rawInput, tier };

  return {
    subject: copy.subject(tierLabel),
    text: renderText(input, copy, tierLabel),
    html: renderHtml(input, copy, tierLabel),
  };
}

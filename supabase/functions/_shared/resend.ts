// supabase/functions/_shared/resend.ts
// Minimal Resend client. The Resend REST API is one POST to /emails with an
// Authorization header. We keep the surface small and dependency-free so the
// Edge Function can run on Deno without bundler gymnastics.
//
// Reference: https://resend.com/docs/api-reference/emails/send-email

export interface ResendEmailRequest {
  from: string;
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
  // Resend supports reply_to / cc / bcc / tags; we don't need them for v1.
  reply_to?: string;
  tags?: { name: string; value: string }[];
}

export interface ResendSendResult {
  ok: boolean;
  id?: string;
  status: number;
  error?: string;
}

export interface ResendClient {
  send: (req: ResendEmailRequest) => Promise<ResendSendResult>;
}

export interface ResendClientOptions {
  apiKey: string;
  /** Override for tests. Defaults to the production Resend API. */
  endpoint?: string;
  /** Override for tests. */
  fetchImpl?: typeof fetch;
}

const DEFAULT_ENDPOINT = "https://api.resend.com/emails";

export function createResendClient(opts: ResendClientOptions): ResendClient {
  if (!opts.apiKey) {
    throw new Error("Resend API key is required");
  }
  const endpoint = opts.endpoint || DEFAULT_ENDPOINT;
  const f = opts.fetchImpl || fetch;

  return {
    async send(req: ResendEmailRequest): Promise<ResendSendResult> {
      const recipients = Array.isArray(req.to) ? req.to : [req.to];
      if (recipients.length === 0) {
        return { ok: false, status: 0, error: "no recipients" };
      }
      if (!req.text && !req.html) {
        return { ok: false, status: 0, error: "either text or html is required" };
      }

      const body = {
        from: req.from,
        to: recipients,
        subject: req.subject,
        text: req.text,
        html: req.html,
        reply_to: req.reply_to,
        tags: req.tags,
      };

      let res: Response;
      try {
        res = await f(endpoint, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${opts.apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        });
      } catch (err) {
        return {
          ok: false,
          status: 0,
          error: `network error: ${(err as Error).message || "unknown"}`,
        };
      }

      let parsed: { id?: string; message?: string; error?: string } = {};
      try {
        parsed = (await res.json()) as typeof parsed;
      } catch {
        // ignore parse errors; res.ok is the source of truth
      }

      if (res.ok) {
        return { ok: true, id: parsed.id, status: res.status };
      }
      return {
        ok: false,
        status: res.status,
        error: parsed.error || parsed.message || `HTTP ${res.status}`,
      };
    },
  };
}

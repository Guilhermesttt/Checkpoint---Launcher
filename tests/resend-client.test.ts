import { describe, expect, it, vi } from "vitest";
import { createResendClient } from "../supabase/functions/_shared/resend";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("resend client", () => {
  it("rejects construction without an API key", () => {
    expect(() => createResendClient({ apiKey: "" })).toThrow(/api key/i);
  });

  it("sends a POST to /emails with bearer auth and JSON body", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, { id: "abc123" }));
    const client = createResendClient({ apiKey: "re_test_xxx", fetchImpl });

    const res = await client.send({
      from: "Phelierium <noreply@phelierium.app>",
      to: "tester@example.com",
      subject: "Hi",
      text: "body",
    });

    expect(res.ok).toBe(true);
    expect(res.id).toBe("abc123");
    expect(res.status).toBe(200);

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe("https://api.resend.com/emails");
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe("Bearer re_test_xxx");
    const body = JSON.parse(init.body);
    expect(body.from).toContain("Phelierium");
    expect(body.to).toEqual(["tester@example.com"]);
    expect(body.subject).toBe("Hi");
  });

  it("rejects empty recipient list without calling fetch", async () => {
    const fetchImpl = vi.fn();
    const client = createResendClient({ apiKey: "re_x", fetchImpl });
    const res = await client.send({ from: "x@y", to: [], subject: "s" });
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/recipient/i);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("rejects calls without text or html", async () => {
    const client = createResendClient({ apiKey: "re_x", fetchImpl: vi.fn() });
    const res = await client.send({ from: "x@y", to: "a@b", subject: "s" });
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/text or html/i);
  });

  it("returns an error result when the API responds 4xx", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(422, { error: "Invalid recipient" }));
    const client = createResendClient({ apiKey: "re_x", fetchImpl });
    const res = await client.send({ from: "x@y", to: "bad", subject: "s", text: "t" });
    expect(res.ok).toBe(false);
    expect(res.status).toBe(422);
    expect(res.error).toBe("Invalid recipient");
  });

  it("captures network failures", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error("socket hang up"));
    const client = createResendClient({ apiKey: "re_x", fetchImpl });
    const res = await client.send({ from: "x@y", to: "a@b", subject: "s", text: "t" });
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/network/i);
    expect(res.error).toMatch(/socket hang up/);
  });

  it("honors a custom endpoint (for tests / staging)", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, { id: "x" }));
    const client = createResendClient({
      apiKey: "re_x",
      endpoint: "https://resend.test.local/emails",
      fetchImpl,
    });
    await client.send({ from: "x@y", to: "a@b", subject: "s", text: "t" });
    expect(fetchImpl.mock.calls[0][0]).toBe("https://resend.test.local/emails");
  });

  it("falls back to the global fetch when no fetchImpl is supplied", async () => {
    const original = globalThis.fetch;
    const stub = vi.fn().mockResolvedValue(jsonResponse(200, { id: "global" }));
    globalThis.fetch = stub as unknown as typeof fetch;
    let client: ReturnType<typeof createResendClient> | undefined;
    try {
      // Construct AFTER assigning globalThis.fetch so the capture binds to
      // our stub. createResendClient snapshots `fetch` at call time.
      client = createResendClient({ apiKey: "re_x" });
      const res = await client.send({ from: "x@y", to: "a@b", subject: "s", text: "t" });
      expect(res.ok).toBe(true);
      expect(stub).toHaveBeenCalledTimes(1);
    } finally {
      globalThis.fetch = original;
    }
    expect(client).toBeDefined();
  });

  it("reports 'unknown' when the network error has no message", async () => {
    const fetchImpl = vi.fn().mockRejectedValue({}); // no .message
    const client = createResendClient({ apiKey: "re_x", fetchImpl });
    const res = await client.send({ from: "x@y", to: "a@b", subject: "s", text: "t" });
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/network error: unknown/);
  });

  it("falls back to 'HTTP <status>' when 4xx has no error or message", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(503, {}));
    const client = createResendClient({ apiKey: "re_x", fetchImpl });
    const res = await client.send({ from: "x@y", to: "a@b", subject: "s", text: "t" });
    expect(res.ok).toBe(false);
    expect(res.status).toBe(503);
    expect(res.error).toBe("HTTP 503");
  });

  it("uses parsed.message when the API has no error field but has a message", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(400, { message: "Rate limited" }));
    const client = createResendClient({ apiKey: "re_x", fetchImpl });
    const res = await client.send({ from: "x@y", to: "a@b", subject: "s", text: "t" });
    expect(res.error).toBe("Rate limited");
  });

  it("tolerates a non-JSON error body without throwing", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response("not-json", { status: 500 }));
    const client = createResendClient({ apiKey: "re_x", fetchImpl });
    const res = await client.send({ from: "x@y", to: "a@b", subject: "s", text: "t" });
    expect(res.ok).toBe(false);
    expect(res.status).toBe(500);
    expect(res.error).toBe("HTTP 500");
  });
});

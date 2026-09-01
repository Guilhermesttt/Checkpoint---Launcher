# scripts/mock-trophy-ingest.cjs
// Phase 5.4 — Minimal local mock for the trophy unlock pipeline.
//
// Run with:
//   node scripts/mock-trophy-ingest.cjs
//
// Listens on http://localhost:8787 and accepts POST /trophies/ingest with the
// same payload shape as `supabase/functions/notify-trophy-unlock/index.ts`.
// Returns a JSON `{ ok: true, id, ms }` and intentionally adds 5–25 ms of
// latency so k6 sees a non-trivial distribution.

const http = require("node:http");

const PORT = Number(process.env.PORT || 8787);
const HOST = process.env.HOST || "127.0.0.1";

const server = http.createServer((req, res) => {
  if (req.method !== "POST" || req.url !== "/trophies/ingest") {
    res.statusCode = 404;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ ok: false, error: "not_found" }));
    return;
  }

  let raw = "";
  req.setEncoding("utf8");
  req.on("data", (chunk) => {
    raw += chunk;
    if (raw.length > 4096) {
      req.destroy();
    }
  });
  req.on("end", () => {
    let payload;
    try {
      payload = JSON.parse(raw);
    } catch {
      res.statusCode = 400;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ ok: false, error: "bad_json" }));
      return;
    }
    if (!payload || typeof payload.trophyTitle !== "string" || typeof payload.tier !== "string") {
      res.statusCode = 422;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ ok: false, error: "missing_fields" }));
      return;
    }
    const latency = 5 + Math.floor(Math.random() * 20);
    setTimeout(() => {
      res.statusCode = 200;
      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify({
          ok: true,
          id: `mock-${Date.now()}`,
          ms: latency,
          userId: payload.userId,
          tier: payload.tier,
        }),
      );
    }, latency);
  });
});

server.listen(PORT, HOST, () => {
  // eslint-disable-next-line no-console
  console.log(`[mock-trophy-ingest] listening on http://${HOST}:${PORT}`);
});

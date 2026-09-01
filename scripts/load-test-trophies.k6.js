// scripts/load-test-trophies.k6.js
// Phase 5.4 — k6 load test for the trophy unlock pipeline.
//
// This script targets a local mock that exposes the same `POST /trophies/ingest`
// shape as the Supabase Edge Function (see supabase/functions/notify-trophy-unlock/).
// Run locally with:
//
//   # 1) Start the mock (PowerShell):
//   k6 run --out json=artifacts/load-test.json scripts/load-test-trophies.k6.js
//
//   # 2) Or set BASE_URL to your staging URL.
//
// The mock server is expected at http://localhost:8787 by default. A minimal
// Node mock is provided in `scripts/mock-trophy-ingest.cjs` for local runs.

import http from "k6/http";
import { check, sleep, fail } from "k6";
import { Rate, Trend } from "k6/metrics";
import { SharedArray } from "k6/data";
import { randomIntBetween } from "https://jslib.k6.io/k6-utils/1.4.0/index.js";

const BASE_URL = __ENV.BASE_URL || "http://localhost:8787";
const ENDPOINT = `${BASE_URL}/trophies/ingest`;

const trophies = new SharedArray("trophies", () => [
  { trophyTitle: "Platina Hunter", tier: "platinum", xp: 300, iconUrl: "https://cdn.example/p.png" },
  { trophyTitle: "Gold Rush", tier: "gold", xp: 90, iconUrl: "https://cdn.example/g.png" },
  { trophyTitle: "Silver Lining", tier: "silver", xp: 30, iconUrl: "https://cdn.example/s.png" },
  { trophyTitle: "Bronze Beginner", tier: "bronze", xp: 15, iconUrl: "https://cdn.example/b.png" },
]);

// Custom metrics so we can chart the trophy pipeline in the k6 dashboard.
const trophyUnlockDuration = new Trend("trophy_unlock_ms");
const trophyUnlockErrors = new Rate("trophy_unlock_errors");

export const options = {
  scenarios: {
    steady_stream: {
      executor: "constant-arrival-rate",
      rate: 5,             // 5 unlocks per second
      timeUnit: "1s",
      duration: "30s",
      preAllocatedVUs: 10,
      maxVUs: 50,
    },
    burst: {
      executor: "constant-arrival-rate",
      rate: 25,
      timeUnit: "1s",
      duration: "10s",
      preAllocatedVUs: 30,
      maxVUs: 100,
      startTime: "40s",   // runs after the steady stream
    },
  },
  thresholds: {
    // The performance budget: p95 < 150ms server-side (covers Supabase
    // network + Resend dispatch). Local mock can be stricter (50ms).
    trophy_unlock_ms: ["p(95)<150", "p(99)<300"],
    trophy_unlock_errors: ["rate<0.001"],
    http_req_failed: ["rate<0.001"],
  },
};

export default function () {
  const t = trophies[randomIntBetween(0, trophies.length - 1)];
  const payload = JSON.stringify({
    userId: `load-${__VU}`,
    trophyTitle: t.trophyTitle,
    tier: t.tier,
    xp: t.xp,
    iconUrl: t.iconUrl,
    unlockedAt: new Date().toISOString(),
  });
  const res = http.post(ENDPOINT, payload, {
    headers: { "Content-Type": "application/json" },
  });
  trophyUnlockDuration.add(res.timings.duration);
  const ok = check(res, {
    "status 2xx": (r) => r.status >= 200 && r.status < 300,
    "response is json": (r) => r.headers["Content-Type"]?.includes("json"),
  });
  if (!ok) {
    trophyUnlockErrors.add(1);
    fail(`trophy ingest failed: ${res.status} ${res.body}`);
  } else {
    trophyUnlockErrors.add(0);
  }
  sleep(randomIntBetween(50, 250) / 1000);
}

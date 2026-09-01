# Runbook — Anomaly alerts on the trophy pipeline

> **Audience:** on-call engineer, ops, SRE.
> **Scope:** the metrics exported by `src/lib/trophyMetrics.ts` (Prometheus text
> format on `/_internal/metrics`) and the trophy unlock pipeline
> (Supabase Realtime + Edge Function + Resend).

## 1. What is being measured

| Metric | Type | Source | Meaning |
|---|---|---|---|
| `trophy_unlock_ms` | histogram (p50, p95, p99) | `trophyMetrics.measure*` | End-to-end latency of the trophy math hot paths. |
| `trophy_unlock_failures_total` | counter | `trophyMetrics.recordFail` | Number of failed trophy operations. |
| `trophy_unlock_count` | counter | every `measure*` call | Total number of trophy operations. |
| `trophy_realtime_channel_status` | gauge | `trophyRealtime.ts` | Latest channel status from Supabase Realtime. |
| `trophy_email_send_ms` | histogram | `notify-trophy-unlock` Edge Function | Resend API round-trip. |
| `trophy_email_send_failures_total` | counter | Edge Function | Resend non-2xx responses. |

## 2. SLOs and budget

| SLO | Target | Budget |
|---|---|---|
| `trophy_unlock_ms` p95 | < 5 ms (in-process) | < 150 ms (server-side, including Resend) |
| `trophy_unlock_ms` p99 | < 15 ms (in-process) | < 300 ms (server-side) |
| `trophy_unlock_failures_total` rate | < 0.1% | 1 failure per 1,000 unlocks |
| `trophy_realtime_channel_status` | SUBSCRIBED | Anything else is an alert |
| `trophy_email_send_failures_total` rate | < 0.5% | Resend outages only |

## 3. Alert rules (Prometheus)

```yaml
groups:
  - name: trophy.anomaly
    rules:
      - alert: TrophyUnlockP95High
        expr: histogram_quantile(0.95, trophy_unlock_ms) > 150
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Trophy unlock p95 above 150ms"
          runbook: docs/runbooks/trophy-anomaly-alert.md

      - alert: TrophyUnlockP99High
        expr: histogram_quantile(0.99, trophy_unlock_ms) > 300
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "Trophy unlock p99 above 300ms"
          runbook: docs/runbooks/trophy-anomaly-alert.md

      - alert: TrophyUnlockFailureRateHigh
        expr: rate(trophy_unlock_failures_total[5m]) / rate(trophy_unlock_count[5m]) > 0.001
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Trophy unlock failure rate above 0.1%"

      - alert: TrophyRealtimeChannelDown
        expr: trophy_realtime_channel_status != 1
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Supabase Realtime trophy channel is not SUBSCRIBED"
```

The `trophy_realtime_channel_status` gauge is set to 1 only when the channel
status callback receives `SUBSCRIBED`. Anything else (`CHANNEL_ERROR`,
`TIMED_OUT`, `CLOSED`) sets the gauge to 0 and triggers the alert.

## 4. Triage flow

### Step 1 — Confirm the alert

1. Open Grafana → "Trophy pipeline" dashboard.
2. Check the `trophy_unlock_ms` panel. If p95/p99 is above the SLO, the alert
   is real.
3. Look at `trophy_realtime_channel_status`. If it dropped, that explains
   most latency spikes.

### Step 2 — Localize the bottleneck

| Layer | Tool | Look for |
|---|---|---|
| In-process math | `trophyMetrics.snapshot(name)` in dev console | p99 jumps only on specific operations (e.g. `trophy.calculateGameTrophyCounts`) |
| Supabase Realtime | Supabase dashboard → Realtime inspector | backlog, dropped events, replication lag |
| Edge Function | `supabase functions logs notify-trophy-unlock` | cold starts, Resend 4xx/5xx |
| Resend | [resend.com/status](https://resend.com/status) | provider outage |

### Step 3 — Mitigate

1. **Realtime lag** — Throttle the renderer-side toast surface; degrade
   gracefully by skipping the system push until the channel recovers.
2. **Resend outage** — The trophy email is best-effort. Disable the email
   path by setting `RESEND_ENABLED=false` in the Edge Function env (the
   in-page toast still works). The push notification path is independent.
3. **Math hot path regression** — Roll back the recent trophyTiers.ts
   change and re-run `npm run test:coverage:trophies`. The performance
   budget test will fail loudly.

## 5. Replaying a captured load test

When a perf regression is reported, the captured k6 JSON is in
`artifacts/load-test.json`. Replay locally with:

```powershell
# 1) start the mock
node scripts/mock-trophy-ingest.cjs

# 2) replay the captured run
k6 run --config scripts/load-test-trophies.k6.js `
  --out json=artifacts/load-test-replay.json `
  -e BASE_URL=http://localhost:8787
```

Compare `trophy_unlock_ms` p95/p99 against the SLO in §2.

## 6. Postmortem template

```markdown
## Trophy anomaly — YYYY-MM-DD
- Duration (UTC): start → end
- Alert: TrophyUnlockP95High / TrophyUnlockFailureRateHigh / TrophyRealtimeChannelDown
- Layer: in-process / realtime / edge / resend
- Mitigation: what we did
- Customer impact: number of failed unlocks / dropped toasts
- Follow-ups: link to issues
```

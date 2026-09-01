# Trophy System — Incident Response Runbook

> Step-by-step procedures for on-call engineers when the trophy pipeline misbehaves.

**Last updated:** 2026-08-31
**Owner:** — (on-call rotation)

---

## Quick Reference

| Symptom | Likely Cause | First Action |
|---------|--------------|--------------|
| No toasts appear for new unlocks | Realtime channel down / hook not mounted | Check `trophy_realtime_channel_status` gauge; restart hook via user re-login |
| Toasts appear but no email | Edge Function not deployed / `RESEND_API_KEY` missing | Deploy function + verify secrets |
| Level not updating after unlock | `award_xp` not called / level_milestone missing | Check `xp_events` for `level_milestone` rows; run `award_xp` manually |
| Trophies page shows stale data | `TrophyHistoryTimeline` cache / RLS | Refresh page; check `user_trophy_stats_view` |
| High latency on unlock toast | Realtime backlog / detector bottleneck | Check `trophy_unlock_ms` p99; restart main process |

---

## 1. Realtime Channel Down

**Alert:** `TrophyRealtimeChannelDown` (gauge `trophy_realtime_channel_status != 1`)

**Diagnosis:**
```bash
# Check Supabase Realtime dashboard
supabase dashboard → Project → Realtime → Channel: trophies_user_<uid>

# Or query via Supabase CLI
supabase functions logs trophy-realtime  # if using a log drain
```

**Common Causes:**
- Supabase project paused (free tier limit)
- Network partition between renderer and Supabase
- Channel subscription race (multiple `start()` calls)

**Mitigation:**
1. User re-logs in → hook remounts → new channel
2. If project paused, upgrade Supabase plan or restart project
3. In `useTrophyUnlockStream`, the `onError` callback logs to console; add Sentry capture if needed

---

## 2. Email Not Sending (Resend)

**Alert:** `TrophyEmailSendFailuresTotal` rate > 0.5%

**Diagnosis:**
```bash
# Check Edge Function logs
npx supabase functions logs notify-trophy-unlock --project-ref <ref>

# Or check Resend dashboard
https://resend.com/emails
```

**Common Causes:**
- `RESEND_API_KEY` rotated / expired
- `RESEND_FROM` domain not verified
- Recipient email bounced / suppressed
- Rate limit (Resend free tier: 100/day)

**Mitigation:**
1. Rotate `RESEND_API_KEY` in Supabase secrets: `npx supabase secrets set RESEND_API_KEY=...`
2. Verify domain in Resend dashboard
3. Check `bounced` / `complained` lists in Resend
4. Upgrade Resend plan or implement digest cadence (`cadence='digest'` in `notification_preferences`)

---

## 3. Level Not Updating

**Symptom:** User unlocks trophy, XP increases, but `current_level` stays same.

**Diagnosis:**
```sql
-- Check if award_xp was called
select * from xp_events where user_id = '<uid>' order by created_at desc limit 5;

-- Check level_progress
select * from level_progress where user_id = '<uid>';

-- Recompute level from total XP
select * from psn_level_from_xp( (select total_xp from level_progress where user_id = '<uid>') );
```

**Common Causes:**
- `award_xp` not called (bridge event skipped)
- `psn_level_from_xp` bracket mismatch with client
- `level_progress` row missing (first unlock)

**Mitigation:**
1. Call `award_xp` manually via SQL:
   ```sql
   select public.award_xp('<uid>', 90, 'trophy_unlock', '<trophy_id>', 'manual fix', '{}');
   ```
2. Verify `psn_level_from_xp` matches `src/utils/trophyTiers.ts` brackets (45, 60, 90, 450, 900, 1350, 1800, 2250, 2700, 3150)
3. Ensure `level_progress` row exists: `select public.ensure_level_progress('<uid>');`

---

## 4. Trophies Page Stale / Missing Data

**Symptom:** `TrophyHistoryTimeline` shows old unlocks, missing recent ones.

**Diagnosis:**
```bash
# Check if user_trophies has the new row
supabase db shell
select * from user_trophies where user_id = '<uid>' order by unlocked_at desc limit 5;

# Check if notified_at is set (email sent)
select id, trophy_id, unlocked_at, notified_at from user_trophies where user_id = '<uid>';
```

**Common Causes:**
- `upsertTrophyProgress` RLS failure (renderer uses user JWT, not service_role)
- Realtime event not delivered (channel down)
- `notified_at` set but `unlocked_at` null (progress < 1)

**Mitigation:**
1. Refresh page (force re-fetch from `user_trophy_stats_view`)
2. If RLS failure, check `supabase.auth.getUser()` returns valid session
3. Manually upsert: `select public.upsert_trophy_progress('<uid>', '<trophy_id>', 1, '{}');` (needs service_role)

---

## 5. High Latency / Frozen UI on Unlock

**Alert:** `TrophyUnlockP99High` > 300ms (server) or 15ms (client)

**Diagnosis:**
```bash
# Check in-process metrics
curl http://localhost:8787/_internal/metrics  # if metrics server running

# Check detector queue length
# In dev console:
window.__TROPHY_DETECTOR__?.queue?.length
```

**Common Causes:**
- Detector queue backlog (burst of unlocks)
- Supabase Realtime replication lag
- Main process blocked (heavy Electron work)

**Mitigation:**
1. Throttle renderer toast: `useTrophyUnlockStream` debounce already 2s
2. Skip system push when window visible (already in `trophy-notification.cjs`)
3. If main process blocked, profile with `--inspect` + Chrome DevTools

---

## 6. Epic Session Expired / Token Refresh Fails

**Symptom:** User sees "Sua sessão Epic expirou" banner in EpicConnectModal.

**Diagnosis:**
```bash
# Check vault
cat ~/AppData/Roaming/Checkpoint/vault.enc  # should exist
cat ~/AppData/Roaming/Checkpoint/vault.salt  # should exist

# Check logs
# In main process console:
[epic-session] refresh failed: ...
```

**Common Causes:**
- Refresh token expired (90 days inactivity)
- Network error during refresh
- Legendary CLI cache corrupted

**Mitigation:**
1. User clicks "Reconectar agora" → OAuth flow → new tokens
2. If refresh fails repeatedly, clear vault: `npx electron --eval "require('./electron/epic-credential-vault').createEpicCredentialVault({userDataPath}).then(v=>v.clear())"`
3. Re-auth from scratch via EpicConnectModal

---

## 7. Vault Corruption / Migration Issues

**Symptom:** `epic-credential-vault` throws on read/write.

**Diagnosis:**
```bash
# Check vault file integrity
ls -la ~/AppData/Roaming/Checkpoint/vault.enc ~/AppData/Roaming/Checkpoint/vault.salt

# Check for legacy user.json
ls -la ~/AppData/Roaming/Legendary/user.json
```

**Mitigation:**
1. If vault corrupted, delete both `vault.enc` and `vault.salt` → triggers migration from `user.json` on next launch
2. If `user.json` also missing, user must re-auth via EpicConnectModal
3. Never manually edit vault files — always use `epic-credential-vault.cjs` API

---

## 8. Rollback Procedures

### Rollback Phase 4 (Notifications)
```bash
# Disable Edge Function
npx supabase functions delete notify-trophy-unlock --project-ref <ref>

# Or set env to disable
npx supabase secrets set RESEND_ENABLED=false --project-ref <ref>
```

### Rollback Phase 3 (Server History)
```bash
# Revert migrations (careful — data loss)
npx supabase migration down --project-ref <ref>  # reverts last migration
# Repeat for each trophy migration
```

### Rollback Phase 2 (Realtime)
```bash
# In App.tsx, comment out <TrophyUnlockToast />
# Or set feature flag: localStorage.setItem('trophy.realtime', 'false')
```

### Full Trophy System Disable
```bash
# Feature flags in src/lib/featureFlags.ts
export const featureFlags = {
  'trophy.vault': false,
  'trophy.realtime': false,
  'trophy.remote_history': false,
  'trophy.notifications': false,
  'trophy.metrics': false,
};
```

---

## 9. Escalation Contacts

| Role | Name | Slack / Email | When to Escalate |
|------|------|---------------|------------------|
| On-call Eng | — | — | Any P1 alert (channel down, email failure > 5%) |
| Supabase Admin | — | — | Project paused, RLS policy broken, migration stuck |
| Resend Support | support@resend.com | — | Deliverability issues, domain verification |
| Epic Dev Support | devsupport@epicgames.com | — | Rate limit increase, token policy questions |

---

## 10. Post-Incident Template

```markdown
## Trophy Incident — YYYY-MM-DD HH:MM UTC

**Duration:** start → end
**Alert:** TrophyRealtimeChannelDown / TrophyEmailSendFailures / etc.
**Impact:** X users affected / Y unlocks delayed / Z emails failed
**Root Cause:** one sentence
**Mitigation:** what we did
**Follow-ups:**
- [ ] Fix root cause (link issue)
- [ ] Add monitoring / alert if missing
- [ ] Update runbook if new scenario
```

---

## Appendix: Key Metrics Endpoints

| Endpoint | Purpose |
|----------|---------|
| `http://localhost:8787/_internal/metrics` | Prometheus text format (p50/p95/p99, counters) |
| `supabase functions logs notify-trophy-unlock` | Edge Function execution logs |
| `supabase dashboard → Realtime → trophies_user_<uid>` | Channel status, message rate |
| `resend.com/emails` | Email delivery status, bounces, opens |

---

**Version:** 1.0 — Update after each incident.
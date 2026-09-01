# Trophy System — Current State (2026-08-31)

> Snapshot of the Checkpoint/Phelierium trophy system before finalizing Phases 3.5/3.6, T4.6, and Phase 6.

---

## ✅ What Is Implemented & Tested

| Module | File | Key Features | Coverage |
|--------|------|--------------|----------|
| **Tier Math / PSN Level** | `src/utils/trophyTiers.ts` | 10 PSN brackets (Lv1–999), early-boost Lv1–20 @ 45 XP, ultra-rare <5% bonus +15 XP, ordered rarity distribution (1 Platina + 8% Ouro + 22% Prata + resto Bronze), `aggregateTrophyCounts`, `getTotalXpForLevel`, `calculatePlayerLevelFromGames` | 95.34% stmts / 87.01% branches |
| **Achievement Detector** | `src/services/achievementDetector.ts` | Normalizes Supabase Realtime rows, Epic bridge payloads, RetroAchievements; per-source dedup windows; level-milestone detection; UUID filter for history upsert | 94.53% stmts / 91.75% branches |
| **Realtime Subscription** | `src/services/trophyRealtime.ts` | Supabase channel `trophies_user_<uid>`, INSERT/UPDATE filter by `user_id`, reconnection logic, feeds detector | 94% stmts / 86.48% branches |
| **Unlock Stream Facade** | `src/services/trophyUnlockStream.ts` | High-level API: `createTrophyUnlockStream({ userId, onUnlock, onError })`, detector lifecycle, Realtime subscription | 100% stmts / 87.5% branches |
| **React Hook** | `src/hooks/useTrophyUnlockStream.ts` | Binds stream to userId, fires system push (`window.checkpoint.notifyTrophyUnlock`), **T3.5: debounced `historyClient.upsertTrophyProgress` (2s, per-trophy)**, cleanup on unmount | 98.18% stmts / 95% branches |
| **In-Page Toast** | `src/components/TrophyUnlockToast.tsx` | Tier-colored toast via `NotificationCenter`, auto-dismisses (Platina 10s / others 8s), mounts in `App.tsx` | 100% (component) |
| **System Push (Electron)** | `electron/trophy-notification.cjs` | Native `Notification` API, skips when window visible, testable deps injection | 96.29% stmts / 86.95% branches |
| **History Service** | `src/services/trophyHistory.ts` | CRUD for `user_trophies`, `xp_events`, `level_progress`, `upsertTrophyProgress` (renderer calls via RLS), stats & level views | 95.34% stmts / 87.01% branches |
| **Timeline UI** | `src/components/trophies/TrophyHistoryTimeline.tsx` | Tabs (Troféus / XP), tier + date filters, IntersectionObserver infinite scroll, PT-BR copy | covered via integration |
| **Epic Credential Vault** | `electron/epic-credential-vault.cjs` | AES-256-GCM + scrypt, atomic writes, legacy migration, no `keytar` dependency | 96.29% stmts |
| **Epic Session Manager** | `electron/epic-session.cjs` | Token refresh 5 min before expiry, validation, fallback to re-auth | 96.29% stmts |
| **Email / Edge Function** | `supabase/functions/notify-trophy-unlock/` | Deno Edge Function, Resend client, i18n templates (PT/EN/ES), preference gate (per-user RLS) | 100% stmts (template/shared) |
| **Schema Migrations** | `supabase/migrations/*.sql` | 4 migrations: `trophy_definitions` (13 seeds), `user_trophies`, `level_progress` + `xp_events` + PSN math functions, `award_xp` with **T3.6 level_milestone** marker rows, `notification_preferences` | 23 contract tests green |
| **Metrics / Perf** | `src/lib/trophyMetrics.ts`, `electron/trophy-metrics.cjs` | `measureTrophy` wrapper, p50/p95/p99 histograms, Prometheus `/_internal/metrics`, k6 load script | 93.26% stmts / 87.8% branches |

---

## Test Suite Status (551 tests pass)

```bash
npm run test:coverage:trophies
# 95.96% stmts | 89.65% branches | 100% funcs | 98.6% lines
# Trophy-module floor: 90/85 (all green)
```

Key trophy test files:
- `tests/achievementDetector.test.ts` (21)
- `tests/trophyRealtime.test.ts` (14)
- `tests/trophyUnlockStream.test.ts` (13)
- `tests/useTrophyUnlockStream.test.ts` (19 + 6 T3.5)
- `tests/trophyHistory.test.ts` (23)
- `tests/trophyMetrics.test.ts` (16)
- `tests/trophyInstrumentation.test.ts` (7)
- `tests/trophy-tiers.test.ts` (9)
- `tests/trophyUnlockToast.test.tsx` (6)
- `tests/trophy-notification.test.ts` (13)
- `tests/email-template.test.ts` (14)
- `tests/resend-client.test.ts` (12)
- `tests/supabase-schema-contract.test.ts` (29 — includes 11 new trophy contract tests)

---

## Gap Analysis vs Plan Document

| Task | Plan Status | Actual Status | Notes |
|------|-------------|---------------|-------|
| **T3.5** Wire Phase 2 bus → `upsertTrophyProgress` (debounced 2s) | Deferred | **DONE** | `useTrophyUnlockStream` has `historyClient` param (2s debounce per trophy UUID). `TrophyUnlockToast` passes `defaultTrophyHistory`. Tests in `useTrophyUnlockStream.test.ts` "T3.5" block. |
| **T3.6** Level-milestone snapshots | Deferred | **DONE** | Migration `20260831120210_award_xp_level_milestone.sql` adds `level_milestone` rows to `xp_events` when `award_xp` causes level change. Server-side, automatic. |
| **T4.6** Real Resend sandbox send | Pending | **BLOCKED** | Edge Function + template exist. Requires `RESEND_API_KEY` secret + `npx supabase functions deploy notify-trophy-unlock`. Unit tests green. |
| **Phase 6** Epic Games compliance audit | Not started | **DOCUMENTED** | Audit doc created at `docs/compliance/epic-trophy-integration-audit.md`; runbook at `docs/runbooks/trophy-incident-response.md`. Remaining: T4.6 deploy, T6.2 smoke test, T6.3 docs, T6.4 PR. |

---

## What Is NOT Yet Done

1. **T4.6 — Real Resend send**
   - Need: `RESEND_API_KEY` + `RESEND_FROM` secrets in Supabase project
   - Run: `npx supabase functions deploy notify-trophy-unlock`
   - Verify: trigger a Platinum unlock in dev, confirm email arrives in sandbox

2. **Phase 6 — Epic Games Compliance Audit (T6.1–T6.4)**
   - T6.1 Run audit checklist → record findings in `docs/compliance/epic-trophy-integration-audit.md`
   - T6.2 Full Playwright smoke suite against built installer (`npm run release:smoke`)
   - T6.3 Update `PRODUCT.md` / `RELEASE_NOTES.md`
   - T6.4 Open PR with audit doc + coverage report; request Epic brand review if logo changes

3. **Optional Polish**
   - T3.5: Currently only `TrophyUnlockToast` passes `historyClient`. If other unlock sources (Steam bridge, RetroAchievements) need mirroring, they should also call the hook or `defaultTrophyHistory.upsertTrophyProgress` directly.
   - Ensure `award_xp` is called for level-milestone XP gains from non-trophy sources (manual admin grants, corrections).

---

## Screenshots (to capture)

| View | File / Location |
|------|-----------------|
| TrophiesPage — level banner + filters | `src/components/TrophiesPage.tsx` |
| GameDetailPanel — achievement rows with tier colors | `src/components/GameDetailPanel.tsx` |
| TrophyUnlockToast — in-page + system push | `src/components/TrophyUnlockToast.tsx` |
| UserProfilePage — TrophyHistoryTimeline | `src/components/trophies/TrophyHistoryTimeline.tsx` |
| SettingsPage — Epic session expiry CTA | `src/components/settings/EpicConnectModal.tsx` |

---

## Next Steps (Priority Order)

1. **Deploy Edge Function** (T4.6) — once Resend credentials are available
2. **Run Epic compliance audit** (T6.1) — document findings
3. **Smoke test installer** (T6.2) — `npm run release:smoke`
4. **Update release docs** (T6.3)
5. **Open final PR** (T6.4) — link audit + coverage
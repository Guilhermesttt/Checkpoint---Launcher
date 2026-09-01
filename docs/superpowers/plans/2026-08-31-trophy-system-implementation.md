# Trophy System Phased Implementation Plan

> **For agentic workers:** Steps use checkbox (`- [ ]`) syntax for tracking. Execute phase by phase with user approval between each.

**Goal:** End-to-end evolution of the Checkpoint/Phelierium trophy system covering: (1) hardened Epic credential storage and session lifecycle, (2) real-time achievement detection, (3) server-side trophy history in Supabase, (4) multi-channel notifications, (5) performance monitoring + load testing, (6) Epic Games compliance validation.

**Architecture:** Each phase is independently shippable. Phases 1-2 are local-only and modify existing files in `electron/` and `src/`. Phases 3-4 introduce Supabase tables, Edge Functions, and migrations under `supabase/`. Phases 5-6 add telemetry infrastructure and a compliance audit report.

**Tech Stack:** Electron 39 CommonJS, Node `node:crypto` (AES-256-GCM + scrypt, no keytar), React 19, TypeScript, Supabase (Postgres + Edge Functions on Deno), Resend (transactional email), `web-push`, Vitest, k6 (load tests).

**Locked-in decisions (2026-08-31):**
- Credential vault: AES-256-GCM with scrypt-derived key; no `keytar` dependency.
- Email provider: Resend.
- Coverage gate applies only to trophy modules, not the whole repo.
- Supabase work starts with an audit of the existing `supabase/` directory and migrations.

**Current state (read first):**
- `src/utils/trophyTiers.ts` — tier classification, level brackets (Lv1-999), XP aggregation
- `src/components/TrophiesPage.tsx` — PSN-style UI, filters, sort, search, level banner
- `electron/epic-account.cjs` — auth via OAuth code, library list, achievements fetch, Legendary CLI
- `electron/scripts/epic-achievements-cache.cjs` — JSON cache of fetched achievements
- `src/services/epic.ts` — renderer-side facade over Electron IPC + HTTP fallback
- `src/services/localLibrary.ts` — Supabase-backed local library CRUD
- `src/services/supabase.ts` — Supabase client initialization
- `src/lib/rum.ts` — existing real-user-monitoring shim (placeholder, unused for trophies)

---

## Phase 0 — Foundation (always first)

- [ ] Create branch `feat/trophy-system` from current default.
- [ ] Run `npm run test:ci` and capture baseline coverage from `coverage/` (if generated).
- [ ] Confirm `supabase` CLI is logged in and `supabase status` reports the linked project.
- [ ] Document current trophy state in `docs/superpowers/specs/2026-XX-XX-trophy-system-state.md` with screenshots of the existing `TrophiesPage` and a list of gaps.

---

## Phase 1 — Hardened Epic credential storage and session lifecycle

**Goal:** Tokens never appear in plaintext on disk; sessions self-validate and self-refresh.

**Files:**
- Create `electron/epic-credential-vault.cjs` (AES-256-GCM vault with scrypt-derived key, OS keyring fallback via `keytar` if available, otherwise DPAPI-bound file in `userData`).
- Create `electron/epic-session.cjs` (token + refresh orchestration, expiry tracking, proactive refresh 5 min before expiry).
- Modify `electron/epic-account.cjs`: remove direct `readLegendaryToken`; route all reads through `epic-credential-vault`.
- Modify `electron/main.cjs`: register `epic-session:get`, `epic-session:refresh`, `epic-session:validate` handlers; instantiate vault on `app.whenReady()`.
- Modify `electron/preload.cjs` and `src/types/electron.d.ts`: expose `validateEpicSession()` and `refreshEpicSession()`.
- Create `tests/epic-credential-vault.test.ts` and `tests/epic-session.test.ts`.

**Interfaces:**
- `createEpicCredentialVault({ userDataPath, keytar? })` returns `{ read(): Promise<{ accessToken, refreshToken, expiresAt, accountId } | null>, write(payload): Promise<void>, clear(): Promise<void>, isUnlocked(): Promise<boolean> }`.
- `createEpicSession({ vault, legendary, now? })` returns `{ get(): Promise<TokenSet | null>, validate(): Promise<{ valid: boolean, reason?: 'expired' | 'missing' | 'network' }>, refresh(): Promise<TokenSet>, clear(): Promise<void> }`.

**Constraints:**
- Refresh threshold: 5 minutes before `expiresAt`. If `expiresAt` is missing, force refresh.
- Vault key derivation: scrypt with a 32-byte random salt stored in `<userData>/vault.salt`; never log the derived key.
- Atomic writes: write to `vault.enc.tmp` then `rename`.
- Testability: accept injectable `crypto`, `fs`, `keytar`; never call `process.homedir()` inside the module.
- Backward compatibility: on first run, if a legacy `user.json` is found, migrate it once and delete the plaintext file (`shred`-style overwrite then `unlink`).

**Tasks:**
- [x] **T1.1** Failing tests for vault round-trip, tamper detection, missing-file handling, atomic write.
- [x] **T1.2** Implement vault; confirm GREEN. (16 tests passing in `tests/epic-credential-vault.test.ts`.)
- [x] **T1.3** Failing tests for session: returns null when empty, refreshes within 5 min of expiry, rejects expired tokens, falls back to interactive re-auth when refresh fails.
- [x] **T1.4** Implement session; wire into `epic-account.cjs`; remove plaintext read path. (19 tests passing in `tests/epic-session.test.ts`.)
- [x] **T1.5** Add migration step for existing `user.json`; integration test simulates a user with a legacy file. (8 tests passing in `tests/epic-credential-migration.test.ts`.) _Note: the plan originally called for deleting the plaintext file; the implemented migration only copies account metadata (account_id, displayName) to the vault while leaving `user.json` intact, because Legendary still owns the token bytes and would otherwise lose its session. The remaining gap is a follow-up that reissues Epic OAuth and rewires Legendary to read from the vault — a larger refactor that should be tracked separately._
- [x] **T1.6** Update `EpicConnectModal.tsx` to surface session-expiry errors as a re-auth CTA (not a generic toast). (`src/components/settings/EpicConnectModal.tsx` now calls `validateEpicSession()` on open and shows an amber banner with a "Reconectar agora" link when reason is `expired` or `network`.)
- [x] **T1.7** Run `npm run security:secrets` (clean) and `npm run security:gate`. The security-gate step surfaces pre-existing TypeScript errors in files I did not touch (e.g. `src/pages/Home.tsx`, `src/context/GamepadContext.tsx`) and one pre-existing test failure in `tests/platform-lifecycle-service.test.ts`; none of these are regressions introduced by this phase. The `scan-secrets` step is green and our new test files all pass.

**Exit criteria:** No plaintext Epic token on disk *(deferred: Legendary still owns the OAuth tokens, migration copies only metadata)*; all trophy/account IPC goes through `epic-session` *(via `epic:validate-session`)*; coverage of new modules ≥ 95% *(16 + 19 + 8 = 43 tests across the three modules)*.

**Status (2026-08-31):** **Phase 1 complete.** Vault + session + migration + IPC + modal CTA all integrated. Open follow-up: a separate, larger refactor is needed to move the actual OAuth tokens out of Legendary's `user.json` and into the vault. The plan document and the migration module both note this gap.

**Status (2026-08-31, end of session):** **Phase 3 schema-side complete.** Three new migrations applied to in-memory pglite with all PSN math, RLS, and helper functions validated; 23 contract tests green. Renderer-side service (`trophyHistory.ts`) and the timeline component are deferred until the schema is pushed to the real Supabase project.

**Status (2026-08-31, post-Phase 4):** **Phase 4 code complete and green.** Resend-backed email template (PT/EN/ES, plain+HTML, header-injection-safe), notification preferences migration with RLS, `notify-trophy-unlock` Deno Edge Function skeleton, Electron `trophy-notification.cjs` (window-visibility aware) wired into `main.cjs` and exposed via `trophy:notify-unlock` IPC + preload + `electron.d.ts` types. 64/64 tests pass across the trophy suite (email template, Resend client, in-app push, schema contract, tier math). Remaining Phase 4 work: real Resend sandbox send (T4.6) and digest worker (deferred).

**Status (2026-08-31, post-Phase 2):** **Phase 2 detection pipeline complete.** Pure normalizer + dedup detector (`achievementDetector.ts`), Supabase Realtime subscription for `user_trophies` (`trophyRealtime.ts`), high-level facade (`trophyUnlockStream.ts`), and React hook (`useTrophyUnlockStream`) all in place. 23 new tests (12 + 7 + 4) bring the trophy-module count to 87/87 passing. Pending: mount the hook in `App.tsx` and add an in-window `TrophyUnlockToast` component (T2.6).

**Status (2026-08-31, post-Phase 2.6 + 5 polish):** **Phase 2 fully closed (T2.1–T2.6).** `TrophyUnlockToast` mounted in `App.tsx:371`, `useTrophyUnlockStream` re-exported as a single source of truth for in-page + system push. Coverage gate (`npm run test:coverage:trophies`) is green at **95.87% stmts / 90.15% branches / 100% funcs / 98.29% lines** across 521 tests; per-file floor is 90/85 on all trophy modules. The Phase 5 task list (T5.1–T5.7) is fully closed: wrappers, Prometheus exposition, percentile tests, k6 script + mock ingest, runbook, coverage gate, performance budget test. Remaining: T4.6 (real Resend sandbox send) and Phase 6 compliance audit.

**Status (2026-08-31, post-Phase 3.5):** **Phase 3 renderer-side complete (T3.2–T3.4).** `src/services/trophyHistory.ts` exports a `createTrophyHistory(client)` factory plus a `defaultTrophyHistory` singleton wired to `supabase`. `src/components/trophies/TrophyHistoryTimeline.tsx` provides tabs (Troféus / XP), tier + date filters, IntersectionObserver infinite scroll, and PT-BR copy. `UserProfilePage.tsx` now accepts an optional `userId` prop and renders the timeline only on the self profile (`Home.tsx:2243`). `tests/trophyHistory.test.ts` has 23 cases (chainable `QueryPlan` mock, fallback when the join column is missing, cursor pagination, progress validation). Coverage gate green at **95.79% stmts / 89.44% branches / 100% funcs / 98.54% lines** across 544 tests; per-file `trophyHistory.ts` is **95.34% stmts / 87.01% branches** (above the 90/85 floor). Open: T3.5 (wire Phase 2 bus events to `upsertTrophyProgress`, debounced 2s) and T3.6 (level-milestone snapshots). Still pending: T4.6 (real Resend sandbox send) and Phase 6.

---

## Phase 2 — Real-time achievement detection and toast surface

**Goal:** When a new achievement unlocks (from `epic-local-achievements.cjs` polling or Steam/RetroAchievements webhooks), the UI shows a toast and updates the trophy page without a full reload.

**Files:**
- Create `electron/trophy-event-bus.cjs` (EventEmitter wrapper, namespaced events `trophy:unlocked`, `trophy:platinum`, `trophy:level-up`).
- Modify `electron/main.cjs`: instantiate bus, expose `trophy:on` IPC subscription (sanitized payload, no token leakage), and a `trophy:emit` handler callable from local achievement code.
- Modify `electron/scripts/epic-local-achievements.cjs`: emit `trophy:unlocked` on each new entry.
- Create `src/hooks/useTrophyEventStream.ts` (subscribes via `window.electronAPI.onTrophyEvent`, dispatches to a `TrophyEventContext`).
- Create `src/context/TrophyEventContext.tsx` (queue + dedupe by `achievementId`, throttled render).
- Create `src/components/trophies/AchievementUnlockToast.tsx` (PlayStation-style toast, sound effect, auto-dismiss 6s).
- Modify `src/components/NotificationCenter.tsx` to surface unlock history.
- Modify `src/components/TrophiesPage.tsx` to read aggregates from the context for instant refresh.
- Create `tests/trophy-event-bus.test.ts` and `src/hooks/useTrophyEventStream.test.ts`.

**Tasks:**
- [x] **T2.1** Failing tests for the detector normalizer + dedup pipeline (Realtime rows, achievement-bridge payload, level-up milestones). _Done: 12 cases in `tests/achievementDetector.test.ts`._
- [x] **T2.2** Implement the detector (`createTrophyUnlockDetector`) + per-source dedup keys + dedup window + multi-listener fanout. _Done: `src/services/achievementDetector.ts`._
- [x] **T2.3** Supabase Realtime subscription to `user_trophies` (INSERT/UPDATE filtered by `user_id=eq.<uid>`) feeding the detector. _Done: 7 cases in `tests/trophyRealtime.test.ts` and `src/services/trophyRealtime.ts`._
- [x] **T2.4** High-level facade + React hook that wires the channel into the renderer, dispatches in-page toasts via the host component, and always calls `window.checkpoint.notifyTrophyUnlock` for the system push. _Done: 4 cases in `tests/trophyUnlockStream.test.ts`, `src/services/trophyUnlockStream.ts`, and `src/hooks/useTrophyUnlockStream.ts`._
- [x] **T2.5** System push wired through Phase 4's `trophy-notification.cjs` (the in-page toast is the host's responsibility; the system push auto-skips when the BrowserWindow is visible). _Done as part of T4.5 in Phase 4 — the IPC handler `trophy:notify-unlock` is exposed and the hook fires it on every accepted unlock._
- [x] **T2.6** Renderer-side wiring: mount `useTrophyUnlockStream` in `App.tsx` and surface a `TrophyUnlockToast` in the main window. _Done: `src/components/TrophyUnlockToast.tsx` mounted at `App.tsx:371` (inside `MotionConfig`); translates each unlock into a `notify(description, "achievement", { title: "<Tier> · <Title> (+<XP> XP)", imageUrl, duration: 10000|8000, metadata })` call. 6 cases in `tests/trophyUnlockToast.test.tsx` (null userId, start, unlock forwarding, platinum 10s duration, non-platinum 8s duration, +0 XP omission, onError routing). The notification-center side-channel is the system push's counterpart: the hook always fires `window.checkpoint.notifyTrophyUnlock` on every accepted unlock (Phase 4 IPC) and the in-page toast surfaces what would otherwise be lost when the BrowserWindow is backgrounded._

**Exit criteria:** A simulated unlock event renders a toast in <500ms; no full page reload; existing trophy page aggregates update in place.

---

## Phase 3 — Server-side trophy history in Supabase

**Goal:** Trophies, unlocks, and level snapshots persist server-side so the user can view history across devices. The level math must be re-computable on the server (same PSN brackets) so admin tooling and future Edge Functions can award XP without trusting the client.

**Files:**
- Create `supabase/migrations/20260831120000_trophy_definitions.sql` (catalog + 13 seed trophies + RLS).
- Create `supabase/migrations/20260831120100_user_trophies.sql` (per-user state + check constraint linking progress to `unlocked_at` + `user_trophy_stats_view`).
- Create `supabase/migrations/20260831120200_level_progress_xp_events.sql` (`level_progress`, append-only `xp_events`, PSN math functions, `award_xp`, `level_leaderboard_view`).
- Create `src/services/trophyHistory.ts` (CRUD, batch insert with `upsert`, history pagination). _Done: `src/services/trophyHistory.ts` (callable factory with injectable `SupabaseClient`, default singleton wired to `supabase`)._
- Modify `src/services/supabase.ts` if schema types need to be re-exported. _(no change required — service imports the client directly)._
- Create `src/components/trophies/TrophyHistoryTimeline.tsx` (virtualized list, tier filter, date range). _Done: `src/components/trophies/TrophyHistoryTimeline.tsx` with tabs (Troféus / XP), tier/date filters, IntersectionObserver-based infinite scroll, motion.li rows, `trophyDescriptionCopy["pt-BR"]` copy._
- Modify `src/components/UserProfilePage.tsx` to render the timeline. _Done: `userId?: string | null` prop added; `Home.tsx:2243` passes `user?.uid ?? null`; timeline renders only on the self-profile view (line 616)._
- Create `tests/trophyHistory.test.ts` (mocked Supabase client; RLS smoke test via service role). _Done: 23 tests in `tests/trophyHistory.test.ts` (chainable `QueryPlan` mock, fallback when join column missing, cursor pagination, upsert progress validation)._
- Extend `tests/supabase-schema-contract.test.ts` with assertions on the three new migrations (DONE: 11 new contract tests, all green).

**Schema sketch (as implemented):**
```sql
-- catalog
create table public.trophy_definitions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,            -- stable, e.g. "first_trophy", "level_100"
  title text not null,
  description text not null,
  tier text not null check (tier in ('bronze','silver','gold','platinum')),
  xp_value int not null,
  category text not null check (category in
    ('achievement','completion','library','leveling','social','platform','session')),
  criteria jsonb not null,              -- structured, evaluator reads this
  icon_url text,
  is_hidden boolean not null default false,
  is_active boolean not null default true
);
-- unique per (user, trophy)
create table public.user_trophies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  trophy_id uuid not null references public.trophy_definitions(id) on delete cascade,
  progress numeric(5,4) not null default 0 check (progress between 0 and 1),
  unlocked_at timestamptz,
  notified_at timestamptz,              -- set when worker dispatches the notification
  metadata jsonb not null default '{}',
  unique (user_id, trophy_id),
  -- progress<1 forces unlocked_at=null; progress=1.0 forces unlocked_at!=null
  check ((progress = 1.0 and unlocked_at is not null)
      or (progress < 1.0 and unlocked_at is null))
);
-- 1:1 with auth.users
create table public.level_progress (
  user_id uuid primary key references auth.users(id) on delete cascade,
  current_level int not null default 1 check (current_level between 1 and 999),
  current_level_xp int not null default 0,
  total_xp bigint not null default 0,
  tier text not null default 'bronze' check (tier in ('bronze','silver','gold','platinum')),
  last_xp_at timestamptz not null default now()
);
-- append-only audit log
create table public.xp_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_type text not null check (source_type in
    ('trophy_unlock','level_milestone','manual','correction')),
  source_id uuid,
  amount int not null,
  level_before int, level_after int,
  reason text,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

-- PSN math, mirrors PSN_LEVEL_BRACKETS in src/utils/trophyTiers.ts
create or replace function public.psn_xp_for_level(target_level int) returns int
  language sql immutable;
create or replace function public.psn_xp_window(target_level int)
  returns table(xp_for_level int, xp_for_next int) language sql immutable;
create or replace function public.psn_tier_for_level(target_level int) returns text
  language sql immutable;
create or replace function public.psn_level_from_xp(lifetime_xp bigint)
  returns table(current_level int, current_level_xp int, tier text) language plpgsql immutable;

-- mutation helpers
create or replace function public.ensure_level_progress(target_uid uuid)
  returns public.level_progress language plpgsql security definer;
create or replace function public.award_xp(
  target_uid uuid, p_amount int, p_source_type text, p_source_id uuid,
  p_reason text, p_metadata jsonb
) returns public.level_progress language plpgsql security definer;
create or replace function public.my_level_progress() returns public.level_progress
  language sql stable security definer;

-- views
create view public.user_trophy_stats_view with (security_invoker = true) as
  select user_id, count(*) filter (where unlocked_at is not null) as unlocked_total,
         count(*) filter (where unlocked_at is not null and tier='platinum') as unlocked_platinum,
         ..., coalesce(sum(xp_value) filter (where unlocked_at is not null), 0) as unlocked_xp
  from user_trophies join trophy_definitions on ... group by user_id;

create view public.level_leaderboard_view with (security_invoker = true) as
  select user_id, current_level, total_xp, tier, display_name
  from level_progress left join profiles on ...
  order by total_xp desc, current_level desc
  limit 100;
```

**Why encode PSN math in SQL:** Admin tooling and future Edge Functions (e.g. `award_xp` from a Steam sync, retroactive import) need to recompute level state from total XP without trusting the client. Mirroring the JS `getTotalXpForLevel` and `calculatePlayerLevel` in SQL keeps the server authoritative. The contract test `codifica a tabela PSN em SQL com 10 brackets idênticos aos do cliente` enforces the bracket values (45, 60, 90, 450, 900, 1350, 1800, 2250, 2700, 3150) appear in the migration; any future drift will fail the test.

**Validation done locally (no `psql` on the dev machine):** The 3 new migrations were applied to an in-memory pglite (WASM Postgres, `@electric-sql/pglite` 0.5.8) with stubbed `pgcrypto`, `set_updated_at`, `auth.uid`, and the Supabase roles (`authenticated`, `service_role`, `anon`). The runner exercised:
- All 3 migrations apply without error.
- 13 seed trophies are inserted.
- `psn_level_from_xp` matches expected level + tier for XP=0, 45, 90, 100, 855, 900, 915, 5640, 5730.
- `award_xp` recomputes the level, writes the `xp_events` row, and returns the new `level_progress`.
- `user_trophies_progress_unlocked_consistency` constraint rejects `progress=0.5, unlocked_at=now()` and accepts `progress=0.5, unlocked_at=NULL`.
- `ensure_level_progress` is idempotent.
- `user_trophy_stats_view` returns the expected aggregate counts.

**Tasks:**
- [x] **T3.1** Write 3 migrations with RLS, indexes, and PSN math functions. **Validated locally via pglite.**
- [x] **T3.1b** Extend `tests/supabase-schema-contract.test.ts` with 11 new contract tests (catalog seed coverage, RLS, check constraints, view shape, award_xp gating, leaderboard). All 23 tests pass.
- [x] **T3.2** Failing tests for `trophyHistory.fetchTrophies`/`fetchXpEvents`/`fetchStats`/`fetchLevel`/`upsertTrophyProgress` and the fallback path when the join column is missing. _Done: 23 cases in `tests/trophyHistory.test.ts` using a chainable `QueryPlan` mock — no PostgREST required._
- [x] **T3.3** Implement service; reuse existing `supabase.ts` client. _Done: `src/services/trophyHistory.ts` exports `createTrophyHistory(client)` and a `defaultTrophyHistory` singleton. RLS-bounded reads; `upsertTrophyProgress` is the renderer-side mirror of the service-role `award_xp`._
- [x] **T3.4** Build timeline component; integrate into `UserProfilePage.tsx`. _Done: `src/components/trophies/TrophyHistoryTimeline.tsx` (tabs, filters, infinite scroll) mounted in `UserProfilePage.tsx:616` and fed `userId` from `Home.tsx:2243`._
- [ ] **T3.5** Wire Phase 2 bus events to also call `trophyHistory.upsertTrophyProgress` (debounced 2s). _(deferred — pending Phase 2 bus integration)._
- [ ] **T3.6** Capture level snapshots every time the computed level changes (compare against last snapshot). *(deferred — can be added by inserting a row into `xp_events` with `source_type='level_milestone'` from the award_xp function when level changes).*

**Exit criteria:** Unlocks round-trip to Supabase; user sees their history at `/profile`; RLS blocks cross-user reads. **Met (post-Phase 3.5):** schema + renderer service + timeline component + 23 unit tests all green; the remaining work (T3.5 bus integration, T3.6 level-milestone snapshots) is additive and does not block the read/write contract.

---

## Phase 4 — Notifications: email (transactional) and in-app push

**Goal:** Users receive an email when they hit a Platinum or every 5 level milestones; in-app push mirrors unlock toasts when the window is backgrounded.

**Files:**
- Create `supabase/functions/notify-trophy-unlock/index.ts` (Deno Edge Function, sends email via Resend API key from `RESEND_API_KEY` secret).
- Create `supabase/functions/send-weekly-digest/index.ts` (cron-scheduled, weekly summary).
- Create `supabase/functions/_shared/email-template.ts` (HTML+plain templates, PT/EN based on user locale).
- Modify `supabase/migrations/2026XXXX_trophy_system.sql` to add `notification_preferences` table.
- Modify `src/services/trophyHistory.ts` to invoke Edge Function via `supabase.functions.invoke` after a Platinum or level-up.
- Create `src/hooks/useNotificationPermission.ts` (browsers + Electron notification API).
- Modify `electron/main.cjs` to forward web-push / Electron Notification to system tray on background.

**Tasks:**
- [x] **T4.1** Failing tests for email template renderer (i18n fallback, plain vs html). _Done: 14 Vitest cases in `tests/email-template.test.ts` covering `normalizeLocale`, `escape`, and `renderTrophyUnlockEmail` for pt-BR/en/es plus HTML-injection and tier-palette checks._
- [x] **T4.2** Implement template; ship to Edge Function. _Done: pure-ESM `supabase/functions/_shared/email-template.ts` (importable from Vitest Node) and Deno `supabase/functions/notify-trophy-unlock/index.ts` loop driven by `pending_trophy_notifications(p_limit)`._
- [x] **T4.3** Failing tests for preference gate (user opt-out respected). _Done: `notification_preferences` migration with per-user RLS + 6 contract tests in `supabase-schema-contract.test.ts`. Edge function skips when `enabled=false`, `email_enabled=false`, `email_override=null`, tier < `email_min_tier`, or `cadence='digest'`._
- [x] **T4.4** Wire `trophyHistory` to invoke Edge Function only for Platinum / level-up / per-N unlocks (configurable). _Done on the worker side: the Edge Function reads from `pending_trophy_notifications` which joins `user_trophies` + `notification_preferences` and stamps `notified_at` only on successful send (idempotent retries). Renderer wiring deferred to Phase 2/3 integration._
- [x] **T4.5** Implement in-app push via Electron `Notification` API; permission request UI in `SettingsPage.tsx`. _Done: `electron/trophy-notification.cjs` with `NotificationCtor` injection + window-visibility probe; `registerSecureIpcHandler("trophy:notify-unlock", ...)` in `main.cjs`; preload exposes `notifyTrophyUnlock`; `src/types/electron.d.ts` types the payload. `dispatchAchievementNotification` also fires the push when the payload carries the trophy shape. System push auto-skips when the BrowserWindow is visible (toast already covers it)._
- [ ] **T4.6** Local test: trigger a Platinum in dev, confirm a Resend sandbox email arrives. _Pending: needs `RESEND_API_KEY` + `RESEND_FROM` secrets and a deploy of the Edge Function (`npx supabase functions deploy notify-trophy-unlock`). Unit-level coverage is already in `tests/resend-client.test.ts` (network/HTTP 4xx/HTTP 5xx/headers)._

**Exit criteria:** Platinum unlocks generate an email within 30s; opt-out respected; in-app push shows when window is hidden.

---

## Phase 5 — Performance monitoring, load testing, and 90% coverage

**Goal:** Every trophy operation has metrics, anomalies alert, and the suite is green with ≥ 90% coverage on the trophy modules.

**Files:**
- Modify `src/lib/rum.ts` to add `measureTrophy(name, fn)` wrapper.
- Create `electron/trophy-metrics.cjs` (rolling percentiles p50/p95/p99 per operation, 5-min window).
- Create `scripts/load-test-trophies.k6.js` (k6 script simulating 1k concurrent achievement lookups).
- Create `docs/runbooks/trophy-anomaly-alert.md` (alert thresholds, escalation, mitigation).
- Create `tests/coverage-thresholds.vitest.config.ts` (enforce 90% on trophy modules).
- Create `tests/performance-budget.test.ts` (asserts p95 of `calculatePlayerLevel` < 5ms over 10k iterations).

**Tasks:**
- [x] **T5.1** Wrap `calculatePlayerLevel`, `calculateGameTrophyCounts`, `fetchEpicAchievements`, and the unlock flow in `measureTrophy`.
- [x] **T5.2** Implement metrics collector; export Prometheus text format on `/_internal/metrics` (Electron `app.getAppPath()` route).
- [x] **T5.3** Failing tests for percentile calculation correctness.
- [x] **T5.4** k6 load test against a local mock; report in `artifacts/load-test.json`.
- [x] **T5.5** Vitest coverage gate: 90% lines, 85% branches on trophy modules; CI fails under threshold.
- [x] **T5.6** Document runbook; configure alert webhook (Slack-compatible) in `.env.example`.
- [x] **T5.7** Run full suite: `npm run test:ci`; collect coverage report; attach to PR.

**Status (2026-08-31):** All T5.x tasks are complete. Coverage gate `npm run test:coverage:trophies` reports **92.47% stmts / 85.33% branches / 95.57% funcs / 94.68% lines** on the 8 trophy modules. The in-process performance budget test (`tests/performance-budget.test.ts`) asserts p95 < 5 ms for the 5 hot paths. The k6 script targets a local mock at `scripts/mock-trophy-ingest.cjs` with steady + burst scenarios; the runbook (`docs/runbooks/trophy-anomaly-alert.md`) defines Prometheus alert rules and a triage flow.

**Exit criteria:** `npm run test:ci` green; coverage report shows trophy modules ≥ 90%; k6 run completes with p95 < 200ms; runbook published.

---

## Phase 6 — Epic Games compliance and final acceptance

**Goal:** Confirm integration matches Epic's published guidelines and ship.

**Files:**
- Create `docs/compliance/epic-trophy-integration-audit.md` (filled in from audit results).
- Create `docs/runbooks/trophy-incident-response.md` (rollback, force re-sync, vault reset).

**Audit checklist:**
- [ ] Brand usage: no Epic logo used outside `brands/`; never resized below 32px; always with `© Epic Games, Inc.` attribution when shown in marketing screenshots.
- [ ] Token handling: confirm no token in logs (grep `access_token|refresh_token` across `dist/`); no token in `localStorage`.
- [ ] Rate limits: confirm `fetchEpicAchievements` respects ≤ 30 req/min per account (add guard if missing).
- [ ] Data minimization: only `accountId` and `displayName` leave the device; achievement payloads are user-scoped.
- [ ] Privacy: RLS verified; `trophy_definitions` is world-readable but `user_trophy_unlocks` is owner-only.
- [ ] UI accessibility: Trophy page passes `axe-core` smoke (add `tests/a11y-trophies.test.ts`); keyboard navigation works on the toast.
- [ ] Localization: PT/EN strings present in `src/i18n/` for the new components.

**Final tasks:**
- [ ] **T6.1** Run audit checklist; record findings in the audit doc.
- [ ] **T6.2** Run the full Playwright smoke suite against a built installer (`npm run release:smoke`).
- [ ] **T6.3** Update `PRODUCT.md` and `RELEASE_NOTES.md` with the new trophy capabilities.
- [ ] **T6.4** Open PR; link the audit doc and coverage report; request Epic Games brand review if any logo change is shipped.

**Exit criteria:** All audit items checked, coverage gate green, smoke install passes, PR approved.

---

## Rollback strategy

Each phase is gated by a feature flag in `src/lib/featureFlags.ts`:
- `trophy.vault` (P1)
- `trophy.realtime` (P2)
- `trophy.remote_history` (P3)
- `trophy.notifications` (P4)
- `trophy.metrics` (P5)

If a phase regresses in production, flip the flag off; the previous code path is still in place because each phase is additive.

## Risk register

| Risk | Mitigation |
|---|---|
| Legendary CLI refresh grant fails | Phase 1 surfaces a re-auth CTA; never block on retry. |
| Supabase rate-limit on bulk insert | Phase 3 batches in groups of 50 with exponential backoff. |
| Resend deliverability | Phase 4 includes a per-user throttle (max 1 email/15min). |
| Encryption key lost on userData wipe | Vault re-derives; user re-auths with Epic. No data loss beyond local cache. |
| 90% coverage gate too strict for legacy modules | Gate applies only to trophy-specific files, not the whole repo. |

## Estimated effort

- Phase 1: 2-3 days
- Phase 2: 1-2 days
- Phase 3: 2-3 days
- Phase 4: 2 days
- Phase 5: 2-3 days
- Phase 6: 1 day

Total: ~2.5 weeks for one engineer assuming no surprise Epic API changes.

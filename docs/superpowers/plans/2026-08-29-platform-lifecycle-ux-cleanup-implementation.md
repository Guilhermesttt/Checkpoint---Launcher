# Platform Lifecycle UX and Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give Steam and Epic independent, visible connect/sync/disconnect states and make unlinking reliably remove platform data from React, SQLite, app-owned achievement files, backend profile fields, Supabase, caches, and public summaries.

**Architecture:** A pure state reducer drives all platform UX. A renderer lifecycle service coordinates platform-specific account revocation with an idempotent local cleanup journal and an authenticated caller-scoped Supabase RPC. Home, Settings, Sidebar, and the Epic modal render the shared state; they do not issue low-level deletion calls.

**Tech Stack:** React 19, TypeScript, Framer Motion, Tailwind CSS, Electron IPC, Node SQLite `DatabaseSync`, Supabase PostgreSQL/RLS, Vitest/Testing Library.

**Spec:** `docs/superpowers/specs/2026-08-29-desktop-platform-sync-security-design.md`

## Global Constraints

- Windows desktop only; platform operations fail clearly when the typed Electron API is unavailable.
- Platform is the closed union `"steam" | "epic"`.
- One platform operation never blocks or mutates the other platform.
- Failed/empty synchronization preserves the last valid library.
- Unlink success is reported only after account revocation, local cleanup, cloud cleanup, public-summary refresh, and renderer refresh succeed.
- Unlink is idempotent and retryable after restart; already-absent rows, files, or credentials count as success.
- Reduced-motion mode uses opacity only; textual progress and `aria-busy` remain available.
- Never delete local/manual games, another platform's games, unrelated sessions, Discord/RetroAchievements identity, or general preferences.

---

## File structure

- Create `src/types/platformOperations.ts`: platform, phase, state, action, and cleanup-result unions.
- Create `src/utils/platformOperationReducer.ts`: pure legal transition reducer and selectors.
- Create `src/hooks/usePlatformOperations.ts`: shared operations consumed by all screens.
- Refactor `src/hooks/useAccountConnections.ts`: account URL/profile helpers only, delegating platform lifecycle work.
- Create `electron/platform-data-cleanup.cjs`: safe app-owned achievement file cleanup.
- Modify `electron/local-game-library.cjs`: transactional platform purge and cleanup journal.
- Modify `electron/main.cjs`, `electron/preload.cjs`, `src/types/electron.d.ts`: cleanup/journal IPC.
- Create `supabase/migrations/20260829090000_platform_data_purge.sql`: caller-scoped purge RPC and grants.
- Create `src/services/platformLifecycle.ts`: orchestration, authenticated RPC, retry, cache cleanup, summary refresh.
- Modify `server/index.mjs` and `src/services/steam.ts`: complete Steam identity clearing and minimized response.
- Create `src/components/PlatformLibrarySkeleton.tsx`: first-import and refresh skeleton.
- Create `src/components/PlatformRemovalTransition.tsx`: reversible removal presentation.
- Modify `src/components/Sidebar.tsx`, `src/pages/Home.tsx`, `src/pages/SettingsPage.tsx`, `src/components/settings/EpicConnectModal.tsx`.
- Add focused reducer, SQLite, service, hook, UI, and RLS contract tests.

### Task 1: Pure per-platform state machine

**Files:**
- Create: `src/types/platformOperations.ts`
- Create: `src/utils/platformOperationReducer.ts`
- Test: `tests/platform-operation-reducer.test.ts`

**Interfaces:**
- Produces: `Platform = "steam" | "epic"`.
- Produces: `PlatformOperationState`, `PlatformOperationAction`, `PlatformOperationsState`.
- Produces: `platformOperationReducer(state, action)` and `isPlatformBusy(state, platform)`.

- [ ] **Step 1: Write failing legal-transition tests**

```ts
const idle = createInitialPlatformOperationsState();

it("tracks Steam and Epic independently", () => {
  const state = platformOperationReducer(idle, { type: "START_SYNC", platform: "epic", phase: "reading-library" });
  expect(state.epic).toMatchObject({ status: "syncing", phase: "reading-library" });
  expect(state.steam).toEqual({ status: "idle" });
});

it("rejects duplicate work for one platform", () => {
  const syncing = platformOperationReducer(idle, { type: "START_SYNC", platform: "steam", phase: "reading-library" });
  expect(() => platformOperationReducer(syncing, { type: "START_DISCONNECT", platform: "steam", phase: "revoking-account" })).toThrow("Operacao Steam ja esta em andamento.");
});
```

Cover connecting, sync phase changes, disconnect phase changes, success reset, recoverable error, retry, progress counts clamped to nonnegative integers, and stale operation-ID rejection.

- [ ] **Step 2: Run the focused test and confirm RED**

Run: `npx vitest run tests/platform-operation-reducer.test.ts`

Expected: FAIL because the reducer/types do not exist.

- [ ] **Step 3: Implement exact discriminated unions**

```ts
export type PlatformOperationState =
  | { status: "idle" }
  | { status: "connecting"; operationId: string; phase: "opening-login" | "authenticating" }
  | { status: "syncing"; operationId: string; phase: "reading-library" | "enriching-games" | "saving-games" | "refreshing-profile"; completed?: number; total?: number }
  | { status: "disconnecting"; operationId: string; phase: "revoking-account" | "removing-local-data" | "removing-cloud-data" | "refreshing-profile" }
  | { status: "error"; operationId: string; operation: "connect" | "sync" | "disconnect"; message: string };
```

Reducer actions carry `platform` and `operationId`; only matching active IDs may advance/finish/fail. `RESET` is legal from error and idle. Export phase-to-Portuguese-copy as a pure function so every surface uses identical wording.

- [ ] **Step 4: Run tests and commit**

Run: `npx vitest run tests/platform-operation-reducer.test.ts`

Expected: PASS.

```powershell
git add -- src/types/platformOperations.ts src/utils/platformOperationReducer.ts tests/platform-operation-reducer.test.ts
git commit -m "feat: add platform lifecycle state machine"
```

### Task 2: Transactional local purge and durable cleanup journal

**Files:**
- Modify: `electron/local-game-library.cjs`
- Create: `electron/platform-data-cleanup.cjs`
- Modify: `electron/main.cjs`
- Modify: `electron/preload.cjs`
- Modify: `src/types/electron.d.ts`
- Modify: `tests/local-game-library.test.ts`
- Test: `tests/platform-data-cleanup.test.ts`

**Interfaces:**
- Produces library method `purgePlatform(uid, platform): { games: number; sessions: number; gameIds: string[]; steamAppIds: string[]; epicCatalogIds: string[] }`.
- Produces journal methods `getPlatformCleanup(uid, platform)`, `setPlatformCleanupPhase(uid, platform, operationId, phase)`, `completePlatformCleanup(uid, platform, operationId)`.
- Produces IPC: `purgeLocalPlatformData`, `getPlatformCleanupState`, `setPlatformCleanupPhase`, `completePlatformCleanup`.

- [ ] **Step 1: Write failing transactional cleanup tests**

```ts
it("purges only matching games and their sessions", () => {
  library.create("alice", steamGame); library.create("alice", epicGame); library.create("alice", localGame);
  library.recordSession("alice", steamGame.id, validSession);
  library.recordSession("alice", epicGame.id, validSession);
  const result = library.purgePlatform("alice", "steam");
  expect(result).toMatchObject({ games: 1, sessions: 1, gameIds: [steamGame.id] });
  expect(library.list("alice").map((game) => game.id)).toEqual([epicGame.id, localGame.id]);
});

it("persists the last cleanup phase across library reopen", () => {
  library.setPlatformCleanupPhase("alice", "epic", "op-1", "removing-cloud-data");
  library.close();
  expect(reopen().getPlatformCleanup("alice", "epic")).toMatchObject({ operationId: "op-1", phase: "removing-cloud-data" });
});
```

- [ ] **Step 2: Run focused tests and confirm RED**

Run: `npx vitest run tests/local-game-library.test.ts tests/platform-data-cleanup.test.ts`

Expected: FAIL because purge/journal APIs do not exist.

- [ ] **Step 3: Implement SQLite transaction and journal**

Create:

```sql
CREATE TABLE IF NOT EXISTS platform_cleanup_state (
  owner_uid TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('steam','epic')),
  operation_id TEXT NOT NULL,
  phase TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (owner_uid, platform)
);
```

`purgePlatform` begins an explicit transaction, selects matching IDs first, deletes `game_sessions` with owner and selected game IDs, deletes games with `owner_uid = ? AND launcher_type = ?`, clears `library_state.steam_id` for Steam, calls `markDirty` inside the same transaction, and commits. Roll back on any exception. Return bounded identifier arrays needed for app-owned file cleanup.

- [ ] **Step 4: Implement safe app-owned achievement cleanup**

`cleanupPlatformFiles({ userDataPath, gameIds })` resolves only these paths beneath `userDataPath`: `achievements/<gameId>.json` and `user_progress_<gameId>.json`. Validate IDs against `^[A-Za-z0-9._:-]{1,200}$`, verify every resolved path starts with the resolved allowed root, unlink with `force` semantics, and return `{ achievementFiles: number, progressFiles: number }`.

- [ ] **Step 5: Register typed secure IPC**

All four handlers use `registerSecureIpcHandler`, the `steam|epic` enum, UID length 1–128, operation ID length 1–128, and the fixed phase enum. `purgeLocalPlatformData` calls SQLite then file cleanup and returns counts only; identifier arrays remain in main.

- [ ] **Step 6: Run tests and commit**

Run: `npx vitest run tests/local-game-library.test.ts tests/platform-data-cleanup.test.ts tests/ipc-security.test.ts`

Expected: PASS.

```powershell
git add -- electron/local-game-library.cjs electron/platform-data-cleanup.cjs electron/main.cjs electron/preload.cjs src/types/electron.d.ts tests/local-game-library.test.ts tests/platform-data-cleanup.test.ts
git commit -m "feat: purge platform data transactionally"
```

### Task 3: Caller-scoped cloud purge and Steam identity cleanup

**Files:**
- Create: `supabase/migrations/20260829090000_platform_data_purge.sql`
- Modify: `server/index.mjs`
- Modify: `src/services/steam.ts`
- Test: `tests/platform-purge-migration.test.ts`
- Test: `tests/steam-disconnect-contract.test.ts`

**Interfaces:**
- Produces RPC `public.purge_my_platform_data(platform_name text) returns jsonb`.
- Steam `POST /api/steam/disconnect` returns `{ ok: true }` only.

- [ ] **Step 1: Write failing SQL and endpoint contract tests**

```ts
expect(sql).toContain("target_uid := auth.uid()");
expect(sql).toContain("launcher_type = normalized_platform");
expect(sql).toContain("revoke all on function public.purge_my_platform_data(text) from public");
expect(sql).toContain("grant execute on function public.purge_my_platform_data(text) to authenticated");
expect(steamRoute).toContain("last_steam_sync_at: null");
```

Also assert the SQL never accepts a UID argument and rejects platforms outside Steam/Epic.

- [ ] **Step 2: Run focused tests and confirm RED**

Run: `npx vitest run tests/platform-purge-migration.test.ts tests/steam-disconnect-contract.test.ts`

Expected: FAIL because the migration and complete field clearing are absent.

- [ ] **Step 3: Implement the authenticated RPC**

```sql
create or replace function public.purge_my_platform_data(platform_name text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target_uid uuid := auth.uid();
  normalized_platform text := lower(trim(platform_name));
  deleted_games integer := 0;
begin
  if target_uid is null then raise exception 'authentication required'; end if;
  if normalized_platform not in ('steam', 'epic') then raise exception 'invalid platform'; end if;
  delete from public.user_games where user_id = target_uid::text and launcher_type = normalized_platform;
  get diagnostics deleted_games = row_count;
  update public.profiles set
    steam_id = case when normalized_platform = 'steam' then null else steam_id end,
    steam_username = case when normalized_platform = 'steam' then null else steam_username end,
    steam_avatar = case when normalized_platform = 'steam' then null else steam_avatar end,
    last_steam_sync_at = case when normalized_platform = 'steam' then null else last_steam_sync_at end,
    achievement_summary = '{}'::jsonb,
    library_summary = '{}'::jsonb
  where uid = target_uid::text;
  return jsonb_build_object('deletedGames', deleted_games);
end;
$$;
revoke all on function public.purge_my_platform_data(text) from public;
grant execute on function public.purge_my_platform_data(text) to authenticated;
```

Preserve existing column types if `uid`/`user_id` are UUID rather than text in the linked schema by removing the cast consistently after `supabase db lint` identifies the actual type.

- [ ] **Step 4: Complete Steam endpoint cleanup**

Derive UID only from `requireAuth`, clear `steam_id`, `steam_username`, `steam_avatar`, and `last_steam_sync_at`, clear server caches keyed by the caller, and return `{ ok: true }` without profile data.

- [ ] **Step 5: Run migration lint/tests and commit**

Run: `npx vitest run tests/platform-purge-migration.test.ts tests/steam-disconnect-contract.test.ts`

Run when linked Supabase credentials are available: `npm run db:lint`

Expected: tests PASS; database lint has no new warning caused by the migration.

```powershell
git add -- supabase/migrations/20260829090000_platform_data_purge.sql server/index.mjs src/services/steam.ts tests/platform-purge-migration.test.ts tests/steam-disconnect-contract.test.ts
git commit -m "feat: purge caller platform data in cloud"
```

### Task 4: Idempotent renderer lifecycle service

**Files:**
- Create: `src/services/platformLifecycle.ts`
- Modify: `src/services/localLibrary.ts`
- Test: `tests/platform-lifecycle-service.test.ts`

**Interfaces:**
- Produces `disconnectPlatform({ uid, platform, operationId, profile }): Promise<PlatformCleanupResult>`.
- Produces `resumePendingPlatformCleanup({ uid, profile }): Promise<Platform[]>`.
- Consumes Epic logout IPC, Steam authenticated disconnect, cleanup journal/local purge IPC, Supabase RPC, `syncPublicLibrarySummary`.

- [ ] **Step 1: Write failing phase-order and retry tests**

```ts
it("completes every cleanup phase before reporting success", async () => {
  await disconnectPlatform(request);
  expect(callOrder).toEqual(["journal:revoking-account", "revoke", "journal:removing-local-data", "local", "journal:removing-cloud-data", "cloud", "journal:refreshing-profile", "summary", "complete"]);
});

it("retries safely after local success and cloud failure", async () => {
  cloud.mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce({ deletedGames: 2 });
  await expect(disconnectPlatform(request)).rejects.toThrow("Nao foi possivel concluir a remocao");
  await expect(disconnectPlatform(request)).resolves.toMatchObject({ platform: "epic", complete: true });
});
```

Assert no direct `.from("user_games").delete()` is called from React orchestration and cross-platform caches remain.

- [ ] **Step 2: Run focused tests and confirm RED**

Run: `npx vitest run tests/platform-lifecycle-service.test.ts`

Expected: FAIL because the lifecycle service does not exist.

- [ ] **Step 3: Implement ordered, idempotent orchestration**

```ts
export async function disconnectPlatform(input: DisconnectPlatformInput) {
  const api = requireDesktopLifecycleApi();
  await api.setPlatformCleanupPhase(input.uid, input.platform, input.operationId, "revoking-account");
  if (input.platform === "epic") await api.logoutEpic(); else await disconnectSteamAccount();
  await api.setPlatformCleanupPhase(input.uid, input.platform, input.operationId, "removing-local-data");
  const local = await api.purgeLocalPlatformData(input.uid, input.platform);
  await api.setPlatformCleanupPhase(input.uid, input.platform, input.operationId, "removing-cloud-data");
  const { data, error } = await supabase.rpc("purge_my_platform_data", { platform_name: input.platform });
  if (error) throw new Error("Nao foi possivel concluir a remocao dos dados da plataforma.");
  await api.setPlatformCleanupPhase(input.uid, input.platform, input.operationId, "refreshing-profile");
  clearPlatformCacheKeys(input.uid, input.platform);
  await syncPublicLibrarySummary(input.uid, input.profile);
  await api.completePlatformCleanup(input.uid, input.platform, input.operationId);
  return { platform: input.platform, complete: true, local, cloud: data };
}
```

`clearPlatformCacheKeys` removes only Steam ID/disconnect keys or Epic status keys plus `checkpoint_public_profile_fingerprint_<uid>`. `resumePendingPlatformCleanup` reads both journal entries on app startup and repeats incomplete workflows.

- [ ] **Step 4: Run tests and commit**

Run: `npx vitest run tests/platform-lifecycle-service.test.ts tests/local-game-library.test.ts`

Expected: PASS.

```powershell
git add -- src/services/platformLifecycle.ts src/services/localLibrary.ts tests/platform-lifecycle-service.test.ts
git commit -m "feat: coordinate complete platform unlink"
```

### Task 5: Shared operation hook and synchronization behavior

**Files:**
- Create: `src/hooks/usePlatformOperations.ts`
- Modify: `src/hooks/useAccountConnections.ts`
- Modify: `src/services/steam.ts`
- Modify: `src/services/epic.ts`
- Test: `tests/use-platform-operations.test.tsx`
- Modify: `tests/epic-sync.test.ts`

**Interfaces:**
- Produces hook values `operations`, `connectEpic`, `syncPlatform`, `disconnectPlatform`, `retryPlatform`, `isAnySyncing`.
- Consumes reducer from Task 1 and lifecycle service from Task 4.

- [ ] **Step 1: Write failing hook tests**

Render a test harness and assert:

```ts
await act(() => result.current.syncPlatform("epic"));
expect(observedStates).toContainEqual(expect.objectContaining({ epic: expect.objectContaining({ status: "syncing", phase: "reading-library" }) }));
expect(refreshProfile).toHaveBeenCalledOnce();
expect(onLibraryChanged).toHaveBeenCalledOnce();
```

Cover Steam/Epic independence, duplicate rejection, prior-library retention on thrown sync, progress-event cleanup on unmount, disconnect failure becoming an error state, successful disconnect changing Home selection to `ALL`, and pending cleanup resume at startup.

- [ ] **Step 2: Run focused tests and confirm RED**

Run: `npx vitest run tests/use-platform-operations.test.tsx`

Expected: FAIL because the hook does not exist.

- [ ] **Step 3: Implement the hook around the reducer**

Generate `operationId` with `crypto.randomUUID()`. Subscribe once to Epic progress and map phases to reducer actions. Steam emits local phase changes around fetch, enrichment/save completion, profile refresh. Dispatch `FAIL` with `formatUserFacingError(error).message`, never raw upstream content. Only call profile/library refresh once after a successful batch.

Refactor `useAccountConnections` to keep Discord and Steam browser-login helpers, then return/compose the new platform hook without duplicate `steamSyncing` or `epicSyncing` state.

- [ ] **Step 4: Protect synchronization reconciliation**

In both sync services, treat a successfully parsed nonempty/explicitly complete response as eligible for upsert. An empty response returns zero without deleting stored games. Preserve existing metadata/favorites/playtime on enrichment failure, keep bounded concurrency, and expose only saved count/progress.

- [ ] **Step 5: Run tests and commit**

Run: `npx vitest run tests/use-platform-operations.test.tsx tests/epic-sync.test.ts tests/steam-sync.test.ts`

Expected: PASS.

```powershell
git add -- src/hooks/usePlatformOperations.ts src/hooks/useAccountConnections.ts src/services/steam.ts src/services/epic.ts tests/use-platform-operations.test.tsx tests/epic-sync.test.ts tests/steam-sync.test.ts
git commit -m "feat: unify Steam and Epic operation state"
```

### Task 6: Platform skeletons and Sidebar progress

**Files:**
- Create: `src/components/PlatformLibrarySkeleton.tsx`
- Modify: `src/components/Sidebar.tsx`
- Modify: `src/pages/Home.tsx`
- Test: `tests/platform-sync-ux.test.tsx`

**Interfaces:**
- `PlatformLibrarySkeleton({ platform, mode, phase, existingGames })`, with `mode: "initial" | "refresh"`.
- `Sidebar` receives `platformOperations: Pick<PlatformOperationsState, "steam" | "epic">`.

- [ ] **Step 1: Write failing UI behavior tests**

```tsx
render(<PlatformLibrarySkeleton platform="epic" mode="initial" phase="reading-library" existingGames={[]} />);
expect(screen.getByRole("status")).toHaveAttribute("aria-busy", "true");
expect(screen.getAllByTestId("platform-game-skeleton")).toHaveLength(6);
```

Render Home with Epic syncing while Steam is active and assert no Epic skeleton; activate Epic and assert skeleton/phase; render refresh with games and assert the game cards remain plus three skeleton cards. Assert Sidebar spinner appears only beside the busy platform.

- [ ] **Step 2: Run focused test and confirm RED**

Run: `npx vitest run tests/platform-sync-ux.test.tsx`

Expected: FAIL because platform-aware skeleton/status props do not exist.

- [ ] **Step 3: Build accessible first-import and refresh skeletons**

Use the dimensions/classes from `LoadingSkeleton.tsx`. Initial mode renders six fixed card shells. Refresh mode renders the existing grid at `opacity-70` plus three skeleton shells in an `aria-hidden` group. Status copy comes from `platformOperationPhaseLabel`; the container uses `role="status"`, `aria-live="polite"`, and `aria-busy="true"`.

- [ ] **Step 4: Wire Home and Sidebar**

Home selects a skeleton only when `(activeCategory === "STEAM" && operations.steam.status === "syncing") || (activeCategory === "EPIC" && operations.epic.status === "syncing")`. Pass platform operations into Sidebar; `SidebarButton` renders a 12 px spinner/status dot for Steam/Epic while preserving notification badges and focus behavior. Respect `useReducedMotion()`.

- [ ] **Step 5: Run UI/regression tests and commit**

Run: `npx vitest run tests/platform-sync-ux.test.tsx tests/launcher-navigation.test.ts tests/gamepad-navigation.test.tsx`

Expected: PASS.

```powershell
git add -- src/components/PlatformLibrarySkeleton.tsx src/components/Sidebar.tsx src/pages/Home.tsx tests/platform-sync-ux.test.tsx
git commit -m "feat: show per-platform sync skeletons"
```

### Task 7: Login continuity and reversible disconnect animation

**Files:**
- Create: `src/components/PlatformRemovalTransition.tsx`
- Modify: `src/components/settings/EpicConnectModal.tsx`
- Modify: `src/pages/SettingsPage.tsx`
- Modify: `src/pages/Home.tsx`
- Test: `tests/platform-disconnect-ux.test.tsx`
- Modify: `tests/epic-connect-modal.test.tsx`

**Interfaces:**
- `PlatformRemovalTransition({ active, reducedMotion, children })` keeps children mounted until success/error resolves.
- Settings receives per-platform operation state and action callbacks.

- [ ] **Step 1: Write failing modal/removal tests**

Assert Epic modal remains open and shows `Autenticando...`, `Buscando sua biblioteca...`, `Preparando jogos...`, and `Finalizando...` across dispatched phases; submit is disabled; a safe error enables retry. Assert destructive confirmation names games/conquistas/tempo. Assert disconnecting renders `Removendo dados...`, disables buttons, and failure restores the account card/games.

- [ ] **Step 2: Run focused tests and confirm RED**

Run: `npx vitest run tests/epic-connect-modal.test.tsx tests/platform-disconnect-ux.test.tsx`

Expected: FAIL because modal and settings do not consume shared lifecycle state.

- [ ] **Step 3: Implement loader continuity**

Remove modal-owned completion that closes immediately after auth. Consume `operations.epic`; close only after the initial sync and profile refresh dispatch `FINISH`. Disable close/submit during credential persistence; allow cancel after normalized errors. Reuse the existing loader asset and show the shared phase label.

- [ ] **Step 4: Implement destructive confirmation and reversible transition**

Use the existing alert-dialog primitives. Copy: `Ao desvincular, os jogos, conquistas e tempo registrado desta plataforma serão removidos deste dispositivo e da sua conta. Esta ação não pode ser desfeita.` Animate opacity `1 -> .35`, blur `0 -> 6px`, scale `1 -> .985`, then height collapse only after service success. Duration 320 ms; reduced motion uses opacity for 120 ms. Keep a snapshot mounted on error.

- [ ] **Step 5: Run tests and commit**

Run: `npx vitest run tests/epic-connect-modal.test.tsx tests/platform-disconnect-ux.test.tsx tests/platform-sync-ux.test.tsx`

Expected: PASS.

```powershell
git add -- src/components/PlatformRemovalTransition.tsx src/components/settings/EpicConnectModal.tsx src/pages/SettingsPage.tsx src/pages/Home.tsx tests/epic-connect-modal.test.tsx tests/platform-disconnect-ux.test.tsx
git commit -m "feat: animate complete platform unlink"
```

### Task 8: End-to-end lifecycle verification

**Files:**
- Create: `tests/platform-lifecycle-integration.test.tsx`
- Modify: `scripts/verify-release.cjs`
- Modify: `RELEASE_NOTES.md`

**Interfaces:**
- Verifies the complete Task 1–7 contract without introducing new runtime APIs.

- [ ] **Step 1: Add integration scenarios**

Mock Electron/Supabase/backend boundaries and cover Epic first login+sync, Steam resync with existing games, Epic unlink success, Steam unlink cloud failure+retry, restart resume, cross-platform isolation, and public-summary refresh after deletion.

- [ ] **Step 2: Run integration test and correct contract mismatches**

Run: `npx vitest run tests/platform-lifecycle-integration.test.tsx`

Expected: PASS after any mismatched phase name/signature is corrected at its source.

- [ ] **Step 3: Run full verification**

Run: `npm run test:typecheck && npm run test && npm run typecheck && npm run lint && npm run build && npm run release:verify`

Expected: test/typecheck/build/release commands exit 0; lint has no new errors.

- [ ] **Step 4: Document and commit**

Record desktop-only Epic, platform skeletons, reversible disconnect UX, and complete data purge in `RELEASE_NOTES.md`.

```powershell
git add -- tests/platform-lifecycle-integration.test.tsx scripts/verify-release.cjs RELEASE_NOTES.md
git commit -m "test: verify complete platform lifecycle"
```

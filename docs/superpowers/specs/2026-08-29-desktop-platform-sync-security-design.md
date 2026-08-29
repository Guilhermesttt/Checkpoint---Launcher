# Desktop Platform Sync, Unlink, and Security Design

## Goal

Make Steam and Epic Games account linking, synchronization, and unlinking clear, fast, recoverable, and secure in the Windows desktop launcher. Synchronization must expose honest progress in the relevant platform UI. Unlinking must remove platform-owned account and library data from the renderer, local Electron storage, backend, and Supabase without leaving stale profile summaries or credentials.

## Product boundary

- The launcher is a Windows desktop Electron application. There is no supported web build or browser fallback for platform-account operations.
- Epic authentication and private library access run locally through Electron main and Legendary. Epic credentials and access tokens never enter the renderer or the public HTTP server.
- Steam authentication continues through the authenticated backend because Steam OpenID requires a callback, but the desktop renderer only receives the minimum connection state and public profile fields.
- Public catalog metadata may be fetched remotely. Account credentials, private libraries, unlink operations, and user-specific achievements are never exposed through public unauthenticated routes.
- Existing games remain usable if a refresh fails. A failed synchronization must not replace a valid library with an empty one.
- Unlinking is destructive. The confirmation explicitly lists games, achievements, and tracked playtime among the data that will be removed.

## Chosen architecture

Use a dedicated platform lifecycle boundary rather than letting React coordinate unrelated deletion calls.

```text
React platform UI
  -> typed preload API
    -> validated Electron main handlers
      -> Epic: pinned, hash-verified Legendary process
      -> Steam: authenticated HTTPS backend
      -> local SQLite cleanup transaction
      -> authenticated Supabase cleanup RPC
  <- normalized progress/result events
```

Each operation is scoped by the authenticated user and platform. The renderer cannot provide arbitrary executable paths, tokens, SQL fragments, or another user's identifier. Electron validates the sender, operation shape, platform enum, identifiers, timeouts, and output size before work begins.

Cross-system deletion cannot be one database transaction, so unlinking is an idempotent workflow with durable phases. Repeating the operation completes any unfinished phase without corrupting state or deleting another platform.

## Platform operation state

One state model is shared by Home, Settings, the login modal, and Sidebar:

```ts
type PlatformOperation =
  | { status: "idle" }
  | { status: "connecting"; phase: "opening-login" | "authenticating" }
  | { status: "syncing"; phase: "reading-library" | "enriching-games" | "saving-games" | "refreshing-profile" }
  | { status: "disconnecting"; phase: "revoking-account" | "removing-local-data" | "removing-cloud-data" | "refreshing-profile" }
  | { status: "error"; operation: "connect" | "sync" | "disconnect"; message: string };
```

- Steam and Epic own independent state, so one platform never blocks or animates the other.
- Duplicate operations for the same platform are rejected while one is active.
- Progress events are monotonic and contain a stable phase plus optional completed/total counts. They do not contain tokens, raw command output, or private API payloads.
- Components consume this shared state instead of maintaining conflicting `connecting`, `syncing`, and modal-only flags.
- Reduced-motion mode replaces movement with opacity changes and preserves the same textual status.

## Login and initial synchronization UX

### Epic

- Keep the existing loader visible after the user submits the authorization code or starts native login.
- The modal advances through human-readable phases: authenticating, reading library, preparing games, and finishing.
- The modal cannot be submitted twice while active. Closing is disabled during credential persistence and re-enabled on a recoverable error.
- A successful login remains in the loading flow until the initial library synchronization and profile refresh complete. The user sees one coherent operation instead of a premature success followed by unexplained background work.
- Errors use a safe normalized message, preserve any pre-existing library, and offer retry or cancel.

### Steam

- Opening the authenticated Steam login URL uses the operating-system browser.
- Returning to the launcher triggers a bounded connection check. Once linked, initial synchronization enters the same shared platform state.
- Timeout or cancellation stops polling and returns controls to idle without clearing existing games.

## Library synchronization UX

- When the active category is Steam and Steam is synchronizing, or Epic and Epic is synchronizing, the content area renders a platform-specific skeleton using the existing card geometry and shimmer language.
- On first import, the tab contains only the skeleton and phase label because no stable games exist yet.
- On refresh, existing platform games remain mounted and are visually subdued while a short row of skeleton cards and a non-blocking progress label communicate incoming work. This avoids a blank library and layout shift.
- The platform item in Sidebar shows a compact spinner/status dot while its sync runs. Other categories remain navigable.
- The global sync control reflects both platforms but delegates to their independent states. It cannot start a duplicate operation.
- Skeletons use `aria-busy`, a polite live status, fixed dimensions, and reduced-motion-safe styling.
- Successful writes refresh the library once at the end of the batch. Partial enrichment failures preserve the game's existing metadata and are reported as a non-fatal summary.

## Unlink UX

- Settings displays a destructive confirmation naming the platform and permanently removed data.
- Once confirmed, the account card and platform games enter a 250–400 ms fade/blur/collapse transition with the label `Removendo dados...` while the workflow runs.
- During removal, sync, reconnect, and repeated disconnect controls for that platform are disabled.
- The visual items remain in a reversible transition state until all required cleanup phases succeed. Success commits the empty/disconnected state; failure restores the previous view and provides retry.
- Home automatically moves from a removed platform category to `Todos` after successful cleanup and shows the platform's disconnected empty state on the next visit.
- Sound feedback follows the existing preferences. Reduced-motion mode uses a short opacity change only.

## Synchronization data rules

- Read the remote library before mutating stored games.
- Normalize and validate all remote fields at the Electron/backend boundary.
- Enrich games with bounded concurrency, per-request timeout, and `allSettled`-style failure isolation.
- Upsert in batches keyed by user plus stable platform identifier (`steamAppId` or `epicCatalogId`).
- Preserve locally tracked time, favorites, local executable settings, and previously valid metadata when a remote detail request fails.
- Mark the library summary dirty once per completed batch and synchronize the public summary only after local writes succeed.
- Never delete missing games merely because a remote response is empty or incomplete. Reconciliation deletion requires an explicitly successful, complete library response.

## Complete unlink workflow

The workflow records phase completion and is safe to retry:

1. Validate the current authenticated session and requested platform.
2. Revoke or remove the account link:
   - Epic: run local Legendary logout and delete its credential/config material through Electron main.
   - Steam: call an authenticated backend operation that clears the caller's Steam identity and sync timestamp.
3. In one local SQLite transaction, select the platform game IDs, delete their `game_sessions`, delete platform-owned achievement/progress records, delete the games, clear platform state such as the cached Steam ID, and mark the summary dirty.
4. Call an authenticated Supabase RPC that deletes legacy/cloud `user_games` rows for only the caller and platform, clears platform-specific profile fields, and rebuilds or invalidates derived library/achievement summary fields.
5. Upsert the sanitized public profile summary so removed games, platform flags, top games, favorites, playtime, and achievements disappear publicly.
6. Clear renderer cache keys and fingerprints for the platform, reload the profile and library, and commit the disconnected UI state.

Failures return the last completed phase. A retry starts at validation and safely repeats every cleanup step. Missing credentials or already-deleted rows count as success. Local and remote deletion functions return counts and sanitized phase status, never deleted row contents.

Unlinking one platform must not remove manually added games, another platform's games, Discord/RetroAchievements identity, unrelated sessions, favorites belonging to retained games, or general user preferences.

## Epic desktop security

- Replace renderer calls to `/api/epic/status`, `/api/epic/token`, `/api/epic/library`, `/api/epic/logout`, and user-specific Epic achievements with typed Electron IPC.
- Remove those credential-bearing public routes. Keep only non-user-specific catalog metadata endpoints if they are still needed.
- Bind any development-only local server explicitly to loopback and do not package it as the Epic authentication boundary.
- Store Legendary under the Electron `userData` tools directory at a pinned version.
- Download from a fixed release artifact, verify a hard-coded SHA-256 before first execution and before updates, write through a temporary file, and replace atomically only after verification.
- Reject mutable `latest` downloads. Verification failure leaves the previous verified binary untouched and produces a safe UI error.
- Execute the fixed verified path with argument arrays, no shell interpolation, bounded timeout, bounded stdout/stderr, and redacted logs.
- Never return an Epic access token, authorization code, Legendary config, or raw process output to React.

## Release security controls

The implementation applies the supplied 20-point checklist as a release gate:

1. API keys stay in environment/secure process scope and are never embedded in the renderer bundle.
2. Secret scanning covers the working tree, Git history, commits, and build artifacts; documented rotation is required for any finding.
3. Database access uses Supabase's public anon key only with RLS; service-role credentials remain server-side.
4. RLS is enabled and tested for profiles, public profiles, user games, and unlink RPC access.
5. Sensitive transport uses TLS; Epic credentials remain in Legendary's local storage and must never be copied into app logs or Supabase.
6. Steam and Supabase mutations verify the bearer session server-side and derive the user ID from it.
7. Electron IPC uses the existing trusted-sender checks plus per-handler allowlists and strict schemas.
8. Profile and game writes use explicit field allowlists; request bodies cannot mass-assign privileged or identity fields.
9. Any backend cookie is `HttpOnly`, `Secure`, and an appropriate `SameSite`; bearer flows avoid unnecessary cookies.
10. Passwords remain delegated to Supabase Auth; the launcher never stores plaintext passwords.
11. Authentication, synchronization, catalog, and unlink endpoints have appropriate per-user/IP rate limits.
12. Bot protection applies to public account creation/authentication surfaces where supported; desktop sync itself relies on authenticated identity and rate limits.
13. SQLite statements and Supabase queries remain parameterized. No input is concatenated into SQL.
14. IPC, HTTP, RPC, and imported game payloads are schema-validated and size-bounded.
15. Errors, logs, IPC responses, and API responses are minimized and redact tokens, paths, secrets, and upstream bodies.
16. Existing uploads are type/size/count restricted and stored under resolved safe paths; platform sync accepts no arbitrary upload.
17. Responses return only fields required by the UI, plus counts and safe progress states.
18. The remote server retains Helmet with a restrictive CSP; Electron pages add a restrictive CSP compatible with bundled assets.
19. Production remote traffic is HTTPS-only. Navigation and external URL opening reject unsafe protocols.
20. CI scans production and development dependencies, fails on agreed high/critical findings, and records reviewed exceptions with expiry.

Steam HTML rendered in game details is sanitized through one allowlisted sanitizer path before `dangerouslySetInnerHTML`. Raw upstream HTML is never rendered directly.

## Backend and database contract

- Introduce one authenticated platform purge contract instead of renderer-issued table-by-table deletes.
- The authenticated user ID comes from the verified Supabase session, not request JSON.
- Platform is a closed enum (`steam`, `epic`). Unknown platforms fail before mutation.
- The RPC/backend operation uses explicit columns and row filters, updates derived summaries, and returns only deletion counts.
- RLS negative tests prove user A cannot inspect or remove user B's games or profile fields.
- Steam disconnect clears all Steam identity fields consistently, including cached profile/avatar and last synchronization timestamp.
- Epic account state is local-only; the cloud stores library-derived rows and summaries but no Epic token or authorization material.

## Failure and recovery

- Sync cancellation or network failure leaves the last valid library visible.
- A successful remote fetch followed by a failed write reports an error and does not publish a new summary.
- Unlink cleanup is idempotent and retryable after an app restart.
- If cloud cleanup is unavailable, the UI remains in an explicit incomplete/error state and offers retry; it does not report full success.
- If local cleanup succeeds before cloud cleanup, removed games are not reimported from legacy cloud rows during the unfinished workflow.
- Logs include operation ID, platform, safe phase, duration, and counts. They exclude user tokens, authorization codes, raw library payloads, and local credential paths.

## Component and service boundaries

- `usePlatformOperations`: shared per-platform state machine and renderer orchestration.
- `PlatformLibrarySkeleton`: platform-aware first-import and refresh skeleton with accessibility support.
- `PlatformRemovalTransition`: reversible fade/blur/collapse presentation.
- `EpicConnectModal`: consumes shared Epic phases instead of owning a disconnected loading lifecycle.
- `Sidebar`, `Home`, and `SettingsPage`: render the shared state without initiating lower-level cleanup calls.
- `platformLifecycle` renderer service: typed calls only; no direct Epic HTTP or table-by-table purge.
- Electron preload/main: validated Epic sync/logout, local transactional purge, progress subscriptions, binary verification, and sanitized results.
- Authenticated server/RPC: Steam unlink and caller-scoped cloud cleanup.

Exact file placement may follow existing project conventions during the implementation plan, but these responsibilities must remain separated.

## Verification and acceptance criteria

- State-machine tests cover every legal transition, duplicate-operation rejection, retry, and reset.
- UI tests prove the skeleton appears only for the synchronizing platform, first import differs from refresh, other tabs remain usable, and reduced motion is respected.
- Epic modal tests cover loader continuity from authentication through initial sync, safe error recovery, and double-submit prevention.
- Unlink tests cover confirmation, reversible animation, disabled controls, success, failure restoration, and platform isolation.
- SQLite integration tests prove games, matching sessions, platform achievement state, cached IDs, and summaries are cleaned in a transaction.
- Supabase/RLS tests prove caller-only deletion, profile field cleanup, summary refresh, and cross-user denial.
- Contract tests prove no Epic token or raw Legendary output reaches HTTP or IPC responses and removed public Epic routes are unavailable.
- Security tests cover IPC sender validation, input limits, URL protocols, HTML sanitization, CSP, response trimming, and log redaction.
- Binary tests cover correct hash, tampered download rejection, safe fallback to an existing verified binary, timeout, and output limits.
- Regression tests prove a failed or empty sync retains existing games and one platform's unlink never affects another.
- Run focused tests, the full Vitest suite, typecheck, lint, production build, production/development dependency audits, secret scan, and packaged Windows smoke tests.
- Manual acceptance covers Epic login, first sync, resync, Steam sync, both platform tabs, disconnect success/failure, offline recovery, app restart during an incomplete cleanup, keyboard/gamepad navigation, and reduced motion.

## Rollout

1. Land database/RLS cleanup primitives and negative tests.
2. Land secure Epic IPC and verified binary management while removing public credential routes.
3. Land the shared operation state, skeletons, login progress, and unlink transitions.
4. Enable full cleanup and summary refresh behind a development flag, exercise migration/legacy-data cases, then make it the only desktop path.
5. Complete the security release gate and packaged Windows smoke test before distribution.

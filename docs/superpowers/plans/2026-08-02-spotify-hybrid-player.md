# Spotify Hybrid Player Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the approved hybrid Spotify dashboard with responsive playback, live search, queue, shuffle and real Spotify playlist management, while eliminating game-card flicker during background refreshes.

**Architecture:** Keep `useSpotifyPlayer` as the playback orchestrator, move queue and playlist calls into typed services, and compose `SpotifyPage` from stable independently updating panels. Keep PKCE and remote playback fallback. Split initial Home loading from background refresh so `GameRow` never unmounts after the first snapshot.

**Tech Stack:** Electron, React 19, TypeScript, Vitest, Testing Library, Spotify Web Playback SDK, Spotify Web API, Framer Motion and Tailwind CSS.

## Global Constraints

- Preserve Checkpoint typography, dark flat design, and current palette; Spotify green is an active-state accent.
- Never add a Spotify Client Secret to Electron, Vite, or renderer code.
- Use current `/playlists/{id}/items` endpoints, never deprecated playlist `/tracks` endpoints.
- Search debounce is 350 ms and ignores fewer than two trimmed characters.
- UI motion is 140-220 ms and respects reduced-motion and low-performance preferences.
- Preserve unrelated uncommitted profile, privacy, and Spotify diagnostic changes.

---

### Task 1: Keep game cards mounted during library refresh

**Files:**
- Modify: `src/pages/Home.tsx`
- Create: `src/utils/libraryLoading.ts`
- Test: `tests/library-loading.test.ts`

**Interfaces:**
- Produces `resolveLibraryLoadingState(hasUsableSnapshot: boolean)` for initial versus background loading.

- [ ] **Step 1: Write the failing regression test**

```ts
expect(resolveLibraryLoadingState(true)).toEqual({
  showSkeleton: false,
  backgroundRefreshing: true,
});
expect(resolveLibraryLoadingState(false)).toEqual({
  showSkeleton: true,
  backgroundRefreshing: false,
});
```

- [ ] **Step 2: Run `npx vitest run tests/library-loading.test.ts`**

Expected: FAIL because the helper does not exist.

- [ ] **Step 3: Implement the helper and state split**

```ts
export const resolveLibraryLoadingState = (hasUsableSnapshot: boolean) => ({
  showSkeleton: !hasUsableSnapshot,
  backgroundRefreshing: hasUsableSnapshot,
});
```

Add `hasLoadedLibrary` and `isLibraryRefreshing` to Home. `refreshLibrary` uses the skeleton only before the first successful snapshot, updates the array atomically, and preserves selection by game ID. Background achievement, profile, presence, and Steam refreshes keep `GameRow` mounted.

- [ ] **Step 4: Run `npx vitest run tests/library-loading.test.ts tests/local-game-library.test.ts`**

Expected: PASS.

### Task 2: Add typed Spotify queue, shuffle, and playlist services

**Files:**
- Modify: `src/services/spotify.ts`
- Create: `src/services/spotifyPlaylists.ts`
- Modify: `tests/spotify-service.test.ts`
- Create: `tests/spotify-playlists.test.ts`

**Interfaces:**
- Produce `SpotifyQueueSnapshot`, `SpotifyPlaylistSummary`, `SpotifyPlaylistDetails`, `CreateSpotifyPlaylistInput`.
- Produce `getSpotifyQueue`, `addSpotifyTrackToQueue`, `setSpotifyShuffle`, `listSpotifyPlaylists`, `createSpotifyPlaylist`, `getSpotifyPlaylist`, `addSpotifyPlaylistItems`, `removeSpotifyPlaylistItem`, `reorderSpotifyPlaylistItem`.

- [ ] **Step 1: Write failing queue/shuffle tests**

Assert `GET /me/player/queue` maps current/upcoming tracks, `POST /me/player/queue` encodes the URI and device, and `PUT /me/player/shuffle` sends `state` and `device_id`.

- [ ] **Step 2: Run `npx vitest run tests/spotify-service.test.ts`**

Expected: FAIL on missing exports.

- [ ] **Step 3: Implement queue/shuffle operations**

Extract `mapSpotifyTrack` from search mapping and reuse it for queue payloads. Continue using `spotifyRequest` so 401, 403 and 429 behavior stays centralized.

- [ ] **Step 4: Write failing playlist tests**

Assert `POST /me/playlists` includes name, description and `public`; item add/remove/reorder uses `/playlists/{id}/items`; mutations return and retain `snapshot_id`.

- [ ] **Step 5: Run `npx vitest run tests/spotify-playlists.test.ts`**

Expected: FAIL because the service does not exist.

- [ ] **Step 6: Implement playlist service and rerun both suites**

Run: `npx vitest run tests/spotify-service.test.ts tests/spotify-playlists.test.ts`

Expected: PASS.

### Task 3: Expand scopes and detect reauthorization

**Files:**
- Modify: `electron/spotify-auth.cjs`
- Modify: `electron/spotify-auth-manager.cjs`
- Modify: `tests/spotify-auth.test.ts`
- Modify: `tests/spotify-auth-manager.test.ts`

**Interfaces:**
- Export `hasRequiredSpotifyScopes(grantedScope: string)`.
- `getStatus()` returns `requiresReauthorization` without exposing tokens.

- [ ] **Step 1: Write failing tests for these scopes**

```ts
expect(SPOTIFY_SCOPES).toEqual(expect.arrayContaining([
  "playlist-read-private",
  "playlist-read-collaborative",
  "playlist-modify-public",
  "playlist-modify-private",
]));
```

Also assert partial stored scopes require reauthorization and the complete set does not.

- [ ] **Step 2: Run auth tests and confirm failure**

Run: `npx vitest run tests/spotify-auth.test.ts tests/spotify-auth-manager.test.ts`

- [ ] **Step 3: Add scopes, set comparison, and status projection**

Preserve the token response `scope`; never introduce `client_secret`.

- [ ] **Step 4: Rerun auth and IPC tests**

Run: `npx vitest run tests/spotify-auth.test.ts tests/spotify-auth-manager.test.ts tests/spotify-ipc-contract.test.ts`

Expected: PASS.

### Task 4: Make playback optimistic and expose queue state

**Files:**
- Modify: `src/hooks/useSpotifyPlayer.ts`
- Modify: `src/services/spotifyPlayback.ts`
- Modify: `tests/use-spotify-player.test.tsx`
- Modify: `tests/spotify-playback.test.ts`

**Interfaces:**
- Extend the controller with `queue`, `shuffle`, `pendingCommands`, `refreshQueue`, `addToQueue`, and `toggleShuffle`.

- [ ] **Step 1: Write failing optimistic-control tests**

Prove remote play/pause changes visible state before the request resolves, duplicate commands are ignored while pending, and rejection restores the previous snapshot.

- [ ] **Step 2: Run focused tests and confirm failure**

Run: `npx vitest run tests/use-spotify-player.test.tsx tests/spotify-playback.test.ts`

- [ ] **Step 3: Implement one optimistic command runner**

Keep authoritative snapshots in refs. Apply expected state immediately, execute SDK/API work, reconcile immediately plus one short follow-up, and roll back on failure. Passive remote reconciliation remains slower than command reconciliation.

- [ ] **Step 4: Write failing queue/shuffle controller tests**

Assert initial queue load, refresh after play/next/add, last-good queue retention on refresh failure, and shuffle rollback.

- [ ] **Step 5: Implement controller queue/shuffle state and rerun**

Run: `npx vitest run tests/use-spotify-player.test.tsx tests/spotify-playback.test.ts tests/spotify-service.test.ts`

Expected: PASS.

### Task 5: Add live-search and playlist state hooks

**Files:**
- Create: `src/hooks/useSpotifySearch.ts`
- Create: `src/hooks/useSpotifyPlaylists.ts`
- Create: `tests/use-spotify-search.test.tsx`
- Create: `tests/use-spotify-playlists.test.tsx`

**Interfaces:**
- `useSpotifySearch(searchFn)` returns query, setter, results, status, and error.
- `useSpotifyPlaylists(tokenProvider)` returns list, active details, per-action pending state, and create/add/remove/reorder actions.

- [ ] **Step 1: Write failing fake-timer search tests**

Cover 350 ms debounce, two-character minimum, one request after idle, and stale-response rejection.

- [ ] **Step 2: Run `npx vitest run tests/use-spotify-search.test.tsx`**

Expected: FAIL because the hook does not exist.

- [ ] **Step 3: Implement generation-safe live search**

Use a request-generation ref, clear short queries, and never let an older promise replace newer results.

- [ ] **Step 4: Write failing playlist hook tests**

Cover load, create only after a returned Spotify ID, mutations refreshing only active content, and preserving current content on failure.

- [ ] **Step 5: Implement and rerun hook suites**

Run: `npx vitest run tests/use-spotify-search.test.tsx tests/use-spotify-playlists.test.tsx`

Expected: PASS.

### Task 6: Build the approved hybrid Spotify UI

**Files:**
- Modify: `src/components/spotify/SpotifyPage.tsx`
- Create: `src/components/spotify/SpotifyNavigation.tsx`
- Create: `src/components/spotify/SpotifyNowPlaying.tsx`
- Create: `src/components/spotify/SpotifyQueuePanel.tsx`
- Create: `src/components/spotify/SpotifySearchResults.tsx`
- Create: `src/components/spotify/SpotifyPlaylistEditor.tsx`
- Create: `src/components/spotify/SpotifyTransport.tsx`
- Modify: `src/index.css`
- Modify: `tests/spotify-dock.test.tsx`
- Modify: `tests/spotify-surface-contract.test.ts`
- Create: `tests/spotify-page.test.tsx`

**Interfaces:**
- Presentational components receive typed state/callback props and never call Electron IPC or Spotify endpoints directly.

- [ ] **Step 1: Write failing hierarchy and persistence tests**

Assert labeled left navigation, center now-playing/search/playlist region, right Next up queue, and persistent bottom transport. Switching views must not unmount the transport. Search has no submit dependency.

- [ ] **Step 2: Run UI tests and confirm failure**

Run: `npx vitest run tests/spotify-page.test.tsx tests/spotify-dock.test.tsx tests/spotify-surface-contract.test.ts`

- [ ] **Step 3: Implement the stable three-column shell**

Desktop columns are approximately 220px, flexible center, and 300px. Auxiliary panels collapse below desktop. Mount `SpotifyTransport` outside the active center view.

- [ ] **Step 4: Implement hero and queue hierarchy**

Center the current cover with restrained adjacent covers. Right panel promotes `queue.upcoming[0]` as Next up and lists the rest. Motion stays between 140 and 220 ms.

- [ ] **Step 5: Implement live results and playlist editor**

Each result exposes Play now, Add to queue, and Add to playlist. Playlist creation collects name, description, and public/private visibility. Editable playlists support remove and reorder.

- [ ] **Step 6: Add explicit gamepad navigation and reduced-motion behavior**

Connect left navigation, center, queue, and transport using existing gamepad focus metadata. Reuse existing conditional controller focus styling.

- [ ] **Step 7: Rerun UI tests**

Run: `npx vitest run tests/spotify-page.test.tsx tests/spotify-dock.test.tsx tests/spotify-surface-contract.test.ts`

Expected: PASS.

### Task 7: Full verification

**Files:**
- Modify only integration files proven necessary by failing tests.

- [ ] **Step 1: Run all focused Spotify and library tests**

Run every test created or modified in Tasks 1-6 plus existing Spotify auth, IPC, playback, dock, and surface contract tests.

- [ ] **Step 2: Run the complete repository test suite**

Run: `npm test`

Expected: zero failures.

- [ ] **Step 3: Run production build**

Run: `npm run build`

Expected: TypeScript and Vite exit 0.

- [ ] **Step 4: Run lint and diff validation**

Run: `npm run lint`

Expected: zero lint errors; unrelated existing warnings may remain.

Run: `git diff --check`

Expected: exit 0.

- [ ] **Step 5: Review scope before handoff**

Confirm no Client Secret, no deprecated playlist endpoint, no lost uncommitted profile/privacy fixes, and no version change unless separately requested.

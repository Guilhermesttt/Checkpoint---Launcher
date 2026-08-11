# Retro Game Details Experience Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the temporary retro details modal and launch transition with a full-screen, accessible retro details experience whose room and console follow the selected game and whose achievements come from a backend-only RetroAchievements integration.

**Architecture:** Keep `GameDetailPanel.tsx` unchanged and build small retro-specific units. The renderer talks only to authenticated `/api/retroachievements/*` launcher routes; a dependency-injected server router owns the Web API key, ULID resolution, caching, response normalization, and safe errors. The details screen keeps one Canvas mounted while HTML tabs, the fixed case, and play controls update independently.

**Tech Stack:** React 19, TypeScript 6, React Three Fiber 9, Drei 10, Three.js 0.184, Framer Motion 12, Express 5, Supabase, Vitest 4, Testing Library.

## Global Constraints

- Do not change `src/components/GameDetailPanel.tsx`.
- Preserve the existing retro palette; use Unbounded for display copy and Inter for body copy.
- Expose only `JOGAR`, `SOBRE`, and `CONQUISTAS` in retro details.
- Only the `JOGAR` action inside retro details may launch the selected game.
- Preserve keyboard, gamepad, semantic sounds, focus restoration, reduced motion, and close-on-launch behavior.
- `RETROACHIEVEMENTS_API_KEY` is backend-only: never add it to Vite variables, renderer, preload, Electron files, logs, response bodies, or packaged artifacts.
- Store the validated RetroAchievements ULID as the stable account identity; retain username only for display.
- Search RetroAchievements by title and console on the backend and require explicit user confirmation before saving a game ID.
- Support PS2, PS1, SNES, NES, N64, Genesis/Mega Drive, GBA, Switch, and PSP with distinct production console entries.
- Ship source, author, license, attribution, and local filename for every third-party 3D model; reject ripped, noncommercial, no-derivatives, or ambiguous assets.
- Preserve all unrelated staged and unstaged user work in the dirty worktree.

---

## File Structure

- `server/retroachievements.mjs`: dependency-injected Express router, upstream adapter, normalization, cache, title matching, secret-safe errors.
- `server/index.mjs`: mount the router with existing Supabase authentication, profile persistence, and rate limiting.
- `supabase/migrations/20260810120000_retroachievements_identity.sql`: profile ULID and display username columns.
- `src/services/retroAchievements.ts`: authenticated renderer client and shared safe response types.
- `src/features/retro/RetroAchievementsSettingsCard.tsx`: username link/disconnect control used by launcher settings.
- `src/features/retro/RetroAchievementsPanel.tsx`: achievements states and list.
- `src/features/retro/RetroDetailTabs.tsx`: semantic three-tab content panel.
- `src/features/retro/RetroGameDetailsScreen.tsx`: full-screen shell, focus, launch, close, and input routing.
- `src/features/retro/RetroDetailScene.tsx`: persistent Canvas composition.
- `src/features/retro/RetroDetailCase.tsx`: fixed case and play presentation.
- `src/features/retro/RetroConsoleModelRegistry.tsx`: platform aliases, lazy GLB components, transforms, fallback, attribution contract.
- `src/features/retro/retroConsoleAssets.ts`: typed nine-model source/license manifest.
- `assets/THIRD_PARTY_3D_ASSETS.md`: packaged attribution notice.
- `scripts/verify-retro-assets.cjs`: fail release verification when a model, attribution field, or forbidden license is missing.

### Task 1: Persist the stable RetroAchievements identity

**Files:**
- Create: `supabase/migrations/20260810120000_retroachievements_identity.sql`
- Modify: `src/types/domain.ts`
- Modify: `src/auth/AuthProvider.tsx`
- Modify: `tests/supabase-schema-contract.test.ts`
- Test: `tests/auth-provider-profile.test.tsx`

**Interfaces:**
- Produces: `UserProfile.retroAchievementsUlid?: string` and `UserProfile.retroAchievementsUsername?: string`.
- Produces DB columns `retroachievements_ulid text` and `retroachievements_username text` on `public.profiles`.

- [ ] **Step 1: Write failing schema and mapping tests**

```ts
expect(schema).toMatch(/retroachievements_ulid\s+text/i);
expect(schema).toMatch(/retroachievements_username\s+text/i);
expect(profile).toMatchObject({
  retroAchievementsUlid: "00003EMFWR7XB8SDPEHB3K56ZQ",
  retroAchievementsUsername: "MaxMilyin",
});
```

- [ ] **Step 2: Run tests and confirm the missing columns/mapping fail**

Run: `npx vitest run tests/supabase-schema-contract.test.ts tests/auth-provider-profile.test.tsx`
Expected: FAIL because the migration and camel-case fields do not exist.

- [ ] **Step 3: Add the migration and profile mapping**

```sql
alter table public.profiles
  add column if not exists retroachievements_ulid text,
  add column if not exists retroachievements_username text;

create unique index if not exists profiles_retroachievements_ulid_unique
  on public.profiles (retroachievements_ulid)
  where retroachievements_ulid is not null;
```

Map `retroachievements_ulid` and `retroachievements_username` in `toProfile` without changing the existing Steam or Discord fields.

- [ ] **Step 4: Run the focused tests**

Run: `npx vitest run tests/supabase-schema-contract.test.ts tests/auth-provider-profile.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit the identity contract**

```bash
git add supabase/migrations/20260810120000_retroachievements_identity.sql src/types/domain.ts src/auth/AuthProvider.tsx tests/supabase-schema-contract.test.ts tests/auth-provider-profile.test.tsx
git commit -m "feat(retro): persist RetroAchievements identity"
```

### Task 2: Add the secret-safe RetroAchievements backend

**Files:**
- Create: `server/retroachievements.mjs`
- Modify: `server/index.mjs`
- Create: `tests/retroachievements-api.test.ts`

**Interfaces:**
- Produces: `createRetroAchievementsRouter({ apiKey, fetchImpl, requireUser, loadProfile, saveProfile, now })`.
- Produces authenticated routes:
  - `POST /api/retroachievements/link` with `{ username: string }`.
  - `DELETE /api/retroachievements/link`.
  - `GET /api/retroachievements/games/search?title=<title>&console=<platform>`.
  - `GET /api/retroachievements/games/:gameId/progress`.
- Safe errors use `{ error: string, code: "RA_NOT_CONFIGURED" | "RA_INVALID_USERNAME" | "RA_NOT_LINKED" | "RA_UNSUPPORTED_CONSOLE" | "RA_UPSTREAM_UNAVAILABLE" | "RA_INVALID_RESPONSE" }`.

- [ ] **Step 1: Write failing adapter and router tests with fixture fetches**

```ts
const router = createRetroAchievementsRouter({
  apiKey: "server-secret",
  fetchImpl,
  requireUser: (req, _res, next) => { req.firebaseUser = { uid: "user-1" }; next(); },
  loadProfile: vi.fn().mockResolvedValue({ retroachievements_ulid: "00003EMFWR7XB8SDPEHB3K56ZQ" }),
  saveProfile,
  now: () => 1_723_307_200_000,
});

expect(saveProfile).toHaveBeenCalledWith("user-1", {
  retroachievements_ulid: "00003EMFWR7XB8SDPEHB3K56ZQ",
  retroachievements_username: "MaxMilyin",
});
expect(JSON.stringify(response.body)).not.toContain("server-secret");
```

Cover ULID link, invalid username, console alias resolution, cached `API_GetConsoleIDs.php`, cached `API_GetGameList.php?f=1`, explicit title results, personal normal/hardcore progress, stale-cache fallback, and upstream URL redaction.

- [ ] **Step 2: Run the new server tests and confirm the module is missing**

Run: `npx vitest run tests/retroachievements-api.test.ts`
Expected: FAIL resolving `server/retroachievements.mjs`.

- [ ] **Step 3: Implement the router and normalizers**

Use the official endpoints exactly:

```js
const ENDPOINTS = {
  profile: "API_GetUserProfile.php",
  consoles: "API_GetConsoleIDs.php",
  games: "API_GetGameList.php",
  progress: "API_GetGameInfoAndUserProgress.php",
};
```

Resolve systems dynamically from `API_GetConsoleIDs.php?y=<key>&a=1&g=1`; normalize the nine launcher aliases against the returned system names. Cache systems for 24 hours, per-system game lists for 6 hours, and per-user progress for 5 minutes. Add `y` only inside the upstream URL builder, never to errors or logs. Convert relative image paths to `https://media.retroachievements.org` URLs and sort search results by normalized exact match, prefix match, then token overlap.

- [ ] **Step 4: Mount the router through existing auth and profile helpers**

```js
app.use("/api/retroachievements", steamPrivateLimiter, createRetroAchievementsRouter({
  apiKey: process.env.RETROACHIEVEMENTS_API_KEY,
  fetchImpl: fetch,
  requireUser: requireFirebaseUser,
  loadProfile: async (uid) => supabaseAdmin.from("profiles").select("retroachievements_ulid, retroachievements_username").eq("uid", uid).maybeSingle(),
  saveProfile: updateLinkedAccountProfile,
}));
```

Adapt `loadProfile` so the router receives the row rather than a Supabase result wrapper.

- [ ] **Step 5: Run backend tests**

Run: `npx vitest run tests/retroachievements-api.test.ts tests/api.test.ts`
Expected: PASS with no external network request.

- [ ] **Step 6: Commit the backend boundary**

```bash
git add server/retroachievements.mjs server/index.mjs tests/retroachievements-api.test.ts
git commit -m "feat(retro): add protected RetroAchievements backend"
```

### Task 3: Add the renderer client and account settings card

**Files:**
- Create: `src/services/retroAchievements.ts`
- Create: `src/features/retro/RetroAchievementsSettingsCard.tsx`
- Modify: `src/pages/SettingsPage.tsx`
- Modify: `src/pages/Home.tsx`
- Create: `tests/retro-achievements-settings.test.tsx`
- Create: `tests/retro-achievements-service.test.ts`

**Interfaces:**
- Produces: `linkRetroAchievements(username: string): Promise<RetroAchievementsIdentity>`.
- Produces: `disconnectRetroAchievements(): Promise<void>`.
- Produces: `searchRetroAchievementGames(title: string, consoleName: string): Promise<RetroAchievementsGameMatch[]>`.
- Produces: `getRetroAchievementProgress(gameId: number): Promise<RetroAchievementsProgress>`.
- `RetroAchievementsIdentity = { ulid: string; username: string; avatarUrl?: string; totalPoints: number }`.

- [ ] **Step 1: Write failing authenticated-client tests**

```ts
await linkRetroAchievements(" MaxMilyin ");
expect(fetch).toHaveBeenCalledWith(apiUrl("/api/retroachievements/link"), expect.objectContaining({
  method: "POST",
  headers: expect.objectContaining({ Authorization: "Bearer session-token" }),
  body: JSON.stringify({ username: "MaxMilyin" }),
}));
```

Assert that neither the service file nor emitted requests contain `RETROACHIEVEMENTS_API_KEY` or a `y` query parameter.

- [ ] **Step 2: Run the new client tests and confirm failure**

Run: `npx vitest run tests/retro-achievements-service.test.ts tests/retro-achievements-settings.test.tsx`
Expected: FAIL because the service and settings card do not exist.

- [ ] **Step 3: Implement the typed client and settings card**

Follow `src/services/steam.ts` for Supabase session headers. The card accepts:

```ts
interface RetroAchievementsSettingsCardProps {
  username?: string;
  connected: boolean;
  busy: boolean;
  error?: string;
  onConnect(username: string): Promise<void>;
  onDisconnect(): Promise<void>;
}
```

Use the existing connection-card palette and radius hierarchy. Validate 2-32 visible characters client-side only for immediate feedback; backend validation remains authoritative.

- [ ] **Step 4: Wire settings through Home**

Add local busy/error state, call `refreshProfile()` after link/disconnect, play existing `select`/`back` sounds, and pass `userProfile?.retroAchievementsUsername` to `SettingsPageV2`. Do not add a browser OAuth flow.

- [ ] **Step 5: Run focused tests**

Run: `npx vitest run tests/retro-achievements-service.test.ts tests/retro-achievements-settings.test.tsx tests/settings-page.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit the account UI**

```bash
git add src/services/retroAchievements.ts src/features/retro/RetroAchievementsSettingsCard.tsx src/pages/SettingsPage.tsx src/pages/Home.tsx tests/retro-achievements-service.test.ts tests/retro-achievements-settings.test.tsx
git commit -m "feat(retro): link RetroAchievements accounts in settings"
```

### Task 4: Add stable game IDs and search-confirm editing

**Files:**
- Modify: `src/features/retro/retroCollection.ts`
- Modify: `src/features/retro/RetroAddGameModal.tsx`
- Modify: `src/pages/RetroGamingPage.tsx`
- Modify: `tests/retro-collection.test.ts`
- Create: `tests/retro-add-game-modal.test.tsx`

**Interfaces:**
- Extends `RetroGame` with `retroAchievementsGameId?: number` and `description?: string`.
- The modal stores an ID only after `onConfirm` on a displayed `RetroAchievementsGameMatch`.

- [ ] **Step 1: Write failing type/data and confirmation tests**

```ts
fireEvent.change(screen.getByLabelText("Título do Jogo"), { target: { value: "God of War" } });
fireEvent.click(screen.getByRole("button", { name: "Buscar na RetroAchievements" }));
await screen.findByText("God of War");
fireEvent.click(screen.getByRole("button", { name: "Usar resultado 20507" }));
fireEvent.click(screen.getByRole("button", { name: "Salvar jogo" }));
expect(onSaveGame).toHaveBeenCalledWith(expect.objectContaining({ retroAchievementsGameId: 20507 }));
```

Also assert that changing title or console after confirmation clears the previous ID.

- [ ] **Step 2: Run focused tests and confirm failure**

Run: `npx vitest run tests/retro-collection.test.ts tests/retro-add-game-modal.test.tsx`
Expected: FAIL because the field and confirmation UI are absent.

- [ ] **Step 3: Implement the search-confirm flow**

Debounce only user typing; the explicit search button invokes `searchRetroAchievementGames(title, consoleType)`. Render safe loading, unsupported-console, no-results, and retry states. Never pick the first response automatically. Preserve `retroAchievementsGameId` while editing unchanged title/console.

- [ ] **Step 4: Add the confirmed built-in IDs**

Populate these verified records: God of War `2782`, Castlevania: Symphony of the Night `11240`, Super Mario World `228`, Chrono Trigger `319`, Grand Theft Auto: San Andreas `2772`, Tekken 3 `11259`, and Silent Hill 2 `1324`. Leave The Legend of Zelda: Tears of the Kingdom without an ID because no matching supported RetroAchievements system/game record was confirmed; the UI must show the game-not-linked/unsupported-console state rather than guessing.

- [ ] **Step 5: Run tests and commit**

Run: `npx vitest run tests/retro-collection.test.ts tests/retro-add-game-modal.test.tsx`
Expected: PASS.

```bash
git add src/features/retro/retroCollection.ts src/features/retro/RetroAddGameModal.tsx src/pages/RetroGamingPage.tsx tests/retro-collection.test.ts tests/retro-add-game-modal.test.tsx
git commit -m "feat(retro): confirm RetroAchievements game matches"
```

### Task 5: Replace the old details action with the full-screen shell

**Files:**
- Delete: `src/features/retro/RetroGameDetailPanel.tsx`
- Delete: `tests/retro-game-detail-panel.test.tsx`
- Create: `src/features/retro/RetroGameDetailsScreen.tsx`
- Create: `src/features/retro/RetroDetailTabs.tsx`
- Modify: `src/features/retro/RetroInterface.tsx`
- Modify: `src/pages/RetroGamingPage.tsx`
- Modify: `tests/retro-gaming-page.test.tsx`
- Create: `tests/retro-game-details-screen.test.tsx`

**Interfaces:**
- Produces `RetroGameDetailsScreenProps = { game: RetroGame; isOpen: boolean; onClose(): void; onEditGame(game: RetroGame): void; playSound(type: SoundEffectType): void; restoreFocusRef?: React.RefObject<HTMLElement | null> }`.
- Produces tabs typed as `type RetroDetailTab = "play" | "about" | "achievements"`.

- [ ] **Step 1: Replace old tests with failing entry/navigation tests**

Assert `DETALHES` is absent, a second click on the active case opens details, Enter and gamepad X open details, open does not call `launchGame`, only three tabs exist, Escape/Backspace closes, and focus returns to the selected case.

```ts
expect(screen.queryByText("DETALHES")).not.toBeInTheDocument();
fireEvent.click(screen.getByRole("button", { name: /God of War, 2005/ }));
fireEvent.click(screen.getByRole("button", { name: /God of War, 2005/ }));
expect(screen.getByRole("dialog", { name: "Detalhes de God of War" })).toBeInTheDocument();
expect(launchGame).not.toHaveBeenCalled();
```

- [ ] **Step 2: Run tests and confirm the new screen is missing**

Run: `npx vitest run tests/retro-gaming-page.test.tsx tests/retro-game-details-screen.test.tsx`
Expected: FAIL on old action/transition behavior.

- [ ] **Step 3: Build the full-screen semantic shell**

Use `role="dialog"`, `aria-modal="true"`, a tablist, close button, bottom control hints, and one scrollable left panel at `min(44vw, 690px)`. Trap Tab/Shift+Tab within the screen. Initial focus is the JOGAR tab; close restores the shelf-case ref. Lazy-load the screen from `RetroGamingPage` with a palette-preserving loading shell.

- [ ] **Step 4: Reuse the launcher contract only inside JOGAR**

```ts
await launchGame({
  id: game.id,
  title: game.title,
  image: game.coverImage || "",
  publisher: game.publisher,
  executablePath: game.executablePath,
  launcherType: "local",
  source: "manual",
});
```

If no executable is configured, render the existing edit action instead of calling the launcher. Honor the current close-on-launch preference.

- [ ] **Step 5: Run tests and commit**

Run: `npx vitest run tests/retro-gaming-page.test.tsx tests/retro-game-details-screen.test.tsx`
Expected: PASS.

```bash
git add -A src/features/retro/RetroGameDetailPanel.tsx tests/retro-game-detail-panel.test.tsx src/features/retro/RetroGameDetailsScreen.tsx src/features/retro/RetroDetailTabs.tsx src/features/retro/RetroInterface.tsx src/pages/RetroGamingPage.tsx tests/retro-gaming-page.test.tsx tests/retro-game-details-screen.test.tsx
git commit -m "feat(retro): replace details action with full-screen experience"
```

### Task 6: Render personal normal and hardcore achievements

**Files:**
- Create: `src/features/retro/RetroAchievementsPanel.tsx`
- Modify: `src/features/retro/RetroDetailTabs.tsx`
- Create: `tests/retro-achievements-panel.test.tsx`

**Interfaces:**
- Consumes `getRetroAchievementProgress(gameId: number)` from Task 3.
- Produces visual states `unlinked-account`, `unlinked-game`, `loading`, `ready`, `empty`, `cached`, and `error`.

- [ ] **Step 1: Write failing state and achievement tests**

```ts
expect(screen.getByText("4 / 12")).toBeInTheDocument();
expect(screen.getByText("Hardcore 33%")).toBeInTheDocument();
expect(screen.getByText("Masterizado")).toBeInTheDocument();
expect(screen.getByRole("img", { name: "That Was Easy desbloqueada" })).toHaveAttribute("src", expect.stringContaining("Badge"));
```

Cover locked, normal-only, hardcore, earned dates, points, mastered award, no progress, missing account, missing game ID, stale cached data, retry, and safe API errors.

- [ ] **Step 2: Run tests and confirm failure**

Run: `npx vitest run tests/retro-achievements-panel.test.tsx`
Expected: FAIL because the panel is missing.

- [ ] **Step 3: Implement accessible progress UI**

Keep achievement information in HTML. Use semantic progress labels and decorative Canvas-independent images. The no-account action invokes a supplied `onOpenSettingsConnections` callback; the no-game action invokes `onEditGame(game)`.

- [ ] **Step 4: Run tests and commit**

Run: `npx vitest run tests/retro-achievements-panel.test.tsx tests/retro-game-details-screen.test.tsx`
Expected: PASS.

```bash
git add src/features/retro/RetroAchievementsPanel.tsx src/features/retro/RetroDetailTabs.tsx tests/retro-achievements-panel.test.tsx tests/retro-game-details-screen.test.tsx
git commit -m "feat(retro): show personal RetroAchievements progress"
```

### Task 7: Add the nine-console registry and licensed asset gate

**Files:**
- Create: `src/features/retro/retroConsoleAssets.ts`
- Create: `src/features/retro/RetroConsoleModelRegistry.tsx`
- Create: `tests/retro-console-registry.test.ts`
- Create: `assets/THIRD_PARTY_3D_ASSETS.md`
- Create: `scripts/verify-retro-assets.cjs`
- Modify: `package.json`
- Add nine optimized GLBs under: `src/assets/3D_OBJS/consoles/`

**Interfaces:**
- Produces `resolveRetroConsole(consoleName: string): RetroConsoleAsset`.
- `RetroConsoleAsset = { key; aliases; modelUrl; sourceUrl; author; license: "CC-BY-4.0"; attribution; filename; transform: { targetHeight; position; rotation; scale } }`.

- [ ] **Step 1: Write failing completeness, alias, and license tests**

```ts
expect(REQUIRED_RETRO_CONSOLES).toEqual(["ps2", "ps1", "snes", "nes", "n64", "genesis", "gba", "switch", "psp"]);
for (const key of REQUIRED_RETRO_CONSOLES) {
  const asset = RETRO_CONSOLE_ASSETS[key];
  expect(asset.license).toBe("CC-BY-4.0");
  expect(asset.sourceUrl).toMatch(/^https:\/\/sketchfab\.com\/3d-models\//);
  expect(asset.transform.targetHeight).toBeGreaterThan(0);
}
expect(resolveRetroConsole("Mega Drive").key).toBe("genesis");
```

- [ ] **Step 2: Run the registry test and confirm failure**

Run: `npx vitest run tests/retro-console-registry.test.ts`
Expected: FAIL because the registry is missing.

- [ ] **Step 3: Import only these approved CC BY source records**

- PS2: Jeffrey fan 2000 — `https://sketchfab.com/3d-models/ps2-console-b20d0f22228b49e1b06ac252d0a799f3`
- PS1: Apogee — `https://sketchfab.com/3d-models/sony-playstation-1-6934760427704b7c93d9a2db63d952c8`
- SNES: Taha.D.Bahae Art — `https://sketchfab.com/3d-models/nintendo-snes-03-9eb85627097f4b9ab1a6ac9ece9e4ad6`
- NES: yamato1122 — `https://sketchfab.com/3d-models/nintendo-classic-game-console-nes-4f8bd5f4144c425b9334aefd7edb9962`
- N64: Ethanboor — `https://sketchfab.com/3d-models/nintendo-64-816d53eca00e4f3192a8d23f62388472`
- Genesis: Zerescas — `https://sketchfab.com/3d-models/sega-genesis-model-2-sega-mega-drive-d8feaa413cc847a599e6a484cc4ed2b6`
- GBA: danhearn — `https://sketchfab.com/3d-models/gameboy-advance-46cf0c039d0440c794d406d166aa5d2f`
- Switch: HarrisonHag1 — `https://sketchfab.com/3d-models/nintendo-switch-c73fadccfdc547f9958fd8a1cdbe4811`
- PSP: Ilya Ostrovsky — `https://sketchfab.com/3d-models/sony-psp-dca89d10ec304d0cab76837750df7761`

Download through the licensors' normal download flow, retain the generated attribution evidence, convert to GLB without changing the license, remove unused cameras/lights, cap textures at 2048px, and run `npx gltf-transform optimize input.glb output.glb --texture-compress webp` only if the tool is installed locally. Do not scrape or bypass source access controls.

- [ ] **Step 4: Implement lazy model rendering and a failure placeholder**

Each asset gets a distinct `React.lazy` wrapper so only the selected console GLB loads. Clone the GLTF scene before material adaptation, ground it with `getGroundedModelTransform`, and keep the fallback operational when loading rejects.

- [ ] **Step 5: Add the packaged verification command**

Add `"verify:retro-assets": "node scripts/verify-retro-assets.cjs"`. The script reads the manifest, verifies all nine local files, rejects `NC`, `ND`, unknown, or blank license fields, verifies matching attribution text, and exits nonzero on any violation.

- [ ] **Step 6: Run tests and asset verification, then commit**

Run: `npx vitest run tests/retro-console-registry.test.ts && npm run verify:retro-assets`
Expected: PASS with nine GLBs and nine attribution entries.

```bash
git add src/features/retro/retroConsoleAssets.ts src/features/retro/RetroConsoleModelRegistry.tsx src/assets/3D_OBJS/consoles assets/THIRD_PARTY_3D_ASSETS.md scripts/verify-retro-assets.cjs package.json tests/retro-console-registry.test.ts
git commit -m "feat(retro): add licensed platform console models"
```

### Task 8: Compose the fixed retro room and case

**Files:**
- Create: `src/features/retro/RetroDetailScene.tsx`
- Create: `src/features/retro/RetroDetailCase.tsx`
- Modify: `src/features/retro/RetroPlayScene.tsx`
- Modify: `src/features/retro/retroSceneLayout.ts`
- Modify: `src/features/retro/RetroGameDetailsScreen.tsx`
- Create: `tests/retro-detail-scene.test.tsx`
- Modify: `tests/retro-play-scene.test.ts`
- Modify: `tests/retro-play-scene-cleanup.test.tsx`

**Interfaces:**
- `RetroDetailSceneProps = { game: RetroGame; reducedMotion: boolean }`.
- Fixed composition: TV left, platform console right, controller foreground, game stack above TV, low lateral camera; only TV artwork, case, and console entry vary.

- [ ] **Step 1: Write failing composition and lifecycle tests**

Assert one Canvas remains mounted across tab changes, `resolveRetroConsole(game.console)` drives the hardware component, camera constants are finite, the case is fixed/non-draggable, reduced motion removes entry translation, and unmount before texture/GLB completion does not call `dispose` on null.

- [ ] **Step 2: Run focused scene tests and confirm failure**

Run: `npx vitest run tests/retro-detail-scene.test.tsx tests/retro-play-scene.test.ts tests/retro-play-scene-cleanup.test.tsx`
Expected: FAIL because the details composition does not exist.

- [ ] **Step 3: Implement the fixed Canvas composition**

Use the approved 1600x900 framing as the canonical camera and derive 1280x720 without moving object anchors. Mark the Canvas `aria-hidden="true"`. Apply the selected cover texture to the CRT screen, use the fixed case component on the right, and place the HTML JOGAR button immediately below the case projection.

- [ ] **Step 4: Harden clone ownership and cleanup**

Dispose only cloned materials/textures/geometries owned by the details scene. Never dispose shared `useGLTF` or cached source textures. Guard every nullable async-created resource with optional chaining and an unmounted flag.

- [ ] **Step 5: Run tests and commit**

Run: `npx vitest run tests/retro-detail-scene.test.tsx tests/retro-play-scene.test.ts tests/retro-play-scene-cleanup.test.tsx`
Expected: PASS.

```bash
git add src/features/retro/RetroDetailScene.tsx src/features/retro/RetroDetailCase.tsx src/features/retro/RetroPlayScene.tsx src/features/retro/retroSceneLayout.ts src/features/retro/RetroGameDetailsScreen.tsx tests/retro-detail-scene.test.tsx tests/retro-play-scene.test.ts tests/retro-play-scene-cleanup.test.tsx
git commit -m "feat(retro): compose platform-aware detail room"
```

### Task 9: Complete gamepad, focus, sound, and reduced-motion behavior

**Files:**
- Modify: `src/features/retro/RetroGameDetailsScreen.tsx`
- Modify: `src/features/retro/RetroDetailTabs.tsx`
- Modify: `src/pages/RetroGamingPage.tsx`
- Modify: `tests/retro-game-details-screen.test.tsx`
- Modify: `tests/retro-gaming-page.test.tsx`

**Interfaces:**
- Gamepad X opens/activates, O closes, shoulder buttons switch tabs, D-pad scrolls/focuses actions.
- Keyboard Enter opens/activates, Escape/Backspace closes, arrows switch tabs, Tab remains trapped.

- [ ] **Step 1: Add failing interaction tests**

Mock `useGamepadButton` registrations and invoke captured callbacks. Assert exactly one handler per action, no handler remains after close, tab state changes without Canvas remount, close plays `back`, tab selection plays `select`, hover plays `hover`, and focus restores after O/Escape.

- [ ] **Step 2: Run tests and confirm failure**

Run: `npx vitest run tests/retro-game-details-screen.test.tsx tests/retro-gaming-page.test.tsx`
Expected: FAIL on missing gamepad/focus behavior.

- [ ] **Step 3: Implement the interaction map**

Register hooks unconditionally and gate callbacks with `isOpen` to preserve hook order. Ignore global shortcuts while an input, select, or textarea has focus. Use `useReducedMotion()` to remove transforms rather than hiding content.

- [ ] **Step 4: Run tests and commit**

Run: `npx vitest run tests/retro-game-details-screen.test.tsx tests/retro-gaming-page.test.tsx`
Expected: PASS.

```bash
git add src/features/retro/RetroGameDetailsScreen.tsx src/features/retro/RetroDetailTabs.tsx src/pages/RetroGamingPage.tsx tests/retro-game-details-screen.test.tsx tests/retro-gaming-page.test.tsx
git commit -m "fix(retro): preserve detail input and focus behavior"
```

### Task 10: Run release gates and inspect the packaged secret boundary

**Files:**
- Modify only if a gate exposes a defect in files already listed above.

**Interfaces:**
- Produces evidence for tests, typecheck, lint, build, asset manifest, package contents, and secret absence.

- [ ] **Step 1: Run focused and full automated gates**

```powershell
npm run verify:retro-assets
npm run test:typecheck
npm run test
npm run lint
npm run build
```

Expected: all commands exit 0.

- [ ] **Step 2: Scan source and build output for forbidden client secret usage**

```powershell
rg -n "RETROACHIEVEMENTS_API_KEY|API_Get.*\?[^\s]*y=" src electron dist assets package.json
```

Expected: no renderer, Electron, dist, asset, or package match. The backend environment-variable read is intentionally outside the scanned paths.

- [ ] **Step 3: Build the portable artifact and inspect contents**

Run: `npm run dist`
Expected: exit 0; the artifact contains all nine console GLBs and `assets/THIRD_PARTY_3D_ASSETS.md`, and contains neither a RetroAchievements key value nor backend `.env` files.

- [ ] **Step 4: Run visual and Electron smoke checks**

At 1600x900 and 1280x720 verify the low lateral camera, TV left, selected platform console right, foreground controller, game stack, fixed case, non-overlapping JOGAR action, three tabs, scroll, close, focus, and reduced motion. In Electron verify open by click/Enter/X, switch tabs, close by Escape/O, and launch only from JOGAR.

- [ ] **Step 5: Commit only gate-driven fixes**

Use `git status --short`, stage each already-listed feature file that was changed specifically to repair a failed gate, and commit with `git commit -m "test(retro): satisfy detail experience release gates"`. Do not create this commit when no gate-driven change was necessary, and never stage unrelated user work.

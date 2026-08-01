# Settings and Overlay Video Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Repair the connected-account and profile-privacy controls, remove the settings sign-out action, and add muted video backgrounds to native social and achievement toast cards.

**Architecture:** Profile visibility remains a Supabase-backed setting, but the persistence boundary will return the stored row so the UI uses confirmed database state instead of a second full-profile refresh. Native overlay media is isolated in a small UMD-style browser helper consumed by `electron/overlay.html`, allowing real DOM tests without evaluating the full overlay document. Existing toast routing, gradients, content, progress, sounds, and click behavior remain unchanged.

**Tech Stack:** React 19, TypeScript, Vitest, Testing Library, Supabase JS, Electron BrowserWindow, native HTML/CSS/JavaScript, electron-builder.

## Global Constraints

- Preserve current colors, opacity, gradients, borders, sound behavior, durations, routing, and toast placement.
- Apply the social video only to temporary social toast cards, never the large command panel.
- Keep every background video muted, looped, autoplaying, inline, decorative, and unable to intercept pointer events.
- Keep `Sair do Aplicativo`; remove only the settings-sidebar `Sair da Conta` action.
- Do not change Steam connection, synchronization, or unlink semantics.
- Preserve all unrelated dirty-worktree changes. `src/pages/SettingsPage.tsx` is an overlapping user-modified file and must not be staged wholesale.

---

## File Map

- `src/services/profilePrivacy.ts`: authenticated, confirmed profile-visibility persistence boundary.
- `src/pages/SettingsPage.tsx`: account-card hierarchy, privacy UI state, and settings exit actions.
- `tests/profile-privacy.test.ts`: Supabase persistence contract and error behavior.
- `tests/settings-page.test.tsx`: visible settings behavior and hierarchy regressions.
- `electron/overlay-video.js`: reusable decorative video-layer factory for native toast cards.
- `electron/overlay.html`: native toast integration and layer CSS.
- `tests/overlay-video.test.ts`: real DOM behavior of the video helper.
- `package.json`: packaged/unpacked overlay MP4 declarations.

---

### Task 1: Confirm Profile Visibility Persistence

**Files:**
- Modify: `tests/profile-privacy.test.ts`
- Modify: `src/services/profilePrivacy.ts`
- Modify: `tests/settings-page.test.tsx`
- Modify: `src/pages/SettingsPage.tsx`

**Interfaces:**
- Consumes: `saveProfileVisibility(requestedVisibility: ProfileVisibility)` and the authenticated Supabase session.
- Produces: `saveProfileVisibility(requestedVisibility: ProfileVisibility): Promise<ProfileVisibility>`, resolved only with the row value returned by Supabase.

- [ ] **Step 1: Change the persistence test double to mirror the returned-row query**

Use a complete chain that ends in `select("profile_visibility").single()`:

```ts
const single = vi.fn();
const select = vi.fn(() => ({ single }));
const eq = vi.fn(() => ({ select }));
const update = vi.fn(() => ({ eq }));

single.mockResolvedValue({
  data: { profile_visibility: "private" },
  error: null,
});
```

- [ ] **Step 2: Write the failing persistence assertions**

```ts
it("returns the visibility confirmed by the database", async () => {
  await expect(saveProfileVisibility("private")).resolves.toBe("private");
  expect(select).toHaveBeenCalledWith("profile_visibility");
});

it("rejects a malformed visibility returned by the database", async () => {
  single.mockResolvedValueOnce({ data: { profile_visibility: "friends" }, error: null });
  await expect(saveProfileVisibility("private")).rejects.toThrow(/visibilidade/i);
});
```

The production mutation these tests catch is returning the requested optimistic value without verifying the stored row.

- [ ] **Step 3: Run the persistence tests and verify RED**

Run: `npx vitest run tests/profile-privacy.test.ts`

Expected: FAIL because the current update chain never calls `select().single()` and returns the requested value directly.

- [ ] **Step 4: Implement confirmed persistence**

Update `saveProfileVisibility`:

```ts
const { data, error } = await supabase
  .from("profiles")
  .update({ profile_visibility: visibility })
  .eq("uid", session.user.id)
  .select("profile_visibility")
  .single();
if (error) throw error;
return normalizeProfileVisibility(data?.profile_visibility);
```

- [ ] **Step 5: Add a failing settings success test**

Render the connections tab with a public profile, resolve `saveProfileVisibility` with `"private"`, click `Perfil Privado`, and assert:

```ts
expect(await screen.findByText("Privacidade atualizada.")).toBeInTheDocument();
expect(screen.getByRole("button", { name: /perfil privado/i })).toHaveAttribute(
  "aria-pressed",
  "true",
);
expect(authState.refreshProfile).not.toHaveBeenCalled();
```

The production mutation this catches is restoring stale full-profile data immediately after a successful visibility update.

- [ ] **Step 6: Run the settings test and verify RED**

Run: `npx vitest run tests/settings-page.test.tsx`

Expected: FAIL because the current handler calls `refreshProfile()` after saving.

- [ ] **Step 7: Use the confirmed value without a refresh**

In `SettingsPageV2`, remove `refreshProfile` from the `useAuth()` destructure. In the handler:

```ts
const savedVisibility = await saveProfileVisibility(nextVisibility);
setProfileVisibility(savedVisibility);
setPrivacyStatus("saved");
```

Keep the existing rollback and inline error branch. Correct the visible Portuguese labels and messages to UTF-8 text: `Perfil Público`, `Perfil Privado`, `Não foi possível alterar a privacidade.`

- [ ] **Step 8: Run privacy and settings tests and verify GREEN**

Run: `npx vitest run tests/profile-privacy.test.ts tests/settings-page.test.tsx`

Expected: both files PASS, including rollback and confirmed-success cases.

- [ ] **Step 9: Commit the isolated persistence boundary**

Stage only files without pre-existing user overlap:

```powershell
git add -- src/services/profilePrivacy.ts tests/profile-privacy.test.ts
git commit -m "fix(profile): confirm stored visibility changes"
```

Leave `SettingsPage.tsx` and `settings-page.test.tsx` in the worktree for the final overlap review.

---

### Task 2: Repair Connected Account Hierarchy and Exit Actions

**Files:**
- Modify: `tests/settings-page.test.tsx`
- Modify: `src/pages/SettingsPage.tsx`

**Interfaces:**
- Consumes: existing `steamConnected`, `steamSyncing`, connect/disconnect/sync callbacks, and `window.electronAPI.requestAppQuit()`.
- Produces: semantic account cards labeled by service and a settings sidebar containing only the application-exit action.

- [ ] **Step 1: Write the failing hierarchy test**

Render the connections tab with Steam connected. Assert real rendered structure:

```ts
const steamCard = screen.getByRole("article", { name: "Steam" });
expect(within(steamCard).getByText("Steam")).toBeInTheDocument();
expect(within(steamCard).getByRole("group", { name: "Ações Steam" })).toContainElement(
  within(steamCard).getByRole("button", { name: /sync/i }),
);
expect(screen.queryByRole("button", { name: "Sair da Conta" })).not.toBeInTheDocument();
expect(screen.getByRole("button", { name: "Sair do Aplicativo" })).toBeInTheDocument();
```

The production mutation this catches is returning to an undifferentiated flex row where identity and actions wrap together, or restoring the removed sign-out control.

- [ ] **Step 2: Run the settings test and verify RED**

Run: `npx vitest run tests/settings-page.test.tsx`

Expected: FAIL because account cards are generic `div` elements without action grouping and `Sair da Conta` still renders.

- [ ] **Step 3: Implement semantic, stable account cards**

For Steam, Spotify, and Discord:

```tsx
<article aria-label="Steam" className="grid min-h-[76px] grid-cols-[auto_minmax(0,1fr)_auto] ...">
  {/* icon */}
  <div className="min-w-0">{/* service name and status */}</div>
  <div role="group" aria-label="Ações Steam" className="flex shrink-0 flex-col items-end gap-1">
    {/* sync and unlink */}
  </div>
</article>
```

Use the same grid skeleton and minimum height for Spotify and Discord. Keep all existing colors and callback wiring. Use no `truncate` on the service name; keep truncation only on long account identifiers.

- [ ] **Step 4: Remove only the settings sign-out action**

Remove `signOutUser` from the local `useAuth()` destructure and delete the `Sair da Conta` button. Keep the separator and `Sair do Aplicativo` button when a user is authenticated.

- [ ] **Step 5: Run settings tests and verify GREEN**

Run: `npx vitest run tests/settings-page.test.tsx`

Expected: PASS for behavior controls, audio layout, privacy persistence, account hierarchy, and exit actions.

- [ ] **Step 6: Check the overlapping diff without staging it**

Run:

```powershell
git diff --check -- src/pages/SettingsPage.tsx tests/settings-page.test.tsx
git diff -- src/pages/SettingsPage.tsx tests/settings-page.test.tsx
```

Confirm the requested edits coexist with the user's earlier settings redesign. Do not stage the full files.

---

### Task 3: Create the Native Overlay Video Layer

**Files:**
- Create: `electron/overlay-video.js`
- Create: `tests/overlay-video.test.ts`

**Interfaces:**
- Produces: `createOverlayVideoLayer(kind: "social" | "achievement", documentRef?: Document): HTMLDivElement` through CommonJS in tests and `window.CheckpointOverlayVideo` in the overlay renderer.

- [ ] **Step 1: Write a real DOM test for both video variants**

```ts
// @vitest-environment jsdom
const { createOverlayVideoLayer } = require("../electron/overlay-video.js");

it.each([
  ["social", "Kristina_Lane__pindown.io_1785615277.mp4", true],
  ["achievement", "Overlay_Background.mp4", false],
])("creates a muted decorative %s layer", (kind, filename, rotated) => {
  const layer = createOverlayVideoLayer(kind, document);
  const video = layer.querySelector("video")!;
  expect(video.muted).toBe(true);
  expect(video.autoplay).toBe(true);
  expect(video.loop).toBe(true);
  expect(video.playsInline).toBe(true);
  expect(video.getAttribute("src")).toContain(filename);
  expect(video.classList.contains("is-rotated")).toBe(rotated);
  expect(layer.getAttribute("aria-hidden")).toBe("true");
});
```

The production mutation this catches is assigning the wrong asset, allowing audio, omitting loop/autoplay, or rotating the achievement video.

- [ ] **Step 2: Run the overlay helper test and verify RED**

Run: `npx vitest run tests/overlay-video.test.ts`

Expected: FAIL because `electron/overlay-video.js` does not exist.

- [ ] **Step 3: Implement the UMD-style helper**

```js
(function attachOverlayVideo(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.CheckpointOverlayVideo = api;
})(typeof window !== "undefined" ? window : globalThis, function createApi() {
  const sources = {
    social: "../src/assets/Kristina_Lane__pindown.io_1785615277.mp4",
    achievement: "../src/assets/Overlay_Background.mp4",
  };
  const createOverlayVideoLayer = (kind, documentRef = document) => {
    if (!sources[kind]) throw new TypeError(`Unsupported overlay video kind: ${kind}`);
    const layer = documentRef.createElement("div");
    layer.className = `overlay-video-layer overlay-video-${kind}`;
    layer.setAttribute("aria-hidden", "true");
    const video = documentRef.createElement("video");
    video.className = `overlay-video${kind === "social" ? " is-rotated" : ""}`;
    video.src = sources[kind];
    video.autoplay = true;
    video.loop = true;
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    video.tabIndex = -1;
    const scrim = documentRef.createElement("span");
    scrim.className = "overlay-video-scrim";
    layer.append(video, scrim);
    return layer;
  };
  return { createOverlayVideoLayer };
});
```

- [ ] **Step 4: Run the helper test and verify GREEN**

Run: `npx vitest run tests/overlay-video.test.ts`

Expected: PASS for both variants.

- [ ] **Step 5: Commit the isolated helper**

```powershell
git add -- electron/overlay-video.js tests/overlay-video.test.ts
git commit -m "feat(overlay): add decorative video layer helper"
```

---

### Task 4: Integrate Video Layers into Native Toast Cards

**Files:**
- Modify: `electron/overlay.html`
- Modify: `tests/overlay-video.test.ts`

**Interfaces:**
- Consumes: `window.CheckpointOverlayVideo.createOverlayVideoLayer(kind)` from Task 3.
- Produces: `appendOverlayVideoLayer(shell: HTMLElement, kind: "social" | "achievement", documentRef?: Document): HTMLDivElement` and native toast shells containing the correct lowest-layer video.

- [ ] **Step 1: Write a failing DOM test for shell decoration**

Require `appendOverlayVideoLayer` from the public helper, build a shell with existing content, and assert literal DOM order:

```ts
const shell = document.createElement("div");
const content = document.createElement("div");
content.className = "overlay-content";
shell.append(content);
const layer = appendOverlayVideoLayer(shell, "social", document);
expect(shell.firstElementChild).toBe(layer);
expect(shell.lastElementChild).toBe(content);
```

This catches a missing integration boundary and protects the contract that content remains above decorative media.

- [ ] **Step 2: Run the overlay test and verify RED**

Run: `npx vitest run tests/overlay-video.test.ts`

Expected: FAIL because `appendOverlayVideoLayer` is not exported yet.

- [ ] **Step 3: Implement the shell decorator**

Add to `electron/overlay-video.js`:

```js
const appendOverlayVideoLayer = (shell, kind, documentRef = document) => {
  const layer = createOverlayVideoLayer(kind, documentRef);
  shell.prepend(layer);
  return layer;
};
return { createOverlayVideoLayer, appendOverlayVideoLayer };
```

- [ ] **Step 4: Load the helper and add layer CSS**

In `electron/overlay.html`, load `./overlay-video.js` before the main inline overlay script. Add:

```css
.overlay-video-layer { position: absolute; inset: 0; z-index: 0; overflow: hidden; pointer-events: none; }
.overlay-video { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; opacity: 0.16; }
.overlay-video.is-rotated { inset: 50% auto auto 50%; width: 160%; height: 160%; transform: translate(-50%, -50%) rotate(90deg); }
.overlay-video-scrim { position: absolute; inset: 0; background: radial-gradient(circle at 14% 0%, rgba(255,255,255,.06), transparent 36%), linear-gradient(145deg, rgba(16,16,22,.78), rgba(6,6,9,.9)); }
.overlay-shell > :not(.overlay-video-layer) { position: relative; z-index: 1; }
```

Assign explicit z-index values to the existing shell pseudo-elements so the accent and shine remain above the video.

- [ ] **Step 5: Insert the correct layer in both toast creation paths**

Immediately after each shell is created:

```js
window.CheckpointOverlayVideo.appendOverlayVideoLayer(shell, "achievement");
```

and:

```js
window.CheckpointOverlayVideo.appendOverlayVideoLayer(shell, "social");
```

Do not add a video to the command-panel DOM.

- [ ] **Step 6: Add graceful fallback**

Wrap layer creation in a small local helper that returns `null` if the global helper or media creation fails. Append only when non-null; the existing opaque shell background remains the fallback.

- [ ] **Step 7: Verify tests and Electron source syntax**

Run:

```powershell
npx vitest run tests/overlay-video.test.ts tests/overlay.test.ts
node --check electron/overlay-video.js
node --check electron/main.cjs
```

Expected: all available overlay tests PASS and both JavaScript checks exit 0. If `tests/overlay.test.ts` is not present, run the existing overlay-related test files returned by `rg --files tests | rg overlay`.

- [ ] **Step 8: Commit the native overlay integration**

```powershell
git add -- electron/overlay.html electron/overlay-video.js tests/overlay-video.test.ts
git commit -m "feat(overlay): add video backgrounds to toast cards"
```

---

### Task 5: Package Overlay Videos Reliably

**Files:**
- Modify: `package.json`
- Modify: `tests/overlay-video.test.ts`

**Interfaces:**
- Consumes: the two relative asset paths used by `electron/overlay-video.js`.
- Produces: packaged files at `src/assets/Kristina_Lane__pindown.io_1785615277.mp4` and `src/assets/Overlay_Background.mp4`, available outside ASAR compression for Chromium streaming.

- [ ] **Step 1: Add a failing packaging contract test**

```ts
const packageJson = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
expect(packageJson.build.files).toEqual(expect.arrayContaining([
  "src/assets/Kristina_Lane__pindown.io_1785615277.mp4",
  "src/assets/Overlay_Background.mp4",
]));
expect(packageJson.build.asarUnpack).toEqual(expect.arrayContaining([
  "src/assets/Kristina_Lane__pindown.io_1785615277.mp4",
  "src/assets/Overlay_Background.mp4",
]));
```

The production mutation this catches is a development-only overlay whose media disappears or cannot stream after packaging.

- [ ] **Step 2: Run the test and verify RED**

Run: `npx vitest run tests/overlay-video.test.ts`

Expected: FAIL because neither MP4 nor an unpack rule is currently declared.

- [ ] **Step 3: Add precise builder entries**

In `build.files`, append the two exact MP4 paths. Change `asarUnpack` to:

```json
"asarUnpack": [
  "src/assets/Kristina_Lane__pindown.io_1785615277.mp4",
  "src/assets/Overlay_Background.mp4"
]
```

- [ ] **Step 4: Run packaging tests and production build**

Run:

```powershell
npx vitest run tests/overlay-video.test.ts
npm run build
```

Expected: test PASS and Vite production build exit 0 with both MP4 assets still present at their source paths.

- [ ] **Step 5: Commit packaging changes**

```powershell
git add -- package.json src/assets/Kristina_Lane__pindown.io_1785615277.mp4 src/assets/Overlay_Background.mp4 tests/overlay-video.test.ts
git commit -m "build(overlay): package toast background videos"
```

---

### Task 6: Full Regression and Visual Verification

**Files:**
- Review only: all files changed by Tasks 1-5.

**Interfaces:**
- Consumes: completed settings, persistence, overlay, and packaging tasks.
- Produces: evidence-backed handoff with known lint or visual limitations stated explicitly.

- [ ] **Step 1: Run focused validation**

```powershell
npx vitest run tests/profile-privacy.test.ts tests/settings-page.test.tsx tests/overlay-video.test.ts
npm run test:typecheck
npx eslint src/services/profilePrivacy.ts src/pages/SettingsPage.tsx electron/overlay-video.js tests/profile-privacy.test.ts tests/settings-page.test.tsx tests/overlay-video.test.ts
node --check electron/overlay-video.js
node --check electron/main.cjs
```

- [ ] **Step 2: Run full validation**

```powershell
npm test
npm run build
git diff --check
```

Expected: full Vitest suite and build exit 0. Report global lint separately if unrelated pre-existing files still fail.

- [ ] **Step 3: Inspect the running UI**

Verify at launcher scale:

- Steam name and connection state never overlap or wrap into `Sync`.
- Public/private selection switches, confirms, survives reopening settings, and rolls back with visible feedback on failure.
- `Sair da Conta` is absent and `Sair do Aplicativo` remains.
- Social cards use the rotated Kristina video with readable text and working friend-request/message clicks.
- Achievement cards use `Overlay_Background.mp4`, remain readable, and play no video audio.
- The large command panel contains no background video.

Use the available Browser/Electron inspection surface. If none is connected, report this limitation and do not claim manual verification.

- [ ] **Step 4: Review repository state**

Run `git status --short` and `git log -8 --oneline`. Confirm unrelated user changes remain intact and identify the intentionally uncommitted overlapping settings files in the handoff.

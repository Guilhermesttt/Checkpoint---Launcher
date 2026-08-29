# Secure Epic Desktop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move Epic authentication, private library access, achievements, and logout from public HTTP routes into validated Electron IPC backed by a pinned, hash-verified Legendary executable.

**Architecture:** A focused CommonJS Legendary manager owns download verification and bounded process execution under Electron `userData`. Secure main-process handlers expose normalized account operations through preload; React keeps remote HTTP only for public catalog metadata. Credential-bearing Express routes and the server-side Legendary module are removed.

**Tech Stack:** Electron 39 initially (upgraded to 44 by the security-gate plan), Node CommonJS, `node:crypto`, `node:child_process`, Zod, React/TypeScript, Vitest.

**Spec:** `docs/superpowers/specs/2026-08-29-desktop-platform-sync-security-design.md`

## Global Constraints

- Windows desktop Electron only; no browser fallback for Epic account operations.
- Pin Legendary `0.21.0` Windows x64 from `https://github.com/legendary-gl/legendary/releases/download/0.21.0/legendary_windows_x64.exe`.
- Require SHA-256 `4c01a14c0acb0c46069b197ae7212ea4ea6b861661126ca0593cdac31658fb01` and exact asset size `17610944` bytes.
- Store the executable at `<userData>/tools/legendary/0.21.0/legendary.exe`; never execute `bin/legendary.exe` or a mutable `latest` URL.
- Epic tokens, authorization codes, config contents, and raw process output never cross IPC or HTTP responses and never enter logs.
- All IPC handlers use `registerSecureIpcHandler`; all input schemas are closed and size-bounded.
- Process execution uses `spawn`/`execFile` with an argument array, `shell: false`, a 45-second timeout, and a 2 MiB combined output limit.

---

## File structure

- Create `electron/legendary-manager.cjs`: pinned artifact acquisition, SHA verification, exclusive install, bounded command execution, output normalization, credential deletion.
- Create `electron/epic-account.cjs`: closed schemas and normalized Epic account/library/achievement results.
- Modify `electron/main.cjs`: instantiate the manager and register five secure Epic handlers.
- Modify `electron/preload.cjs`: expose typed invoke methods and a sanitized progress subscription.
- Modify `src/types/electron.d.ts`: declare the exact renderer API and result types.
- Modify `src/services/epic.ts`: use Electron IPC for private operations; retain HTTP only for search/details.
- Modify `src/components/settings/EpicConnectModal.tsx` and `src/pages/Home.tsx`: stop calling localhost Epic routes.
- Modify `server/index.mjs`: remove private Epic routes/imports; keep search and app-details.
- Delete `server/legendary.mjs` after its parsing behavior is covered in the manager.
- Add `tests/legendary-manager.test.ts`, `tests/epic-account.test.ts`, `tests/epic-ipc-contract.test.ts`; update `tests/epic-sync.test.ts`.

### Task 1: Verified Legendary artifact manager

**Files:**
- Create: `electron/legendary-manager.cjs`
- Test: `tests/legendary-manager.test.ts`

**Interfaces:**
- Produces: `createLegendaryManager({ userDataPath, fetchImpl, spawnImpl, fsImpl?, now? })`.
- Produces manager methods: `ensureInstalled(options?: { force?: boolean }): Promise<string>`, `run(args: string[], options?): Promise<string>`, `logout(): Promise<void>`.
- Produces constants: `LEGENDARY_VERSION`, `LEGENDARY_DOWNLOAD_URL`, `LEGENDARY_SHA256`, `LEGENDARY_ASSET_SIZE`.

- [ ] **Step 1: Write failing artifact verification tests**

```ts
it("installs only the pinned artifact after hash verification", async () => {
  const manager = createLegendaryManager({ userDataPath, fetchImpl: fetchReturning(validBinary), spawnImpl });
  await expect(manager.ensureInstalled()).resolves.toBe(join(userDataPath, "tools", "legendary", "0.21.0", "legendary.exe"));
  expect(readFileSync(installedPath)).toEqual(validBinary);
});

it("rejects a tampered artifact and preserves the verified executable", async () => {
  writeFileSync(installedPath, validBinary);
  const manager = createLegendaryManager({ userDataPath, fetchImpl: fetchReturning(tamperedBinary), spawnImpl });
  await expect(manager.ensureInstalled({ force: true })).rejects.toThrow("Falha na verificacao do Legendary.");
  expect(readFileSync(installedPath)).toEqual(validBinary);
});
```

- [ ] **Step 2: Run the focused test and confirm RED**

Run: `npx vitest run tests/legendary-manager.test.ts`

Expected: FAIL because `electron/legendary-manager.cjs` does not exist.

- [ ] **Step 3: Implement pinned download and atomic replacement**

```js
const LEGENDARY_VERSION = "0.21.0";
const LEGENDARY_DOWNLOAD_URL = "https://github.com/legendary-gl/legendary/releases/download/0.21.0/legendary_windows_x64.exe";
const LEGENDARY_SHA256 = "4c01a14c0acb0c46069b197ae7212ea4ea6b861661126ca0593cdac31658fb01";
const LEGENDARY_ASSET_SIZE = 17_610_944;

const digest = (buffer) => crypto.createHash("sha256").update(buffer).digest("hex");
const verifyArtifact = (buffer) => {
  if (buffer.length !== LEGENDARY_ASSET_SIZE || digest(buffer) !== LEGENDARY_SHA256) {
    throw new Error("Falha na verificacao do Legendary.");
  }
};
```

Write to `legendary.exe.download-<random>`, call `verifyArtifact`, close the file, then rename within the version directory. Serialize installation with one in-flight promise. Verify an existing file before returning it.

- [ ] **Step 4: Add bounded process tests**

```ts
it("uses the verified fixed path without a shell", async () => {
  await manager.run(["list-games", "--json"]);
  expect(spawnImpl).toHaveBeenCalledWith(installedPath, ["list-games", "--json"], expect.objectContaining({ shell: false, windowsHide: true }));
});

it.each(["timeout", "oversized-output"])("terminates %s commands", async (mode) => {
  spawnImpl.mockImplementation(fakeChildFor(mode));
  await expect(manager.run(["list-games", "--json"])).rejects.toThrow(/Legendary/);
});
```

- [ ] **Step 5: Implement bounded argument-array execution**

Reject empty args, strings longer than 4,096 characters, more than 32 args, and control characters. Accumulate at most 2 MiB across stdout/stderr, kill on overflow or after 45 seconds, return stdout only on exit code zero, and map failures to fixed Portuguese messages without including stderr.

- [ ] **Step 6: Run focused tests and commit**

Run: `npx vitest run tests/legendary-manager.test.ts`

Expected: PASS.

```powershell
git add -- electron/legendary-manager.cjs tests/legendary-manager.test.ts
git commit -m "feat: verify and sandbox Legendary executable"
```

### Task 2: Normalize Epic account operations

**Files:**
- Create: `electron/epic-account.cjs`
- Test: `tests/epic-account.test.ts`

**Interfaces:**
- Consumes: manager `run(args)` and `logout()` from Task 1.
- Produces: `createEpicAccount({ legendary, emitProgress })`.
- Produces methods: `getStatus()`, `authenticate({ code })`, `listLibrary()`, `getAchievements({ sandboxId?, appName? })`, `logout()`.
- All results are JSON-safe normalized values; status is `{ authenticated: boolean }`.

- [ ] **Step 1: Write failing normalization and redaction tests**

```ts
it("returns a normalized library without raw Legendary fields", async () => {
  legendary.run.mockResolvedValue(JSON.stringify([{ app_name: "Fortnite", app_title: "Fortnite", metadata: { id: "fn", namespace: "fn", title: "Fortnite", keyImages: [] } }]));
  await expect(account.listLibrary()).resolves.toEqual([{ appName: "Fortnite", title: "Fortnite", catalogId: "fn", namespace: "fn", description: "", keyImages: [] }]);
});

it("never includes tokens in status or errors", async () => {
  legendary.run.mockRejectedValue(new Error("token=secret-value"));
  await expect(account.getStatus()).resolves.toEqual({ authenticated: false });
});
```

- [ ] **Step 2: Run the focused test and confirm RED**

Run: `npx vitest run tests/epic-account.test.ts`

Expected: FAIL because the module is absent.

- [ ] **Step 3: Implement closed input and output schemas**

Use Zod schemas with `.strict()`:

```js
const authRequestSchema = z.object({ code: z.string().trim().min(8).max(2048).regex(/^[^\r\n]+$/) }).strict();
const achievementRequestSchema = z.object({ sandboxId: z.string().trim().max(300).optional(), appName: z.string().trim().max(300).optional() }).strict();
```

Map `auth --code <code> -y`, `list-games --json`, achievement commands already used by `server/legendary.mjs`, and `auth --delete`. Emit only `authenticating`, `reading-library`, and `reading-achievements` progress phases. Limit library to 10,000 normalized items, key images to 20 per game, strings to their declared maximums, and reject invalid JSON as `Resposta invalida da Epic Games.`

- [ ] **Step 4: Run focused tests and commit**

Run: `npx vitest run tests/epic-account.test.ts`

Expected: PASS.

```powershell
git add -- electron/epic-account.cjs tests/epic-account.test.ts
git commit -m "feat: normalize local Epic account operations"
```

### Task 3: Secure IPC and renderer contract

**Files:**
- Modify: `electron/main.cjs`
- Modify: `electron/preload.cjs`
- Modify: `src/types/electron.d.ts`
- Test: `tests/epic-ipc-contract.test.ts`

**Interfaces:**
- Consumes: `createLegendaryManager` and `createEpicAccount`.
- Produces renderer methods: `getEpicStatus`, `authenticateEpic`, `getEpicLibrary`, `getEpicAchievements`, `logoutEpic`, `onEpicProgress`.

- [ ] **Step 1: Write failing IPC contract tests**

```ts
expect(preloadSource).toContain('getEpicStatus: () => ipcRenderer.invoke("epic:get-status")');
expect(mainSource).toContain('registerSecureIpcHandler("epic:authenticate"');
expect(mainSource).not.toMatch(/ipcMain\.handle\("epic:/);
expect(typesSource).toContain('authenticateEpic: (request: { code: string }) => Promise<{ authenticated: boolean }>');
expect(preloadSource).not.toMatch(/token|getEpicToken/i);
```

- [ ] **Step 2: Run the focused test and confirm RED**

Run: `npx vitest run tests/epic-ipc-contract.test.ts`

Expected: FAIL because the six methods and handlers are not registered.

- [ ] **Step 3: Register secure handlers and sanitized progress**

Instantiate lazily with `app.getPath("userData")`. Register:

```js
registerSecureIpcHandler("epic:get-status", () => getEpicAccount().getStatus());
registerSecureIpcHandler("epic:authenticate", (_event, request) => getEpicAccount().authenticate(request));
registerSecureIpcHandler("epic:list-library", () => getEpicAccount().listLibrary());
registerSecureIpcHandler("epic:get-achievements", (_event, request) => getEpicAccount().getAchievements(request));
registerSecureIpcHandler("epic:logout", () => getEpicAccount().logout());
```

Send progress only to the expected main window as `{ phase, completed?, total? }`. Preload validates the callback is a function and returns an unsubscribe closure. Add exact TypeScript unions for phases and results.

- [ ] **Step 4: Run IPC/security tests and commit**

Run: `npx vitest run tests/epic-ipc-contract.test.ts tests/ipc-security.test.ts`

Expected: PASS.

```powershell
git add -- electron/main.cjs electron/preload.cjs src/types/electron.d.ts tests/epic-ipc-contract.test.ts
git commit -m "feat: expose Epic account through secure IPC"
```

### Task 4: Switch Epic synchronization to desktop IPC

**Files:**
- Modify: `src/services/epic.ts`
- Modify: `src/components/settings/EpicConnectModal.tsx`
- Modify: `src/pages/Home.tsx`
- Modify: `tests/epic-sync.test.ts`
- Test: `tests/epic-connect-modal.test.tsx`

**Interfaces:**
- Consumes: the `window.electronAPI` methods from Task 3.
- Produces: `fetchEpicStatus`, `authenticateEpic`, `fetchEpicLibrary`, `fetchEpicAchievements`, `unlinkEpicAccount` that throw `Epic Games requer o aplicativo desktop.` if IPC is absent.

- [ ] **Step 1: Rewrite Epic service tests to require IPC**

```ts
Object.defineProperty(window, "electronAPI", { value: { getEpicLibrary: vi.fn().mockResolvedValue([epicGame]) }, configurable: true });
await syncEpicLibraryToLocal("user-1");
expect(window.electronAPI.getEpicLibrary).toHaveBeenCalledOnce();
expect(fetch).not.toHaveBeenCalledWith(expect.stringContaining("/api/epic/library"), expect.anything());
```

Add a test that an absent `electronAPI` rejects before any fetch and modal tests that native authentication calls `authenticateEpic({ code })` without `localhost:8787`.

- [ ] **Step 2: Run focused tests and confirm RED**

Run: `npx vitest run tests/epic-sync.test.ts tests/epic-connect-modal.test.tsx`

Expected: FAIL because private operations still use HTTP.

- [ ] **Step 3: Implement the desktop-only service boundary**

```ts
const requireEpicDesktop = () => {
  if (!window.electronAPI?.getEpicLibrary) throw new Error("Epic Games requer o aplicativo desktop.");
  return window.electronAPI;
};

export const fetchEpicLibrary = () => requireEpicDesktop().getEpicLibrary();
export const fetchEpicAchievements = (sandboxId?: string, appName?: string) =>
  requireEpicDesktop().getEpicAchievements({ sandboxId, appName });
```

Keep `searchEpicGames` and `fetchEpicAppDetailsResult` on authenticated/public remote catalog endpoints. Remove `isBackendHealthy` as a prerequisite for Epic private sync. Update the modal and Home status checks to use IPC.

- [ ] **Step 4: Run focused tests and commit**

Run: `npx vitest run tests/epic-sync.test.ts tests/epic-connect-modal.test.tsx`

Expected: PASS.

```powershell
git add -- src/services/epic.ts src/components/settings/EpicConnectModal.tsx src/pages/Home.tsx tests/epic-sync.test.ts tests/epic-connect-modal.test.tsx
git commit -m "refactor: keep Epic private data inside desktop"
```

### Task 5: Remove public Epic credential routes and package safely

**Files:**
- Modify: `server/index.mjs`
- Delete: `server/legendary.mjs`
- Modify: `package.json`
- Test: `tests/epic-http-surface.test.ts`
- Modify: `tests/release-3-1-1-contract.test.ts`

**Interfaces:**
- Public Epic HTTP surface after this task: `GET /api/epic/search`, `GET /api/epic/app-details` only.

- [ ] **Step 1: Write a failing public-surface test**

```ts
for (const route of ["/api/epic/auth", "/api/epic/library", "/api/epic/token", "/api/epic/status", "/api/epic/logout", "/api/epic/achievements"]) {
  expect(serverSource).not.toContain(`"${route}"`);
}
expect(serverSource).not.toContain('from "./legendary.mjs"');
expect(packageJson.build.files).not.toContain("bin/**/*");
```

- [ ] **Step 2: Run the focused test and confirm RED**

Run: `npx vitest run tests/epic-http-surface.test.ts tests/release-3-1-1-contract.test.ts`

Expected: FAIL while private routes/imports and bundled `bin` paths exist.

- [ ] **Step 3: Remove the server-side credential surface**

Delete the Legendary import, six private routes, startup installer call, and obsolete local-server coupling. Delete `server/legendary.mjs`. Ensure public catalog routes return bounded fields and do not require or access local Legendary state. Exclude `bin/**/*` from packaged files; runtime downloads only the pinned verified artifact into `userData`.

- [ ] **Step 4: Run all Epic and release tests**

Run: `npx vitest run tests/legendary-manager.test.ts tests/epic-account.test.ts tests/epic-ipc-contract.test.ts tests/epic-sync.test.ts tests/epic-connect-modal.test.tsx tests/epic-http-surface.test.ts tests/release-3-1-1-contract.test.ts`

Expected: PASS.

- [ ] **Step 5: Run compile/build verification and commit**

Run: `npm run test:typecheck && npm run typecheck && npm run build`

Expected: all commands exit 0.

```powershell
git add -- server/index.mjs server/legendary.mjs package.json package-lock.json tests/epic-http-surface.test.ts tests/release-3-1-1-contract.test.ts
git commit -m "security: remove public Epic credential routes"
```

### Task 6: Packaged Windows smoke verification

**Files:**
- Modify: `scripts/verify-release.cjs`
- Modify: `scripts/smoke-installer.ps1`
- Test: `tests/release-epic-desktop-contract.test.ts`

**Interfaces:**
- Consumes: packaged Electron app and the pinned manager contract.
- Produces: release verification that fails if a bundled unverified Legendary, private Epic HTTP route, or missing IPC method is detected.

- [ ] **Step 1: Add failing release assertions**

Assert the package does not contain `server/legendary.mjs` or `bin/legendary.exe`, preload contains all Epic methods, main contains all secure handlers, and the pinned URL/hash/version match Task 1.

- [ ] **Step 2: Run and confirm RED**

Run: `npx vitest run tests/release-epic-desktop-contract.test.ts`

Expected: FAIL until verification scripts inspect the new contract.

- [ ] **Step 3: Extend release and smoke scripts**

Make `verify-release.cjs` report a nonzero exit for forbidden files/routes or mismatched constants. In the Windows smoke script, launch with `--smoke-test`, invoke `epic:get-status` through the existing smoke harness, and accept either `{ authenticated: false }` or `{ authenticated: true }` without attempting login.

- [ ] **Step 4: Run verification and commit**

Run: `npx vitest run tests/release-epic-desktop-contract.test.ts && npm run release:verify`

Expected: PASS and release verification exits 0.

```powershell
git add -- scripts/verify-release.cjs scripts/smoke-installer.ps1 tests/release-epic-desktop-contract.test.ts
git commit -m "test: verify secure Epic desktop packaging"
```

# Security Release Gate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the identified XSS, CSP, network-surface, dependency, secret-leakage, validation, and release-automation gaps and turn the supplied 20-point checklist into an enforced Windows desktop release gate.

**Architecture:** Central security utilities remove repeated unsafe rendering and URL validation. The remote Express process becomes API-only with minimized authenticated/public surfaces, while Electron loads a CSP-protected packaged UI. Deterministic local scripts and CI checks scan secrets, dependencies, configuration, and packaged artifacts before release.

**Tech Stack:** React/DOMPurify, Electron, Express/Helmet/CORS/express-rate-limit, Zod, npm audit, GitHub Actions, Vitest.

**Spec:** `docs/superpowers/specs/2026-08-29-desktop-platform-sync-security-design.md`

## Global Constraints

- The shipped product is Windows desktop Electron only; the Express deployment is API/callback-only and must not serve the launcher SPA.
- No plaintext secret, token, authorization code, password, private key, service-role key, or raw upstream payload in logs, errors, IPC, bundles, Git history, or release artifacts.
- Production remote URLs use HTTPS; external navigation accepts `https:` plus explicit Steam custom schemes already required by launch behavior.
- Renderer HTML uses one allowlisted sanitizer with no event/style attributes, custom elements, SVG, MathML, or unknown protocols.
- Production CSP contains no `unsafe-eval`; `script-src` contains no `unsafe-inline`.
- Dependency floor for this work: DOMPurify `3.4.14`, React Router DOM `7.18.3`, concurrently `9.2.4`, express-rate-limit `8.7.0`, Helmet `8.3.0`, Electron `44.0.0`.
- CI and release fail on high/critical `npm audit` findings in production and development dependency graphs; lower findings are printed for review.

---

## File structure

- Create `src/utils/sanitizeStoreHtml.ts`: the only store-description sanitizer.
- Modify `src/components/GameDetailPanel.tsx`: sanitize every upstream fragment before rendering.
- Modify `index.html`: packaged renderer CSP.
- Modify `server/index.mjs`: restrictive headers, API-only 404, explicit loopback development binding, bounded routes, trimmed errors.
- Modify `package.json`/`package-lock.json`: security dependency upgrades and scripts.
- Create `scripts/scan-secrets.cjs`: tracked-tree and Git-history secret scan with redacted findings.
- Create `scripts/security-gate.cjs`: orchestrate audit, source contracts, environment rules, and packaged-artifact checks.
- Create `.github/workflows/security.yml`: run the deterministic gate on pushes, pull requests, and weekly schedule.
- Create `docs/security/release-gate.md`: owner-facing checklist/evidence and rotation procedure.
- Add sanitizer, CSP, server-surface, URL, secret-scanner, and security-gate tests.

### Task 1: Centralize upstream HTML sanitization

**Files:**
- Create: `src/utils/sanitizeStoreHtml.ts`
- Modify: `src/components/GameDetailPanel.tsx`
- Test: `tests/sanitize-store-html.test.ts`
- Modify: `tests/game-detail-panel.test.tsx`

**Interfaces:**
- Produces `sanitizeStoreHtml(value: unknown): string`.
- Allowed tags: `b`, `br`, `em`, `i`, `li`, `ol`, `p`, `strong`, `ul`.
- Allowed attributes: none.

- [ ] **Step 1: Write failing XSS tests**

```ts
expect(sanitizeStoreHtml('<img src=x onerror="alert(1)"><p style="color:red">Safe</p>')).toBe("<p>Safe</p>");
expect(sanitizeStoreHtml('<svg><script>alert(1)</script></svg><a href="javascript:alert(1)">x</a>')).toBe("x");
expect(sanitizeStoreHtml(null)).toBe("");
```

Add a source contract asserting every `dangerouslySetInnerHTML` in `GameDetailPanel.tsx` receives a variable produced by `sanitizeStoreHtml`, never `steamAppDetails.*` directly.

- [ ] **Step 2: Run focused tests and confirm RED**

Run: `npx vitest run tests/sanitize-store-html.test.ts tests/game-detail-panel.test.tsx`

Expected: FAIL because raw Steam fragments remain.

- [ ] **Step 3: Implement one strict sanitizer**

```ts
const config = {
  ALLOWED_TAGS: ["b", "br", "em", "i", "li", "ol", "p", "strong", "ul"],
  ALLOWED_ATTR: [],
  ALLOW_DATA_ATTR: false,
  ALLOW_ARIA_ATTR: false,
  FORBID_TAGS: ["style", "script", "svg", "math", "iframe", "object", "embed", "form"],
  RETURN_TRUSTED_TYPE: false,
} as const;

export const sanitizeStoreHtml = (value: unknown) =>
  DOMPurify.sanitize(typeof value === "string" ? value.slice(0, 200_000) : "", config);
```

Compute sanitized about/languages/minimum/recommended values with `useMemo` and render only those variables. Plain-text fields stay React text nodes.

- [ ] **Step 4: Run tests and commit**

Run: `npx vitest run tests/sanitize-store-html.test.ts tests/game-detail-panel.test.tsx`

Expected: PASS.

```powershell
git add -- src/utils/sanitizeStoreHtml.ts src/components/GameDetailPanel.tsx tests/sanitize-store-html.test.ts tests/game-detail-panel.test.tsx
git commit -m "security: sanitize all store HTML"
```

### Task 2: Restrictive Electron and server CSP

**Files:**
- Modify: `index.html`
- Modify: `server/index.mjs`
- Test: `tests/content-security-policy.test.ts`

**Interfaces:**
- Packaged renderer policy is declared by one CSP meta tag.
- Server uses Helmet headers for API/callback responses and no SPA catch-all.

- [ ] **Step 1: Write failing CSP/API-only tests**

```ts
expect(indexHtml).toContain("default-src 'self'");
expect(indexHtml).toContain("object-src 'none'");
expect(indexHtml).toContain("frame-ancestors 'none'");
expect(indexHtml).not.toContain("'unsafe-eval'");
expect(serverSource).not.toContain("express.static(path.join(__dirname, \"../dist\"))");
expect(serverSource).not.toContain('app.get("/{*path}"');
```

Parse the CSP and assert `script-src` equals `'self'`, while `style-src` alone retains `'unsafe-inline'` because the current React UI emits inline styles.

- [ ] **Step 2: Run focused test and confirm RED**

Run: `npx vitest run tests/content-security-policy.test.ts`

Expected: FAIL because renderer CSP is absent and the server still serves the SPA.

- [ ] **Step 3: Add the packaged renderer policy**

Use:

```html
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https: cp-media:; font-src 'self' data:; connect-src 'self' https://checkpoint-launcher.onrender.com https://*.supabase.co wss://*.supabase.co; media-src 'self' data: blob: https: cp-media:; worker-src 'self' blob:; frame-src 'none'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests">
```

Development adds Vite HMR endpoints through an Electron-created response header override scoped to `DEV_ORIGIN`; do not weaken the packaged policy.

- [ ] **Step 4: Make Express API-only and harden headers**

Remove static `dist` serving and the wildcard HTML response. End with JSON `{ error: "Rota nao encontrada." }` 404 middleware. Helmet uses `scriptSrc: ["'self'"]`, `objectSrc: ["'none'"]`, `baseUri: ["'none'"]`, and `frameAncestors: ["'none'"]`. Keep explicit OAuth callback HTML routes before the API 404 and generate their inline content with a per-response nonce added to CSP rather than global `unsafe-inline`.

- [ ] **Step 5: Run tests/build and commit**

Run: `npx vitest run tests/content-security-policy.test.ts && npm run build`

Expected: PASS and build exits 0.

```powershell
git add -- index.html server/index.mjs tests/content-security-policy.test.ts
git commit -m "security: enforce desktop and API content policy"
```

### Task 3: Network, auth, input, response, and upload boundaries

**Files:**
- Create: `server/security-boundaries.mjs`
- Modify: `server/index.mjs`
- Modify: `electron/main.cjs`
- Test: `tests/server-security-boundaries.test.ts`
- Test: `tests/external-url-security.test.ts`

**Interfaces:**
- Produces `normalizeSafeError`, `requireJsonObject`, `validateHttpsUrl`, `trimJsonResponse`, and limiter factories.
- Electron produces `assertAllowedExternalUrl(rawUrl)` with a closed protocol/host policy.

- [ ] **Step 1: Write failing boundary tests**

Cover: missing/invalid bearer rejected; caller UID ignores body UID; arrays rejected for object bodies; body fields outside allowlists removed/rejected; strings/counts/body sizes bounded; upstream errors return fixed messages; `http:` rejected in production; `file:`, `javascript:`, `data:`, UNC paths, credentials-in-URL, and localhost rebinding forms rejected by external navigation; upload MIME/size/count and resolved paths enforced.

```ts
expect(() => validateHttpsUrl("http://example.com", { production: true })).toThrow("HTTPS obrigatorio.");
expect(normalizeSafeError(new Error("token=secret path=C:\\Users\\Alice"))).toEqual({ error: "Falha ao processar a solicitacao." });
```

- [ ] **Step 2: Run focused tests and confirm RED**

Run: `npx vitest run tests/server-security-boundaries.test.ts tests/external-url-security.test.ts`

Expected: FAIL because protections are distributed/inconsistent.

- [ ] **Step 3: Implement and apply shared server boundaries**

Use Express `json({ limit: "1mb", strict: true })`, closed Zod schemas with `.strict()`, explicit response mappers, and safe errors. Apply per-IP public limiter, per-authenticated-user private limiter, stricter auth-start limiter, and fixed maximum request counts already represented by `steamAuthLimiter`, `steamPrivateLimiter`, and catalog limiters. Set `trust proxy` to exactly `1` only in production Render deployment. No response includes upstream body, stack, key, token, filesystem path, or Supabase service error.

Audit every mutation route in `server/index.mjs`: it must use `requireAuth` before its handler and derive identity from `req.user.id`. Audit existing attachment/upload endpoints: maximum 10 MiB per file, maximum 4 files/request, allowlisted MIME and extension pairs, random server-generated names, and resolved storage path beneath the configured upload root.

- [ ] **Step 4: Centralize external URL validation**

Allow `https:` globally. Allow `steam:` only for Steam launcher URLs, `com.epicgames.launcher:` only for game launch URLs, and local callback scheme already registered by the app only for exact callback actions. Reject URL usernames/passwords, control characters, noncanonical IP spellings, and remote `http:`. Use the validator before every `shell.openExternal`.

- [ ] **Step 5: Bind development server explicitly**

Change `startServer({ host = process.env.NODE_ENV === "production" ? "0.0.0.0" : "127.0.0.1" } = {})` and pass `host` to `app.listen(port, host, ...)`. Production HTTPS is terminated by Render; honor forwarded protocol only from the one trusted proxy and redirect or reject non-HTTPS production requests except `/health` if Render requires it.

- [ ] **Step 6: Run tests and commit**

Run: `npx vitest run tests/server-security-boundaries.test.ts tests/external-url-security.test.ts tests/ipc-security.test.ts`

Expected: PASS.

```powershell
git add -- server/security-boundaries.mjs server/index.mjs electron/main.cjs tests/server-security-boundaries.test.ts tests/external-url-security.test.ts
git commit -m "security: validate network and mutation boundaries"
```

### Task 4: Upgrade vulnerable direct dependencies

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify files importing React Router only if the v7 compatibility test identifies a compile/runtime change.
- Test: `tests/dependency-security-contract.test.ts`

**Interfaces:**
- No new runtime API; preserves the existing routing behavior and Electron security preferences.

- [ ] **Step 1: Write a failing version-floor test**

```ts
expect(versionAtLeast(pkg.devDependencies.dompurify, "3.4.14")).toBe(true);
expect(versionAtLeast(pkg.devDependencies["react-router-dom"], "7.18.3")).toBe(true);
expect(versionAtLeast(pkg.devDependencies.electron, "44.0.0")).toBe(true);
expect(versionAtLeast(pkg.dependencies["express-rate-limit"], "8.7.0")).toBe(true);
expect(versionAtLeast(pkg.dependencies.helmet, "8.3.0")).toBe(true);
```

Use the actual dependency sections from `package.json`; the helper strips `^`/`~` and compares numeric semver.

- [ ] **Step 2: Run focused test and confirm RED**

Run: `npx vitest run tests/dependency-security-contract.test.ts`

Expected: FAIL on current versions.

- [ ] **Step 3: Install exact security versions**

Run:

```powershell
npm install --save-exact express-rate-limit@8.7.0 helmet@8.3.0
npm install --save-dev --save-exact dompurify@3.4.14 react-router-dom@7.18.3 concurrently@9.2.4 electron@44.0.0
```

Run `npm dedupe` so fixed `ip-address >=10.4.0`, `js-yaml >=4.3.1`, and `body-parser >=2.3.0` are selected where dependency ranges allow. Do not use `npm audit fix --force`.

- [ ] **Step 4: Resolve only demonstrated compatibility failures**

Run `npm run test:typecheck`, focused navigation/auth tests, and Electron release contract tests. If React Router v7 flags removed APIs, replace imports according to compiler errors while preserving current route definitions; if Electron 44 changes packaging behavior, adjust only builder/smoke configuration proven by `npm run dist:windows` and `npm run release:smoke`.

- [ ] **Step 5: Verify audits and commit**

Run: `npm audit --omit=dev --audit-level=high`

Run: `npm audit --audit-level=high`

Expected: both exit 0 with zero high/critical findings.

```powershell
git add -- package.json package-lock.json tests/dependency-security-contract.test.ts src electron scripts
git commit -m "security: upgrade vulnerable dependencies"
```

### Task 5: Secret and leakage scanner

**Files:**
- Create: `scripts/scan-secrets.cjs`
- Test: `tests/secret-scanner.test.ts`
- Modify: `.gitignore`
- Modify: `.env.example`

**Interfaces:**
- CLI exits 0 when clean, 1 on findings, 2 on scanner failure.
- Flags only file/commit/path/line number and rule ID; never prints matched secret text.

- [ ] **Step 1: Write failing scanner tests**

Create temporary Git repositories and cover tracked `.env`, `sk-proj-`, Supabase service-role JWT marker, Discord/Google secret assignments, PEM private keys, GitHub tokens, allowlisted `.env.example` placeholders, binary files, and a secret removed from HEAD but present in history.

```ts
expect(runScan(repoWithHistoricalSecret)).toMatchObject({ status: 1, stdout: expect.stringContaining("OPENAI_KEY") });
expect(runScan(repoWithHistoricalSecret).stdout).not.toContain(actualSecret);
```

- [ ] **Step 2: Run focused test and confirm RED**

Run: `npx vitest run tests/secret-scanner.test.ts`

Expected: FAIL because the scanner is absent.

- [ ] **Step 3: Implement deterministic redacted scanning**

Use `spawnSync("git", ["grep", "-I", "-n", "-E", pattern, "--", ...])` for tracked files and `spawnSync("git", ["log", "-p", "--all", "--no-ext-diff", "--text"])` for history. Apply regex rules in memory, discard matched values, and emit only `RULE_ID path:line` or `RULE_ID commit`. Reject tracked `.env`, `.pem`, `.key`, `.p12`, and certificate private material. Exclude documented dummy values containing `example`, `replace_me`, or repeated placeholder characters.

- [ ] **Step 4: Harden ignored/example configuration**

Ensure `.env`, `.env.*` except `.env.example`, credential directories, downloaded Legendary config, certificate/key formats, and build secret outputs are ignored. `.env.example` contains names and safe descriptions only, no realistic token-shaped values.

- [ ] **Step 5: Run scanner/tests and commit**

Run: `npx vitest run tests/secret-scanner.test.ts && node scripts/scan-secrets.cjs`

Expected: PASS and scanner exits 0. If a real historical secret is found, stop release work, rotate it at the provider, then remove it from history with an explicitly reviewed history-rewrite procedure.

```powershell
git add -- scripts/scan-secrets.cjs tests/secret-scanner.test.ts .gitignore .env.example
git commit -m "security: scan tracked files and history for secrets"
```

### Task 6: Automated 20-point release gate

**Files:**
- Create: `scripts/security-gate.cjs`
- Create: `.github/workflows/security.yml`
- Create: `docs/security/release-gate.md`
- Modify: `package.json`
- Modify: `scripts/verify-release.cjs`
- Test: `tests/security-gate.test.ts`

**Interfaces:**
- Produces npm scripts `security:secrets`, `security:audit`, `security:gate`.
- Gate produces a redacted JSON summary at `artifacts/security-gate.json` and exits nonzero on required-control failure.

- [ ] **Step 1: Write failing gate tests**

Inject fake command results and assert the gate fails for secret findings, high audit findings, missing CSP, public Epic private routes, raw Steam HTML, missing RLS/RPC checks, non-HTTPS production URL, unrestricted upload contract, or failed test/build. Assert the JSON contains control IDs 1 through 20, status, command name, duration, and no command stdout containing secrets.

- [ ] **Step 2: Run focused test and confirm RED**

Run: `npx vitest run tests/security-gate.test.ts`

Expected: FAIL because gate/scripts/docs do not exist.

- [ ] **Step 3: Implement the gate command matrix**

The gate runs, in order:

```text
node scripts/scan-secrets.cjs
npm audit --omit=dev --audit-level=high
npm audit --audit-level=high
npx vitest run tests/sanitize-store-html.test.ts tests/content-security-policy.test.ts tests/server-security-boundaries.test.ts tests/external-url-security.test.ts tests/platform-purge-migration.test.ts tests/ipc-security.test.ts tests/dependency-security-contract.test.ts
npm run test:typecheck
npm run typecheck
npm run lint
npm run build
npm run release:verify
```

Map evidence to all 20 supplied controls. Password hashing is satisfied by Supabase Auth with no launcher password storage; bot protection is satisfied by authenticated platform mutations plus auth/public rate limits, and the document records Supabase Auth CAPTCHA as a dashboard deployment prerequisite for email/password signup if that provider is enabled. Public-key DB access records anon-key plus RLS; encryption records TLS and local credential isolation.

- [ ] **Step 4: Add CI workflow**

Run on `push`, `pull_request`, and Monday 09:00 UTC schedule using Windows for packaged contracts and Ubuntu for the fast security gate. Use Node version from the project's existing CI, `npm ci`, least-privilege `contents: read`, no fork secrets, and upload only the redacted JSON artifact on failure/success.

- [ ] **Step 5: Write operator documentation**

For each control 1–20, document implementation location, automated evidence, manual deployment setting, failure owner, and release-blocking status. Include secret rotation steps without example secret values, dependency exception format with owner/rationale/expiry, Supabase RLS verification, HTTPS/Render proxy configuration, and packaged Windows smoke evidence.

- [ ] **Step 6: Run full gate and commit**

Run: `npx vitest run tests/security-gate.test.ts && npm run security:gate`

Expected: PASS with all 20 controls recorded and no high/critical audit findings.

```powershell
git add -- scripts/security-gate.cjs .github/workflows/security.yml docs/security/release-gate.md package.json package-lock.json scripts/verify-release.cjs tests/security-gate.test.ts
git commit -m "security: enforce release gate"
```

### Task 7: Windows package security acceptance

**Files:**
- Modify: `scripts/smoke-installer.ps1`
- Modify: `docs/security/release-gate.md`
- Modify: `RELEASE_NOTES.md`

**Interfaces:**
- Produces final release evidence for the Windows desktop artifact.

- [ ] **Step 1: Build the portable Windows artifact**

Run: `npm run dist:windows`

Expected: builder exits 0 and release verification finds no bundled `.env`, credential file, private key, server-side Legendary module, or unverified `bin/legendary.exe`.

- [ ] **Step 2: Run automated smoke and inspect security preferences**

Run: `npm run release:smoke`

Expected: main and overlay windows use `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, `webSecurity: true`; unsafe navigation/popups/permissions are denied; Epic status uses secure IPC.

- [ ] **Step 3: Perform manual desktop acceptance**

Verify packaged launch, Supabase login, Steam browser callback, Epic local login, sync skeletons, offline sync retention, both disconnect animations, complete cleanup/retry, external links, game launch schemes, gamepad/keyboard navigation, reduced motion, and absence of a remotely served web launcher.

- [ ] **Step 4: Record evidence and commit**

Add artifact version/hash, test timestamp, audit counts, smoke result, and manual acceptance result to the release-gate document and summarize security changes in `RELEASE_NOTES.md` without credentials or local paths.

```powershell
git add -- scripts/smoke-installer.ps1 docs/security/release-gate.md RELEASE_NOTES.md
git commit -m "docs: record Windows security acceptance"
```

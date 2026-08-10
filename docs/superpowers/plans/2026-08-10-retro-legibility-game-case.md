# Retro Legibility and Interactive Game Case Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the full-frame CRT readable, enlarge the collection and interface, and add a smooth two-stage physical PS2 case interaction with an opening cover and rotating disc.

**Architecture:** Keep navigation and accessibility state in `RetroGamingPage`, express inspection transitions through a small pure state reducer, and keep physical mesh animation inside focused Three.js components. Extend the existing CRT profile with explicit exposure and black-lift controls so visual calibration remains testable and independent from collection interaction.

**Tech Stack:** React 19, TypeScript, React Three Fiber, Three.js, Vitest, Testing Library, GLSL, Electron.

## Global Constraints

- Preserve the full-frame WebGL CRT treatment and the existing warm neutral/red palette.
- Do not add a downloaded 3D-model dependency; construct the articulated case from repo-native Three.js geometry.
- Keep existing keyboard, gamepad, sound, filtering, accessibility, and WebGL fallback behavior.
- Selection settles in approximately 650–850 ms without bounce; opening settles in approximately 800–1000 ms.
- Reduced motion stops disc rotation and uses short direct transitions.
- Only the optimized runtime artwork may be committed; original scans remain untouched and untracked.

---

### Task 1: Deterministic inspection interaction

**Files:**
- Create: `src/features/retro/retroInspection.ts`
- Create: `tests/retro-inspection.test.ts`

**Interfaces:**
- Produces: `RetroInspectionState`, `RetroInspectionEvent`, and `reduceRetroInspection(state, event)`.
- State shape: `{ selectedIndex: number; inspectedIndex: number | null; playRequested: boolean }`.
- Events: `SELECT`, `CONFIRM`, `CANCEL`, and `PLAY_HANDLED`.

- [ ] **Step 1: Write failing reducer tests**

Cover these exact behaviors: selecting a different index closes inspection; first confirm opens the selected case; second confirm sets `playRequested`; cancel closes an open case; cancel with no open case leaves state unchanged.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm test -- tests/retro-inspection.test.ts`

Expected: FAIL because `retroInspection` does not exist.

- [ ] **Step 3: Implement the pure reducer**

Use exhaustive event switching and return a new object only when state changes. `SELECT` clears `playRequested`; `CONFIRM` opens before requesting play; `CANCEL` clears only `inspectedIndex`; `PLAY_HANDLED` clears only `playRequested`.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run: `npm test -- tests/retro-inspection.test.ts`

Expected: all reducer tests pass.

- [ ] **Step 5: Commit**

```powershell
git add -- src/features/retro/retroInspection.ts tests/retro-inspection.test.ts
git commit -m "feat(retro): model game case inspection flow"
```

### Task 2: Readable CRT profile

**Files:**
- Modify: `src/features/retro/retroCrt.ts`
- Modify: `src/features/retro/retroShaders.ts`
- Modify: `src/features/retro/RetroCrtPass.tsx`
- Modify: `tests/retro-crt.test.ts`

**Interfaces:**
- Extends `CrtProfile` with `exposure: number` and `blackLift: number`.
- `RetroCrtPass` maps both values to shader uniforms.

- [ ] **Step 1: Add failing profile assertions**

Assert the standard profile has `exposure` between `1.2` and `1.3`, `blackLift` between `0.012` and `0.025`, vignette at most `0.28`, scanline at most `0.12`, and noise at most `0.025`.

- [ ] **Step 2: Run the CRT tests and verify RED**

Run: `npm test -- tests/retro-crt.test.ts`

Expected: FAIL on the absent exposure/black-lift values and old dark profile.

- [ ] **Step 3: Implement the balanced profile and shader mapping**

Start calibration at `exposure: 1.25`, `blackLift: 0.018`, `vignette: 0.26`, `scanline: 0.11`, `noise: 0.022`, and `bloom: 0.2`. Apply exposure before scanlines, lift shadows after vignette, then use a mild `pow(color, vec3(0.94))` response. Retain existing curvature and chromatic aberration.

- [ ] **Step 4: Run CRT tests and verify GREEN**

Run: `npm test -- tests/retro-crt.test.ts`

- [ ] **Step 5: Commit**

```powershell
git add -- src/features/retro/retroCrt.ts src/features/retro/retroShaders.ts src/features/retro/RetroCrtPass.tsx tests/retro-crt.test.ts
git commit -m "feat(retro): improve CRT legibility"
```

### Task 3: Articulated case and disc

**Files:**
- Create: `src/features/retro/RetroDisc.tsx`
- Modify: `src/features/retro/RetroGameCase.tsx`
- Modify: `src/features/retro/RetroShelf.tsx`

**Interfaces:**
- `RetroDisc` consumes `{ game: RetroGame; visible: boolean; reducedMotion: boolean }`.
- `RetroGameCase` gains `inspected: boolean` and `reducedMotion: boolean`.
- `RetroShelf` gains `inspectedIndex: number | null` and `reducedMotion: boolean`.

- [ ] **Step 1: Add static component coverage to the page test mock boundary**

Extend `tests/retro-gaming-page.test.tsx` to assert that first confirmation reports the case as open semantically and does not play; a second confirmation exposes the play action.

- [ ] **Step 2: Run the page test and verify RED**

Run: `npm test -- tests/retro-gaming-page.test.tsx`

Expected: FAIL because inspection state and labels do not exist.

- [ ] **Step 3: Build the disc component**

Create a procedural `CanvasTexture` label using the game title, console, and accent. Render a reflective disc with a center hole and inner hub. Rotate only while visible and when reduced motion is false; dispose the generated texture on unmount.

- [ ] **Step 4: Split the case around a hinge**

Keep the rear shell and tray fixed. Put the front shell, sleeve, and cover artwork under a group pivoted at the left edge. Damp the hinge from `0` to roughly `-1.92` radians when inspected. Keep selection translation, rotation, and scale damped with a slower coefficient around `5.5`; use a high coefficient for reduced motion.

- [ ] **Step 5: Wire shelf inspection props**

Pass inspection only to the active case. Increase focal scale approximately 30%, space neighbors to retain visible spines, and move the shelf slightly upward so the enlarged title block still fits.

- [ ] **Step 6: Run focused tests and verify GREEN**

Run: `npm test -- tests/retro-gaming-page.test.tsx tests/retro-collection.test.ts`

- [ ] **Step 7: Commit**

```powershell
git add -- src/features/retro/RetroDisc.tsx src/features/retro/RetroGameCase.tsx src/features/retro/RetroShelf.tsx tests/retro-gaming-page.test.tsx
git commit -m "feat(retro): add articulated game case and disc"
```

### Task 4: Page state, inputs, and semantic controls

**Files:**
- Modify: `src/pages/RetroGamingPage.tsx`
- Modify: `src/features/retro/RetroInterface.tsx`
- Modify: `tests/retro-gaming-page.test.tsx`

**Interfaces:**
- Consumes `reduceRetroInspection` from Task 1.
- Passes `inspectedIndex` and `reducedMotion` to `RetroShelf`.
- `RetroInterface` receives `inspectionOpen` and changes the action label between `ABRIR CAIXA` and `JOGAR`.

- [ ] **Step 1: Add failing keyboard and semantic tests**

Test that Enter opens the case, a second Enter invokes the play path, Escape closes inspection before invoking `onReturnToStandard`, and changing decade closes inspection.

- [ ] **Step 2: Run focused tests and verify RED**

Run: `npm test -- tests/retro-gaming-page.test.tsx`

- [ ] **Step 3: Integrate reducer state**

Route selected-case clicks, Enter, and gamepad confirm through `CONFIRM`. Route Escape and gamepad cancel through `CANCEL` before returning. Dispatch `SELECT` when navigation/filtering swaps the active index. Preserve transition locking and current sounds.

- [ ] **Step 4: Update semantic and WebGL interface labels**

Expose `Abrir caixa do jogo selecionado` while closed and `Jogar jogo selecionado` while open. Announce inspection state in the live region. Show the visible action button without requiring hover.

- [ ] **Step 5: Run focused tests and verify GREEN**

Run: `npm test -- tests/retro-gaming-page.test.tsx tests/retro-inspection.test.ts`

- [ ] **Step 6: Commit**

```powershell
git add -- src/pages/RetroGamingPage.tsx src/features/retro/RetroInterface.tsx tests/retro-gaming-page.test.tsx
git commit -m "feat(retro): integrate case inspection controls"
```

### Task 5: Interface hierarchy and visual calibration

**Files:**
- Modify: `src/features/retro/RetroInterface.tsx`
- Modify: `src/features/retro/RetroShelf.tsx`
- Modify: `src/features/retro/RetroGameCase.tsx`

**Interfaces:**
- No new public interfaces; this task calibrates existing layout values.

- [ ] **Step 1: Increase the hierarchy values**

Increase main title approximately 45%; increase header/filter/action text 40–50%; increase metadata/footer 35–40%; enlarge active controls and hit planes in proportion. Keep the warm palette unchanged.

- [ ] **Step 2: Calibrate game-case scale and spacing**

Target active-case height at 35–42% of a 1440×900 viewport. Ensure the opened cover and disc do not overlap the nearest spines. Keep at least three neighboring spines visible when the `ALL` filter is active.

- [ ] **Step 3: Run targeted lint and tests**

Run: `npx eslint src/features/retro src/pages/RetroGamingPage.tsx tests/retro-*.test.ts tests/retro-*.test.tsx`

Run: `npm test -- tests/retro-collection.test.ts tests/retro-crt.test.ts tests/retro-inspection.test.ts tests/retro-gaming-page.test.tsx`

- [ ] **Step 4: Commit**

```powershell
git add -- src/features/retro/RetroInterface.tsx src/features/retro/RetroShelf.tsx src/features/retro/RetroGameCase.tsx
git commit -m "style(retro): strengthen cinematic hierarchy"
```

### Task 6: Electron calibration and full verification

**Files:**
- Modify only the retro files above if calibration finds a concrete issue.
- Do not commit temporary preview helpers or screenshots.

**Interfaces:**
- Final acceptance gate only.

- [ ] **Step 1: Run the full automated gates**

Run: `npm run test:ci`

Run: `npm run build`

Run targeted ESLint from Task 5. Run global `npm run lint` and distinguish pre-existing unrelated failures from retro-file failures.

- [ ] **Step 2: Capture the real Electron scene**

Launch Electron with `ELECTRON_RUN_AS_NODE` removed, render at 1440×900, navigate repeatedly, open/close the case, and capture a temporary screenshot. Confirm there is no `webglcontextlost` event.

- [ ] **Step 3: Inspect visual acceptance**

Confirm readable filters and metadata, cover detail in midtones, visible CRT character, focal-case size, unobscured disc, smooth selection retargeting, and stable repeated open/close input.

- [ ] **Step 4: Remove temporary preview artifacts**

Delete only the exact temporary helper and screenshot paths after confirming them. Preserve original cover scans and all unrelated dirty-worktree files.

- [ ] **Step 5: Commit any final calibration**

Stage only retro implementation files, review `git diff --cached`, and commit with `fix(retro): finalize game case presentation` only if calibration required changes.

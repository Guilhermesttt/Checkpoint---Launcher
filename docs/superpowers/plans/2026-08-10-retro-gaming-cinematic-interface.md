# Retro Gaming Cinematic Interface Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the draft retro page with a fullscreen Three.js collection whose complete visible interface receives a PS2-era CRT post-process.

**Architecture:** Pure collection and transition helpers feed a React Three Fiber scene made of physical cases plus SDF text controls. A custom render-to-texture pass composites the entire scene through one CRT fragment shader, while a visually hidden DOM mirror preserves semantic input and announcements.

**Tech Stack:** React 19, TypeScript 6, React Three Fiber, Drei, Three.js, Vitest, Testing Library, Framer Motion preferences, local WOFF2 font assets.

## Global Constraints

- Work only in the retro feature, its tests, local font dependency/assets, and the approved plan; preserve every unrelated working-tree change.
- Preserve the existing near-black, warm-white, and retro-red palette.
- Render every visible element in the WebGL composition; DOM controls remain visually hidden.
- Preserve return behavior, sound preferences, keyboard navigation, and gamepad-compatible semantic controls.
- Keep achievements, API integration, emulation, installation, launching logic, and detailed game pages out of scope.
- Target 60 FPS with canvas DPR constrained to `[1, 1.5]` and no React state updates per frame.

---

### Task 1: Collection and transition behavior

**Files:**
- Create: `src/features/retro/retroCollection.ts`
- Create: `tests/retro-collection.test.ts`

**Interfaces:**
- Produces: `RetroGame`, `RetroFilter`, `RETRO_COLLECTION`, `RETRO_FILTERS`, `filterRetroGames(games, filterId)`, `getWrappedIndex(index, direction, length)`, and `getSelectionAtFilterChange(games, filterId)`.
- Consumes: existing God of War cover import.

- [ ] **Step 1: Write failing tests for filtering, empty results, and circular navigation**

```ts
import { describe, expect, it } from "vitest";
import { filterRetroGames, getSelectionAtFilterChange, getWrappedIndex } from "../src/features/retro/retroCollection";

const games = [
  { id: "a", title: "A", subtitle: "", year: 1998, console: "PS1", publisher: "TEST", accent: "#ef4444" },
  { id: "b", title: "B", subtitle: "", year: 2005, console: "PS2", publisher: "TEST", accent: "#ef4444" },
];

describe("retro collection behavior", () => {
  it("filters a decade using an inclusive start and exclusive end", () => {
    expect(filterRetroGames(games, "1990s").map((game) => game.id)).toEqual(["a"]);
  });

  it("returns an empty collection for a decade without games", () => {
    expect(filterRetroGames(games, "1980s")).toEqual([]);
  });

  it("wraps previous and next selection at both boundaries", () => {
    expect(getWrappedIndex(0, -1, 2)).toBe(1);
    expect(getWrappedIndex(1, 1, 2)).toBe(0);
  });

  it("resets filter selection to the first matching game", () => {
    expect(getSelectionAtFilterChange(games, "2000s")).toEqual({ games: [games[1]], selectedIndex: 0 });
  });
});
```

- [ ] **Step 2: Run `npm test -- tests/retro-collection.test.ts` and confirm failure because the module does not exist**
- [ ] **Step 3: Implement the typed collection and minimal pure helpers**
- [ ] **Step 4: Run the focused test and confirm all four behaviors pass**
- [ ] **Step 5: Commit only the collection helper and its test**

### Task 2: CRT configuration and transition controller

**Files:**
- Create: `src/features/retro/retroCrt.ts`
- Create: `tests/retro-crt.test.ts`

**Interfaces:**
- Produces: `CrtProfile`, `getCrtProfile(reducedMotion)`, `createRetroTransition(durationMs)`, and `RetroTransitionController` with `start(now)`, `sample(now)`, and `isLocked(now)`.
- Consumes: no React or Three.js objects.

- [ ] **Step 1: Write failing tests proving normal/reduced profiles and a single swap point**

```ts
import { describe, expect, it } from "vitest";
import { createRetroTransition, getCrtProfile } from "../src/features/retro/retroCrt";

describe("retro CRT behavior", () => {
  it("removes continuous flicker and reduces sync displacement for reduced motion", () => {
    expect(getCrtProfile(true)).toMatchObject({ flicker: 0, syncTear: 0.08 });
    expect(getCrtProfile(false).flicker).toBeGreaterThan(0);
  });

  it("emits the selection swap once at peak distortion", () => {
    const transition = createRetroTransition(420);
    transition.start(1000);
    expect(transition.sample(1170).shouldSwap).toBe(false);
    expect(transition.sample(1210).shouldSwap).toBe(true);
    expect(transition.sample(1220).shouldSwap).toBe(false);
  });

  it("locks duplicate selection commands only while active", () => {
    const transition = createRetroTransition(420);
    transition.start(1000);
    expect(transition.isLocked(1100)).toBe(true);
    expect(transition.isLocked(1421)).toBe(false);
  });
});
```

- [ ] **Step 2: Run `npm test -- tests/retro-crt.test.ts` and confirm the missing-module failure**
- [ ] **Step 3: Implement deterministic profiles and the one-shot transition controller**
- [ ] **Step 4: Run the focused test and confirm all three behaviors pass**
- [ ] **Step 5: Commit only the controller and its test**

### Task 3: Full-frame CRT renderer

**Files:**
- Create: `src/features/retro/RetroCrtPass.tsx`
- Create: `src/features/retro/retroShaders.ts`
- Modify: `package.json`
- Modify: `package-lock.json`

**Interfaces:**
- Consumes: `CrtProfile`, `transitionSignal`, React Three Fiber `gl`, `scene`, `camera`, and `size`.
- Produces: `<RetroCrtPass reducedMotion transitionSignal />`, which renders the active R3F scene to a managed `WebGLRenderTarget` and then draws a fullscreen quad.

- [ ] **Step 1: Add local STIX Two Text font package metadata and install it with npm so the lockfile remains authoritative**
- [ ] **Step 2: Implement vertex and fragment shaders with analytic barrel UV distortion, overscan mask, RGB edge separation, scanlines, phosphor mask, nine-tap soft bloom, animated noise, warm tone, vignette, and transition sync tear**
- [ ] **Step 3: Implement the render target lifecycle, resize handling, per-frame uniform mutation, context-safe disposal, priority-one render loop, and WebGL context lost/restored callbacks**
- [ ] **Step 4: Run `npm run build` and resolve shader/component type failures before continuing**
- [ ] **Step 5: Commit the pass, shaders, and font dependency changes**

### Task 4: Physical collection and canvas interface

**Files:**
- Create: `src/features/retro/RetroGameCase.tsx`
- Create: `src/features/retro/RetroShelf.tsx`
- Create: `src/features/retro/RetroInterface.tsx`
- Create: `src/features/retro/retroFonts.ts`

**Interfaces:**
- Consumes: `RetroGame`, selected index, filter state, callbacks, local WOFF2 URLs, and frame delta.
- Produces: physical cases with procedural fallback faces/spines, bounded shelf layout, and WebGL-only header/filter/metadata/navigation/footer controls.

- [ ] **Step 1: Create local font URL exports for STIX Two Text and existing Unbounded variable assets**
- [ ] **Step 2: Implement cached cover texture loading with sRGB configuration, failure fallback, and safe disposal**
- [ ] **Step 3: Implement case geometry and damped shelf/featured transforms without elastic overshoot or disc animation**
- [ ] **Step 4: Implement responsive canvas typography and enlarged invisible raycast hit areas for every visible control**
- [ ] **Step 5: Run `npm run build` and correct all R3F/Drei type errors**
- [ ] **Step 6: Commit the physical collection and interface components**

### Task 5: Page orchestration and semantic mirror

**Files:**
- Replace: `src/pages/RetroGamingPage.tsx`
- Create: `tests/retro-gaming-page.test.tsx`

**Interfaces:**
- Consumes: collection helpers, transition controller, R3F components, `usePreferences`, `useSoundEffects`, and `onReturnToStandard`.
- Produces: the public `RetroGamingPage` route with fullscreen canvas and hidden semantic controls.

- [ ] **Step 1: Write a failing jsdom test that mocks only the WebGL canvas boundary and exercises real semantic controls**

```tsx
// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

describe("RetroGamingPage semantic interface", () => {
  it("moves circularly and announces the active game", async () => {
    render(<RetroGamingPage />);
    fireEvent.click(screen.getByRole("button", { name: "Jogo anterior" }));
    expect(screen.getByRole("status")).toHaveTextContent("The Legend of Zelda");
  });

  it("returns through the supplied callback", () => {
    const onReturn = vi.fn();
    render(<RetroGamingPage onReturnToStandard={onReturn} />);
    fireEvent.click(screen.getByRole("button", { name: "Voltar ao launcher" }));
    expect(onReturn).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run `npm test -- tests/retro-gaming-page.test.tsx` and confirm failure against the draft page contract**
- [ ] **Step 3: Replace the draft with a fullscreen Canvas, orthographic scene, CRT pass, transition state machine, visually hidden semantic controls sharing the same handlers as WebGL controls, and a recoverable DOM message shown only while WebGL context is unavailable**
- [ ] **Step 4: Add keyboard ArrowLeft/ArrowRight/Enter/Escape behavior and gamepad-compatible focusable buttons without per-frame state updates**
- [ ] **Step 5: Run the focused page and pure-behavior tests until green**
- [ ] **Step 6: Commit the page and integration test**

### Task 6: Verification and visual calibration

**Files:**
- Modify only files from Tasks 1-5 if verification exposes a defect.

**Interfaces:**
- Consumes: the completed retro feature.
- Produces: fresh verification evidence and a calibrated Electron result.

- [ ] **Step 1: Run `npm test -- tests/retro-collection.test.ts tests/retro-crt.test.ts tests/retro-gaming-page.test.tsx`**
- [ ] **Step 2: Run `npm run test:typecheck`**
- [ ] **Step 3: Run ESLint against changed source and test files**
- [ ] **Step 4: Run `npm run build`**
- [ ] **Step 5: Launch the desktop app with `ELECTRON_RUN_AS_NODE` unset and inspect hierarchy, readability, resize behavior, input, sounds, and transition faults**
- [ ] **Step 6: Compare the final diff and working-tree status to ensure no unrelated local changes were included**
- [ ] **Step 7: Commit only verification-driven fixes, if any**

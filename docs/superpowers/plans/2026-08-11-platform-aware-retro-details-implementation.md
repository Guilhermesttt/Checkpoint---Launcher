# Platform-Aware Retro Details Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a PlayStation 2-inspired vertical details interface and a shared TV/hardware/game 3D composition that follows the selected retro platform.

**Architecture:** Keep the existing Canvas and selected case lifecycle in `RetroGamingPage`. Add a pure platform registry and node classifiers, then compose an isolated PVM television and registry-driven hardware through small React Three Fiber components; the HTML details layer becomes one vertical scrollable text column without changing its service, focus, sound, or input contracts.

**Tech Stack:** React 19, TypeScript 6, React Three Fiber 9, Drei 10, Three.js 0.184, Framer Motion, Tailwind CSS, Vitest 4, Testing Library

## Global Constraints

- Preserve every current color value, opacity, font, launch behavior, RetroAchievements integration, focus restoration, sound, keyboard control, gamepad control, and reduced-motion behavior.
- Preserve CRT insets `top: 4.5%`, `bottom: 4.5%`, `left: 12.7083%`, and `right: 12.6042%`.
- Use `--retro-tv-curve: clamp(8px, 1.1vw, 20px)` for both viewport `border-radius` and `clip-path`.
- Do not mutate or dispose shared `useGLTF` scenes, geometries, materials, or cached source textures.
- Dispose only instance-owned cloned materials and textures, idempotently and null-safely.
- Keep the selected game case or cartridge visible in detail mode.
- Unknown platforms show no incorrect hardware and keep the text interface plus game case usable.
- Add no postprocessing dependency; use the existing `RetroCrtPass` bloom plus an emissive TV screen and real Three.js light.
- Preserve unrelated staged, unstaged, and untracked work. Every commit uses explicit paths and `git commit --only`.

---

### Task 1: Centralize the smaller CRT curvature

**Files:**
- Create: `src/features/retro/crt/retroViewport.ts`
- Modify: `src/pages/RetroGamingPage.tsx:311-318`
- Modify: `src/index.css:978-988`
- Modify: `tests/retro-gaming-page.test.tsx`

**Interfaces:**
- Produces `RETRO_TV_CURVE: "clamp(8px, 1.1vw, 20px)"`.
- `RetroGamingPage` exposes the value through the inline custom property `--retro-tv-curve` on the CRT viewport.
- CSS consumes `var(--retro-tv-curve)` for both clipping declarations.

- [ ] **Step 1: Add the failing rendered-style test**

Extend the existing centered-viewport test:

```tsx
const viewport = screen.getByRole("main", { name: "Acervo de jogos retrô" });
expect(viewport).toHaveStyle({
  "--retro-tv-curve": "clamp(8px, 1.1vw, 20px)",
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npx vitest run tests/retro-gaming-page.test.tsx`

Expected: FAIL because the viewport does not expose `--retro-tv-curve`.

- [ ] **Step 3: Implement the shared curve contract**

Create:

```ts
export const RETRO_TV_CURVE = "clamp(8px, 1.1vw, 20px)" as const;
```

Import it in `RetroGamingPage`, type the custom property with `CSSProperties & { "--retro-tv-curve": string }`, and apply it to `<main>`. Replace both current radius clamps in CSS with `var(--retro-tv-curve)` while leaving all four insets unchanged.

- [ ] **Step 4: Run the test and verify GREEN**

Run: `npx vitest run tests/retro-gaming-page.test.tsx`

Expected: all page tests pass.

- [ ] **Step 5: Commit only the curvature contract**

```powershell
git add src/features/retro/crt/retroViewport.ts src/pages/RetroGamingPage.tsx src/index.css tests/retro-gaming-page.test.tsx
git commit --only -m "fix(retro): align CRT viewport curvature" -- src/features/retro/crt/retroViewport.ts src/pages/RetroGamingPage.tsx src/index.css tests/retro-gaming-page.test.tsx
```

### Task 2: Add the typed platform registry and aliases

**Files:**
- Create: `src/features/retro/platform/retroPlatformRegistry.ts`
- Create: `tests/retro-platform-registry.test.ts`

**Interfaces:**
- Produces `type RetroPlatformKey = "ps1" | "ps2" | "snes" | "nes"`.
- Produces `interface RetroPlatformDefinition { key; modelUrl; targetWidth; position; rotation; aliases }`.
- Produces `resolveRetroPlatform(consoleName: string): RetroPlatformDefinition | null`.

- [ ] **Step 1: Write the failing alias and fallback tests**

```ts
expect(resolveRetroPlatform("PS1")?.key).toBe("ps1");
expect(resolveRetroPlatform("PlayStation")?.key).toBe("ps1");
expect(resolveRetroPlatform("PSX")?.key).toBe("ps1");
expect(resolveRetroPlatform("PlayStation 2")?.key).toBe("ps2");
expect(resolveRetroPlatform("Super Nintendo")?.key).toBe("snes");
expect(resolveRetroPlatform("Super NES")?.key).toBe("snes");
expect(resolveRetroPlatform("Nintendo Entertainment System")?.key).toBe("nes");
expect(resolveRetroPlatform("Switch")).toBeNull();
```

Also assert exact model URL suffixes:

```ts
expect(resolveRetroPlatform("PS1")?.modelUrl).toContain("sony_pvm-1341__sony_playstation.glb");
expect(resolveRetroPlatform("PS2")?.modelUrl).toContain("sony_playstation_2.glb");
expect(resolveRetroPlatform("SNES")?.modelUrl).toContain("super_yes.glb");
expect(resolveRetroPlatform("NES")?.modelUrl).toContain("nes_console_and_controller.glb");
```

- [ ] **Step 2: Run the test and verify RED**

Run: `npx vitest run tests/retro-platform-registry.test.ts`

Expected: FAIL resolving the missing registry module.

- [ ] **Step 3: Implement the immutable registry**

Import the four GLB URLs and define normalized uppercase aliases. Use one lookup map built once at module evaluation. Set finite calibration values for each definition:

```ts
export interface RetroPlatformDefinition {
  key: RetroPlatformKey;
  modelUrl: string;
  targetWidth: number;
  position: readonly [number, number, number];
  rotation: readonly [number, number, number];
  aliases: readonly string[];
}
```

Unknown or blank input returns `null`.

- [ ] **Step 4: Run the test and verify GREEN**

Run: `npx vitest run tests/retro-platform-registry.test.ts`

Expected: all registry tests pass.

- [ ] **Step 5: Commit only the registry**

```powershell
git add src/features/retro/platform/retroPlatformRegistry.ts tests/retro-platform-registry.test.ts
git commit --only -m "feat(retro): register platform detail hardware" -- src/features/retro/platform/retroPlatformRegistry.ts tests/retro-platform-registry.test.ts
```

### Task 3: Separate TV and hardware nodes and clone owned materials

**Files:**
- Create: `src/features/retro/platform/retroPlatformModel.ts`
- Create: `tests/retro-platform-model.test.ts`

**Interfaces:**
- Produces `type PvmNodeRole = "television" | "ps1-hardware" | "discard"`.
- Produces `classifyPvmNode(name: string): PvmNodeRole`.
- Produces `shouldKeepPlatformNode(key: RetroPlatformKey, name: string): boolean`.
- Produces `cloneFilteredPlatformScene(source: THREE.Object3D, keepNode: (name: string) => boolean, targetWidth: number): { scene: THREE.Object3D; materials: THREE.Material[]; scale: number }`.
- Produces `disposeOwnedPlatformMaterials(materials: readonly THREE.Material[]): void`.

- [ ] **Step 1: Write failing pure node-role tests**

```ts
expect(classifyPvmNode("main_body_27")).toBe("television");
expect(classifyPvmNode("front_panel_24")).toBe("television");
expect(classifyPvmNode("glass_and_fence_25")).toBe("television");
expect(classifyPvmNode("Ps1_body_18")).toBe("ps1-hardware");
expect(classifyPvmNode("ps_controller.001_4")).toBe("ps1-hardware");
expect(classifyPvmNode("ps_cable_19")).toBe("ps1-hardware");
expect(shouldKeepPlatformNode("nes", "Console_0")).toBe(true);
expect(shouldKeepPlatformNode("nes", "Controller_1")).toBe(true);
expect(shouldKeepPlatformNode("ps2", "DualShock_Controller")).toBe(false);
expect(shouldKeepPlatformNode("snes", "Cylinder001_03 - Default_0")).toBe(true);
```

- [ ] **Step 2: Add failing ownership and normalization tests**

Build an in-memory `THREE.Group` with kept and rejected meshes. Assert the source material remains attached and undisposed, the clone receives a distinct material, rejected meshes are absent, the computed scale is finite, and calling `disposeOwnedPlatformMaterials()` twice does not throw.

- [ ] **Step 3: Run the tests and verify RED**

Run: `npx vitest run tests/retro-platform-model.test.ts`

Expected: FAIL resolving the missing model helper.

- [ ] **Step 4: Implement filtering, material ownership, and bounds normalization**

Clone the hierarchy, remove rejected meshes from the clone only, replace every kept mesh material with a clone, and calculate width normalization from `new THREE.Box3().setFromObject(scene)`. Track disposed materials in a module-private `WeakSet<THREE.Material>` so disposal is idempotent. Never call `geometry.dispose()` because geometry remains shared.

- [ ] **Step 5: Run the tests and verify GREEN**

Run: `npx vitest run tests/retro-platform-model.test.ts`

Expected: role, source-ownership, filtering, normalization, and idempotent-disposal tests pass.

- [ ] **Step 6: Commit only the model helpers**

```powershell
git add src/features/retro/platform/retroPlatformModel.ts tests/retro-platform-model.test.ts
git commit --only -m "feat(retro): isolate platform GLB ownership" -- src/features/retro/platform/retroPlatformModel.ts tests/retro-platform-model.test.ts
```

### Task 4: Build the shared PVM television and platform hardware renderers

**Files:**
- Create: `src/features/retro/platform/RetroPlatformModelBoundary.tsx`
- Create: `src/features/retro/platform/RetroPvmTelevision.tsx`
- Create: `src/features/retro/platform/RetroPlatformHardware.tsx`
- Create: `src/features/retro/platform/RetroPlatformDisplay.tsx`
- Create: `tests/retro-platform-display.test.tsx`

**Interfaces:**
- `RetroPvmTelevisionProps = { artworkUrl?: string; reducedMotion: boolean }`.
- `RetroPlatformHardwareProps = { consoleName: string; reducedMotion: boolean }`.
- `RetroPlatformDisplayProps = { game: RetroGame; visible: boolean; reducedMotion: boolean }`.
- `RetroPlatformModelBoundary` renders `null` on a model failure and resets when `resetKey` changes.

- [ ] **Step 1: Write failing composition and fallback tests**

Mock the leaf TV and hardware components, then assert:

```tsx
render(<RetroPlatformDisplay game={game} visible reducedMotion={false} />);
expect(screen.getByTestId("retro-pvm-television")).toHaveAttribute("data-artwork", game.coverImage);
expect(screen.getByTestId("retro-platform-hardware")).toHaveAttribute("data-console", "PS2");
expect(screen.getByTestId("retro-tv-bloom-light")).toBeInTheDocument();
```

Rerender with `coverImage: undefined, wrapImage: "wrap.jpg"` and assert wrap priority. Rerender with `console: "SWITCH"` and assert the TV remains while hardware is absent.

- [ ] **Step 2: Run the test and verify RED**

Run: `npx vitest run tests/retro-platform-display.test.tsx`

Expected: FAIL resolving the missing display component.

- [ ] **Step 3: Implement the PVM television**

Load `sony_pvm-1341__sony_playstation.glb`, call `cloneFilteredPlatformScene()` with `classifyPvmNode(name) === "television"`, and dispose cloned materials on unmount. Render an owned screen plane with `meshBasicMaterial toneMapped={false}` using a cloned artwork texture when present, otherwise `color="#09090a"`. The screen plane must expose `data-testid="retro-pvm-screen"` on its group for tests.

- [ ] **Step 4: Implement the platform hardware loader and boundary**

Resolve the console through `resolveRetroPlatform()`. Return `null` for unsupported consoles. Load the selected URL, filter nodes with `shouldKeepPlatformNode()`, normalize to the definition's `targetWidth`, and apply the registry position/rotation. Place each load under `RetroPlatformModelBoundary resetKey={`${definition.key}:${definition.modelUrl}`}` and `Suspense fallback={null}`.

- [ ] **Step 5: Compose the stable right-side stage and bloom light**

Render TV and hardware under independent boundaries. Add a warm light originating at the TV screen:

```tsx
<pointLight
  data-testid="retro-tv-bloom-light"
  position={[1.15, 0.25, 2.25]}
  color="#fcf1d4"
  intensity={2.4}
  distance={6.5}
  decay={2}
/>
```

Use `game.coverImage ?? game.wrapImage` for TV artwork. Gate scale/visibility without unmounting the selected game case. Reduced motion removes drift from TV and hardware groups.

- [ ] **Step 6: Run the display tests and verify GREEN**

Run: `npx vitest run tests/retro-platform-display.test.tsx tests/retro-platform-model.test.ts`

Expected: all composition, fallback, and ownership tests pass.

- [ ] **Step 7: Commit only the shared display components**

```powershell
git add src/features/retro/platform/RetroPlatformModelBoundary.tsx src/features/retro/platform/RetroPvmTelevision.tsx src/features/retro/platform/RetroPlatformHardware.tsx src/features/retro/platform/RetroPlatformDisplay.tsx tests/retro-platform-display.test.tsx
git commit --only -m "feat(retro): compose shared TV and platform hardware" -- src/features/retro/platform/RetroPlatformModelBoundary.tsx src/features/retro/platform/RetroPvmTelevision.tsx src/features/retro/platform/RetroPlatformHardware.tsx src/features/retro/platform/RetroPlatformDisplay.tsx tests/retro-platform-display.test.tsx
```

### Task 5: Drive the Canvas stage from the selected game

**Files:**
- Modify: `src/pages/RetroGamingPage.tsx:17-23,370-405`
- Modify: `tests/retro-gaming-page.test.tsx`
- Keep: `src/features/retro/ps2/RetroPs2ConsoleDisplay.tsx`

**Interfaces:**
- `RetroGamingPage` renders `<RetroPlatformDisplay game={activeGame} visible={view !== "library"} reducedMotion={prefersReducedMotion} />`.
- The existing `RetroShelf` still receives `detailMode`, `revealed`, and the selected game, preserving the game case or cartridge.

- [ ] **Step 1: Replace the old source assertion with a failing platform-aware page test**

Mock `RetroPlatformDisplay`, enter details, advance the existing 720ms transition, and assert:

```tsx
expect(screen.getByTestId("retro-platform-display")).toHaveAttribute("data-game", "gow");
expect(screen.getByTestId("retro-platform-display")).toHaveAttribute("data-visible", "true");
```

Keep the existing assertion that `RetroGameCase.tsx` contains `detailIdleMotion`.

- [ ] **Step 2: Run the page test and verify RED**

Run: `npx vitest run tests/retro-gaming-page.test.tsx`

Expected: FAIL because `RetroGamingPage` still renders `RetroPs2ConsoleDisplay`.

- [ ] **Step 3: Replace the fixed PS2 display in the Canvas**

Import `RetroPlatformDisplay`, render it only when `activeGame` exists, and remove the `RetroPs2ConsoleDisplay` usage/import from this page. Do not delete the old component because it remains a tested PS2 adapter reference. Do not change camera, case selection, CRT pass, lights unrelated to the new TV, transitions, or modal routing.

- [ ] **Step 4: Run page and GLB adapter regressions**

Run: `npx vitest run tests/retro-gaming-page.test.tsx tests/retro-ps2-console-display.test.ts tests/retro-real-case.test.tsx`

Expected: all tests pass.

- [ ] **Step 5: Commit only the Canvas integration**

```powershell
git add src/pages/RetroGamingPage.tsx tests/retro-gaming-page.test.tsx
git commit --only -m "feat(retro): select detail hardware by platform" -- src/pages/RetroGamingPage.tsx tests/retro-gaming-page.test.tsx
```

### Task 6: Convert details navigation to the vertical PS2 text menu

**Files:**
- Modify: `src/features/retro/components/RetroGameDetailsScreen.tsx:45-216`
- Modify: `src/features/retro/components/RetroDetailTabs.tsx`
- Modify: `tests/retro-game-details-screen.test.tsx`

**Interfaces:**
- Keep `type RetroDetailTab = "play" | "about" | "achievements"` and all existing component props.
- The tablist changes from horizontal tabs to a vertical `aria-orientation="vertical"` list.
- Arrow Up/Down and D-pad Up/Down cycle menu items; L1/R1 continue cycling sections.

- [ ] **Step 1: Write failing vertical layout and scroll tests**

```tsx
const tablist = screen.getByRole("tablist", { name: "Informações de God of War" });
expect(tablist).toHaveAttribute("aria-orientation", "vertical");
expect(tablist).toHaveClass("flex-col");
expect(screen.getByRole("tabpanel")).toHaveClass("overflow-y-auto");
expect(screen.getByRole("dialog", { name: "Detalhes de God of War" })
  .querySelector("section")).toHaveClass("w-[clamp(280px,34vw,460px)]");
```

- [ ] **Step 2: Extend interaction tests for vertical navigation**

Press `ArrowDown` and assert `SOBRE` is selected; press `ArrowUp` and assert `JOGAR` is selected. Invoke captured gamepad `DPAD_DOWN` and assert `SOBRE`. Preserve assertions for R1, O, launch, configure, close sound, and focus restoration.

- [ ] **Step 3: Run details tests and verify RED**

Run: `npx vitest run tests/retro-game-details-screen.test.tsx tests/retro-achievements-panel.test.tsx`

Expected: FAIL because the tablist is horizontal and arrow Up/Down currently moves generic action focus.

- [ ] **Step 4: Implement the vertical column**

Set the details section width to `w-[clamp(280px,34vw,460px)]`, retain responsive outer spacing, remove card-grid decoration from the play panel, and render a simple vertical text tablist. Keep active/inactive color classes exactly as they are today. Put the active panel immediately below the list in the same `min-h-0 flex-1 overflow-y-auto` column. Keep the current launch/configure footer and error alert.

- [ ] **Step 5: Update keyboard and gamepad mapping**

Use Arrow Up/Down for `moveTab(-1|1)`. Keep Arrow Left/Right as an optional compatibility mapping only when focus is on the tablist. Register D-pad Up/Down to `moveTab`; when focus is inside a panel action, X still activates the focused button. Preserve L1/R1 cycling and O close.

- [ ] **Step 6: Run the details tests and verify GREEN**

Run: `npx vitest run tests/retro-game-details-screen.test.tsx tests/retro-achievements-panel.test.tsx tests/retro-achievements-service.test.ts`

Expected: vertical layout, scroll, launch/configure, achievements, sound, keyboard, and gamepad tests pass.

- [ ] **Step 7: Commit only the PS2-style details interface**

```powershell
git add src/features/retro/components/RetroGameDetailsScreen.tsx src/features/retro/components/RetroDetailTabs.tsx tests/retro-game-details-screen.test.tsx
git commit --only -m "feat(retro): simplify details into PS2 text menu" -- src/features/retro/components/RetroGameDetailsScreen.tsx src/features/retro/components/RetroDetailTabs.tsx tests/retro-game-details-screen.test.tsx
```

### Task 7: Complete gates and visual calibration

**Files:**
- Modify only feature files already listed above when a gate exposes a defect.

**Interfaces:**
- Produces test, typecheck, lint, build, model-fallback, and visual evidence for all approved requirements.

- [ ] **Step 1: Run all focused retro gates**

```powershell
npx vitest run tests/retro-platform-registry.test.ts tests/retro-platform-model.test.ts tests/retro-platform-display.test.tsx tests/retro-gaming-page.test.tsx tests/retro-game-details-screen.test.tsx tests/retro-achievements-panel.test.tsx tests/retro-ps2-console-display.test.ts tests/retro-real-case.test.tsx
```

Expected: all focused tests pass with zero unhandled errors.

- [ ] **Step 2: Run project-wide automated gates separately**

```powershell
npm run test:typecheck
npm test
npm run lint
npm run build
```

Expected: all commands exit 0. Report any pre-existing warning separately; do not call a warning-only run zero-warning.

- [ ] **Step 3: Inspect the scoped diff and forbidden changes**

```powershell
git diff --check -- src/features/retro/crt/retroViewport.ts src/features/retro/platform src/features/retro/components/RetroGameDetailsScreen.tsx src/features/retro/components/RetroDetailTabs.tsx src/pages/RetroGamingPage.tsx src/index.css tests/retro-platform-registry.test.ts tests/retro-platform-model.test.ts tests/retro-platform-display.test.tsx tests/retro-game-details-screen.test.tsx tests/retro-gaming-page.test.tsx
git diff -- src/features/retro/crt/retroViewport.ts src/features/retro/platform src/features/retro/components/RetroGameDetailsScreen.tsx src/features/retro/components/RetroDetailTabs.tsx src/pages/RetroGamingPage.tsx src/index.css tests/retro-platform-registry.test.ts tests/retro-platform-model.test.ts tests/retro-platform-display.test.tsx tests/retro-game-details-screen.test.tsx tests/retro-gaming-page.test.tsx
```

Expected: no palette change, no launcher/RetroAchievements contract change, no deletion of existing case or PS2 adapter code, and no unrelated file staged by this implementation.

- [ ] **Step 4: Run visual checks when a browser or Electron surface is available**

At 1600x900 and 1280x720 verify PS1, PS2, SNES, and NES individually: smaller matching CRT curvature; one vertical left text menu; no clipping; shared PVM; correct hardware; selected game case/cartridge; artwork screen; visible bloom; TV light reaching hardware and game; functional scrolling; close/launch; focus restoration; reduced motion. For an unsupported Switch game verify the PVM and case remain while no incorrect hardware appears.

- [ ] **Step 5: Commit only gate-driven corrections when necessary**

If a gate required changes, stage only the already-listed feature/test paths and commit with:

```powershell
git commit --only -m "test(retro): satisfy platform detail gates" -- src/features/retro/crt/retroViewport.ts src/features/retro/platform/retroPlatformRegistry.ts src/features/retro/platform/retroPlatformModel.ts src/features/retro/platform/RetroPlatformModelBoundary.tsx src/features/retro/platform/RetroPvmTelevision.tsx src/features/retro/platform/RetroPlatformHardware.tsx src/features/retro/platform/RetroPlatformDisplay.tsx src/features/retro/components/RetroGameDetailsScreen.tsx src/features/retro/components/RetroDetailTabs.tsx src/pages/RetroGamingPage.tsx src/index.css tests/retro-platform-registry.test.ts tests/retro-platform-model.test.ts tests/retro-platform-display.test.tsx tests/retro-game-details-screen.test.tsx tests/retro-gaming-page.test.tsx
```

Do not create this commit when no gate-driven correction was needed.

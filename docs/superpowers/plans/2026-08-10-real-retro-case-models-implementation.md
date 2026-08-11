# Real Retro Case Models Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace procedural PS1, PS2, SNES, and NES shelf visuals with reproducibly processed real GLBs whose artwork, materials, texture cache, and disposal lifecycle remain isolated per game.

**Architecture:** A Node-only GLB preparation pipeline validates the four immutable source assets, removes unwanted scene content, emits stable runtime mesh roles, and writes deterministic processed files plus a signed manifest. A declarative runtime registry selects one shared React Three Fiber renderer; the renderer clones scene materials and artwork textures per game, shares immutable geometry, and falls back to the existing procedural case on unsupported platforms or model failures.

**Tech Stack:** Electron, React 19, TypeScript 6, React Three Fiber 9, Drei 10, Three.js 0.184, glTF Transform 4.4.2, Vite, Vitest 4, Testing Library.

## Global Constraints

- Keep `src/assets/3D_OBJS/dvdgame_case(1).glb`, `ps1_case_-_deathtrap_dungeon_1998.glb`, `super_nintendo_cartridge.glb`, and `nes_cartridge__super_mario_bros.glb` unchanged.
- Runtime imports only processed assets under `src/assets/3D_OBJS/cases/`.
- PS2 output contains no CD, disc art, disc fingerprint, camera, or light meshes.
- PS1 output contains only the closed right-side `front.001_1/Object_7` case.
- SNES and NES expose independent `cartridge_body` and `cartridge_label` meshes; their label is an offline-generated calibrated surface over the original front face.
- PS1 and PS2 expose `case_body`, optional `case_transparent`, `artwork_front`, `artwork_spine`, and `artwork_back` roles.
- `wrapImage` wins over `coverImage`; a case wrap uses atlas UV channel 1, while a cover or cartridge label uses normalized UV channel 0.
- No custom artwork leaves embedded model artwork intact.
- Source `useGLTF` scenes, geometries, materials, and cached loader textures are never mutated or disposed by a game instance.
- `RetroProceduralCase3D` remains the fallback for unsupported consoles, GLB errors, loading, and missing role contracts.
- Preserve existing shelf selection, continuous rotation, reduced-motion, pointer, keyboard, gamepad, sound, details navigation, and Play behavior.
- No model or texture failure may reach React Router's default error page or throw a null `dispose` error.
- Do not change `GameDetailPanel.tsx`, RetroAchievements credentials/routes, or the approved retro details layout.
- Record source URL, author, CC BY 4.0 license, attribution, and filename for each supplied case/cartridge asset.
- Preserve all unrelated staged, unstaged, and untracked work. Every commit in this plan uses explicit paths and `git commit --only`.

---

## File Structure

- `scripts/lib/retro-case-model-config.mjs`: immutable source signatures, source structure, license metadata, output names, normalization axes, and cartridge-label calibration.
- `scripts/lib/retro-case-model-pipeline.mjs`: NodeIO setup, source verification, geometry partitioning, label-surface creation, UV channel generation, role validation, manifest creation, and atomic writes.
- `scripts/prepare-retro-case-models.mjs`: CLI for generation and `--check` verification.
- `src/assets/3D_OBJS/cases/*.processed.glb`: generated runtime assets.
- `src/assets/3D_OBJS/cases/retro-case-models.manifest.json`: source/output hashes, adapter version, and emitted role contract.
- `src/features/retro/retroCaseModelRegistry.ts`: platform aliases, processed GLB URLs, physical kind, required roles, and runtime transform calibration.
- `src/features/retro/useRetroArtworkTexture.ts`: null-safe shared source-texture cache; cache entries are never disposed by an instance.
- `src/features/retro/retroCaseInstance.ts`: pure Three.js scene/material/texture cloning, artwork assignment, bounds normalization, and idempotent owned-resource disposal.
- `src/features/retro/RetroCaseModelBoundary.tsx`: resettable model error boundary.
- `src/features/retro/RetroPhysicalGameCase.tsx`: shared processed-GLB renderer.
- `src/features/retro/RetroGameCaseVisual.tsx`: real-model selection, Suspense fallback, error fallback, and procedural fallback.
- `src/features/retro/RetroGameCase.tsx`: existing selection/rotation shell; delegates only its visual child.
- `assets/THIRD_PARTY_3D_ASSETS.md`: case/cartridge attribution records.
- `scripts/verify-retro-assets.cjs`: packaged asset and attribution checks.

### Task 1: Lock source contracts, licenses, and GLB tooling

**Files:**
- Modify: `package.json:13-32`
- Modify: `package-lock.json`
- Create: `scripts/lib/retro-case-model-config.mjs`
- Modify: `assets/THIRD_PARTY_3D_ASSETS.md`
- Add source asset: `src/assets/3D_OBJS/ps1_case_-_deathtrap_dungeon_1998.glb`
- Add source asset: `src/assets/3D_OBJS/super_nintendo_cartridge.glb`
- Add source asset: `src/assets/3D_OBJS/nes_cartridge__super_mario_bros.glb`
- Test: `tests/retro-case-model-config.test.ts`

**Interfaces:**
- Produces `RETRO_CASE_SOURCE_MODELS`, keyed by `ps2 | ps1 | snes | nes`.
- Produces `getRetroCaseSourceDefinition(key)` and `verifyRetroCaseSource(rootDir, definition)`.
- Each definition contains `source`, `output`, `sha256`, `requiredNodes`, `excludedNodes`, `requiredRoles`, `license`, `orientation`, and optional `labelSurface`.

- [ ] **Step 1: Write the failing source-contract test**

```ts
import { describe, expect, it } from "vitest";
import {
  RETRO_CASE_SOURCE_MODELS,
  verifyRetroCaseSource,
} from "../scripts/lib/retro-case-model-config.mjs";

describe("retro case source contracts", () => {
  it("pins all four approved source files and their redistribution metadata", async () => {
    expect(Object.keys(RETRO_CASE_SOURCE_MODELS)).toEqual([
      "ps2",
      "ps1",
      "snes",
      "nes",
    ]);

    for (const definition of Object.values(RETRO_CASE_SOURCE_MODELS)) {
      await expect(
        verifyRetroCaseSource(process.cwd(), definition),
      ).resolves.toMatchObject({ sha256: definition.sha256 });
      expect(definition.license.id).toBe("CC-BY-4.0");
      expect(definition.license.sourceUrl).toMatch(
        /^https:\/\/sketchfab\.com\/3d-models\//,
      );
    }
  });

  it("pins the exact PS2 media exclusions and PS1 closed hierarchy", () => {
    expect(RETRO_CASE_SOURCE_MODELS.ps2.excludedNodes).toEqual([
      "Cylinder_CD Colored_0",
      "Cylinder_CD Black_0",
      "Cylinder_CD Art_0",
      "Circle_Fingerprint_0",
      "Camera",
      "Light",
    ]);
    expect(RETRO_CASE_SOURCE_MODELS.ps1.requiredNodes).toContain("Object_7");
    expect(RETRO_CASE_SOURCE_MODELS.ps1.keepHierarchy).toBe(
      "front.001_1/Object_7",
    );
  });
});
```

- [ ] **Step 2: Run the contract test and verify the module is missing**

Run: `npx vitest run tests/retro-case-model-config.test.ts`

Expected: FAIL resolving `scripts/lib/retro-case-model-config.mjs`.

- [ ] **Step 3: Install the offline GLB tooling at the inspected version**

Run: `npm install --save-dev @gltf-transform/core@4.4.2 @gltf-transform/extensions@4.4.2 @gltf-transform/functions@4.4.2`

Expected: `package.json` and `package-lock.json` contain all three development dependencies; no runtime dependency changes.

- [ ] **Step 4: Implement the pinned source definitions and verifier**

Use these exact SHA-256 values and metadata:

```js
export const RETRO_CASE_SOURCE_MODELS = Object.freeze({
  ps2: {
    key: "ps2",
    source: "src/assets/3D_OBJS/dvdgame_case(1).glb",
    output: "ps2-dvd-case.processed.glb",
    sha256: "D1318FEB2C4E623B783B81497174390E8C4FE22E98B63614FBF604E51B8AEB82",
    requiredNodes: ["Case_Plastic_0", "Case_Art.001_0", "Plastic_Transparent_0"],
    excludedNodes: ["Cylinder_CD Colored_0", "Cylinder_CD Black_0", "Cylinder_CD Art_0", "Circle_Fingerprint_0", "Camera", "Light"],
    requiredRoles: ["case_body", "case_transparent", "artwork_front", "artwork_spine", "artwork_back"],
    orientation: { up: "+z", front: "+y" },
    license: {
      id: "CC-BY-4.0",
      author: "Raphael Frei",
      sourceUrl: "https://sketchfab.com/3d-models/dvdgame-case-d5c542e24bee490fbdf130413983f124",
      title: "DVD/Game Case",
    },
  },
  ps1: {
    key: "ps1",
    source: "src/assets/3D_OBJS/ps1_case_-_deathtrap_dungeon_1998.glb",
    output: "ps1-jewel-case.processed.glb",
    sha256: "3823120BBEFDE4D2A079459E1341D582E4113945B10DE13BB9B5D53CBD87818D",
    requiredNodes: ["front.001_1", "Object_7"],
    excludedNodes: ["front_0", "Object_4", "Object_5"],
    keepHierarchy: "front.001_1/Object_7",
    requiredRoles: ["case_body", "artwork_front", "artwork_spine", "artwork_back"],
    orientation: { up: "+z", front: "+y" },
    license: {
      id: "CC-BY-4.0",
      author: "Macky",
      sourceUrl: "https://sketchfab.com/3d-models/ps1-case-deathtrap-dungeon-1998-81b96419863f4ac29a1713b27c600813",
      title: "PS1 Case - Deathtrap Dungeon (1998)",
    },
  },
  snes: {
    key: "snes",
    source: "src/assets/3D_OBJS/super_nintendo_cartridge.glb",
    output: "snes-cartridge.processed.glb",
    sha256: "DF691EE466E68C53B83266ED90744BAA007839E201B6ECDBD64676EACEA75EFC",
    requiredNodes: ["Solid_5_my_super_nicE-carte_0"],
    excludedNodes: [],
    requiredRoles: ["cartridge_body", "cartridge_label"],
    orientation: { up: "+y", front: "+z" },
    labelSurface: { widthRatio: 0.72, heightRatio: 0.58, centerYRatio: 0.08, frontOffsetRatio: 0.0015 },
    license: {
      id: "CC-BY-4.0",
      author: "SomeKevin",
      sourceUrl: "https://sketchfab.com/3d-models/super-nintendo-cartridge-b2076d8a65d648ff99bf51ca9d5fca2a",
      title: "Super Nintendo Cartridge",
    },
  },
  nes: {
    key: "nes",
    source: "src/assets/3D_OBJS/nes_cartridge__super_mario_bros.glb",
    output: "nes-cartridge.processed.glb",
    sha256: "95E098081142EAAC331D5046D66906F2D422B738EF8944574EEDC1BF07F014DE",
    requiredNodes: ["pCube1_lambert1_0"],
    excludedNodes: [],
    requiredRoles: ["cartridge_body", "cartridge_label"],
    orientation: { up: "+y", front: "+z" },
    labelSurface: { widthRatio: 0.72, heightRatio: 0.5, centerYRatio: 0.1, frontOffsetRatio: 0.0015 },
    license: {
      id: "CC-BY-4.0",
      author: "ConnorMartin",
      sourceUrl: "https://sketchfab.com/3d-models/nes-cartridge-super-mario-bros-098096e53cfc4f42a2ec833aff20fbea",
      title: "NES Cartridge | Super Mario Bros",
    },
  },
});
```

`verifyRetroCaseSource()` must stream the file through `createHash("sha256")`, compare the uppercase digest, and return `{ path, sha256 }`. It must throw `Retro case source hash mismatch: <key>` on drift.

- [ ] **Step 5: Append the four exact attribution rows**

Add a `Third-party retro game case and cartridge models` section to `assets/THIRD_PARTY_3D_ASSETS.md` using the titles, authors, CC BY 4.0 license, source URLs, and source filenames from the definitions above.

- [ ] **Step 6: Run the contract test**

Run: `npx vitest run tests/retro-case-model-config.test.ts`

Expected: PASS for all four hashes, hierarchy contracts, and license fields.

- [ ] **Step 7: Commit only source contracts and approved source assets**

```bash
git add package.json package-lock.json scripts/lib/retro-case-model-config.mjs assets/THIRD_PARTY_3D_ASSETS.md tests/retro-case-model-config.test.ts src/assets/3D_OBJS/ps1_case_-_deathtrap_dungeon_1998.glb src/assets/3D_OBJS/super_nintendo_cartridge.glb src/assets/3D_OBJS/nes_cartridge__super_mario_bros.glb
git commit --only -m "build(retro): pin real case model sources" -- package.json package-lock.json scripts/lib/retro-case-model-config.mjs assets/THIRD_PARTY_3D_ASSETS.md tests/retro-case-model-config.test.ts src/assets/3D_OBJS/ps1_case_-_deathtrap_dungeon_1998.glb src/assets/3D_OBJS/super_nintendo_cartridge.glb src/assets/3D_OBJS/nes_cartridge__super_mario_bros.glb
```

### Task 2: Generate and verify normalized runtime GLBs

**Files:**
- Create: `scripts/lib/retro-case-model-pipeline.mjs`
- Create: `scripts/prepare-retro-case-models.mjs`
- Modify: `package.json:28-32`
- Create: `tests/retro-case-model-pipeline.test.ts`
- Generate: `src/assets/3D_OBJS/cases/ps2-dvd-case.processed.glb`
- Generate: `src/assets/3D_OBJS/cases/ps1-jewel-case.processed.glb`
- Generate: `src/assets/3D_OBJS/cases/snes-cartridge.processed.glb`
- Generate: `src/assets/3D_OBJS/cases/nes-cartridge.processed.glb`
- Generate: `src/assets/3D_OBJS/cases/retro-case-models.manifest.json`

**Interfaces:**
- Produces `prepareRetroCaseModels({ rootDir, outputDir, check }): Promise<PrepareRetroCaseReport>`.
- Produces `inspectPreparedRetroCase(filePath): Promise<{ roles: string[]; meshCount: number; uvChannelsByRole: Record<string, number[]> }>`.
- The CLI accepts no flag for generation and exactly one optional `--check` flag for read-only verification.

- [ ] **Step 1: Write the failing pipeline integration tests**

```ts
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  inspectPreparedRetroCase,
  prepareRetroCaseModels,
} from "../scripts/lib/retro-case-model-pipeline.mjs";

describe("retro case GLB preparation", () => {
  it("emits stable roles and removes media or alternate variants", async () => {
    const outputDir = await mkdtemp(join(tmpdir(), "checkpoint-retro-cases-"));
    await prepareRetroCaseModels({ rootDir: process.cwd(), outputDir, check: false });

    const ps2 = await inspectPreparedRetroCase(join(outputDir, "ps2-dvd-case.processed.glb"));
    expect(ps2.roles).toEqual([
      "artwork_back",
      "artwork_front",
      "artwork_spine",
      "case_body",
      "case_transparent",
    ]);
    expect(ps2.roles.join(" ")).not.toMatch(/cd|disc/i);

    const ps1 = await inspectPreparedRetroCase(join(outputDir, "ps1-jewel-case.processed.glb"));
    expect(ps1.roles).toEqual([
      "artwork_back",
      "artwork_front",
      "artwork_spine",
      "case_body",
    ]);

    for (const key of ["snes", "nes"] as const) {
      const prepared = await inspectPreparedRetroCase(
        join(outputDir, `${key}-cartridge.processed.glb`),
      );
      expect(prepared.roles).toEqual(["cartridge_body", "cartridge_label"]);
      expect(prepared.uvChannelsByRole.cartridge_label).toEqual([0, 1]);
    }
  });

  it("check mode rejects a changed output without rewriting it", async () => {
    const outputDir = await mkdtemp(join(tmpdir(), "checkpoint-retro-cases-check-"));
    await prepareRetroCaseModels({ rootDir: process.cwd(), outputDir, check: false });
    const manifestPath = join(outputDir, "retro-case-models.manifest.json");
    const before = await readFile(manifestPath);

    await expect(
      prepareRetroCaseModels({ rootDir: process.cwd(), outputDir, check: true }),
    ).resolves.toMatchObject({ checked: 4 });
    expect(await readFile(manifestPath)).toEqual(before);
  });
});
```

- [ ] **Step 2: Run the test and confirm the pipeline module is missing**

Run: `npx vitest run tests/retro-case-model-pipeline.test.ts`

Expected: FAIL resolving `retro-case-model-pipeline.mjs`.

- [ ] **Step 3: Implement NodeIO, source validation, and atomic output**

Use the official scripting API with all standard extensions registered:

```js
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { prune } from "@gltf-transform/functions";

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);

async function writeAtomic(document, outputPath) {
  const bytes = await io.writeBinary(document);
  const temporaryPath = `${outputPath}.tmp`;
  await writeFile(temporaryPath, bytes);
  await rename(temporaryPath, outputPath);
}
```

Before mutation, verify the pinned SHA and every `requiredNodes` entry. Fail with `Missing required source node <name> for <key>` before creating a temporary output.

- [ ] **Step 4: Implement exact model adapters**

All retained source node transforms are baked into output geometry. Normalize output to +Y up, +Z front, centered on X/Y/Z, with the original physical proportions retained.

For PS2:

- Keep `Case_Plastic_0`, `Case_Art.001_0`, `Plastic_Transparent_0`, and `Plastic - Transparent_Fingerprint_0` only.
- Rename the plastic group `case_body` and transparent layers `case_transparent`.
- Split `Case_Art.001_0` triangles by transformed dominant normal and centroid into +Z `artwork_front`, -Z `artwork_back`, and the narrow connecting face `artwork_spine`.
- Remove every explicit excluded node before `prune()`.

For PS1:

- Copy only `front.001_1/Object_7` and discard every other source hierarchy.
- Split the transformed closed box faces into +Z `artwork_front`, -Z `artwork_back`, narrow -X `artwork_spine`, and the remaining bevel/edge faces `case_body`.

For both case adapters, use this UV contract:

```js
function attachArtworkUvChannels(document, primitive, role) {
  const atlas = primitive.getAttribute("TEXCOORD_0");
  const normalized = normalizeUvAccessor(document, atlas, role);
  primitive.setAttribute("TEXCOORD_0", normalized);
  primitive.setAttribute("TEXCOORD_1", atlas.clone());
  primitive.getMaterial()?.getBaseColorTextureInfo()?.setTexCoord(1);
}
```

`normalizeUvAccessor()` remaps that role's finite U/V minimum and maximum to `[0, 1]`; it rejects a zero-width or zero-height range.

For SNES and NES:

- Rename the retained source mesh to `cartridge_body` and preserve all original PBR textures/channels.
- Create `cartridge_label` as a four-vertex, two-triangle plane parallel to the normalized +Z front face.
- Derive its width, height, center-Y offset, and Z offset from the exact `labelSurface` ratios pinned in Task 1.
- Assign UV0 and UV1 as `[[0,0], [1,0], [1,1], [0,1]]` and clone the embedded body material for the initial label material.
- Set label normals to `[0,0,1]`, preserve finite tangents when present, and ensure its bounding box remains within the body's X/Y bounds.

- [ ] **Step 5: Validate roles, geometry, UVs, and output hashes**

Reject an output unless:

```js
const actualRoles = document.getRoot().listNodes()
  .map((node) => node.getName())
  .filter((name) => definition.requiredRoles.includes(name))
  .sort();

assert.deepEqual(actualRoles, [...definition.requiredRoles].sort());
assertEveryRequiredPrimitiveHasFinitePositionsNormalsAndUvs(document, definition);
assertNoNodeNames(document, definition.excludedNodes);
```

The manifest shape is:

```ts
interface RetroCaseModelManifest {
  adapterVersion: 1;
  models: Record<"ps2" | "ps1" | "snes" | "nes", {
    source: string;
    sourceSha256: string;
    output: string;
    outputSha256: string;
    roles: string[];
  }>;
}
```

Write the uppercase 64-character SHA-256 of the actual generated bytes to every `outputSha256`. Sort model keys and role arrays before serializing, use two-space JSON indentation, and terminate the manifest with one newline.

- [ ] **Step 6: Add generation and check commands**

```json
{
  "prepare:retro-cases": "node scripts/prepare-retro-case-models.mjs",
  "check:retro-cases": "node scripts/prepare-retro-case-models.mjs --check"
}
```

Reject unknown CLI arguments with exit code 1 and `Usage: node scripts/prepare-retro-case-models.mjs [--check]`.

- [ ] **Step 7: Run tests, generate committed outputs, and check idempotence**

Run: `npx vitest run tests/retro-case-model-config.test.ts tests/retro-case-model-pipeline.test.ts`

Expected: PASS.

Run: `npm run prepare:retro-cases`

Expected: four processed GLBs and one manifest written under `src/assets/3D_OBJS/cases/`.

Run: `npm run check:retro-cases`

Expected: exit 0 with `Retro case models verified: 4` and no changed files.

- [ ] **Step 8: Commit only the reproducible pipeline and generated outputs**

```bash
git add scripts/lib/retro-case-model-pipeline.mjs scripts/prepare-retro-case-models.mjs package.json tests/retro-case-model-pipeline.test.ts src/assets/3D_OBJS/cases
git commit --only -m "build(retro): prepare console-specific case models" -- scripts/lib/retro-case-model-pipeline.mjs scripts/prepare-retro-case-models.mjs package.json tests/retro-case-model-pipeline.test.ts src/assets/3D_OBJS/cases
```

### Task 3: Add the declarative runtime model registry

**Files:**
- Create: `src/features/retro/retroCaseModelRegistry.ts`
- Create: `tests/retro-case-model-registry.test.ts`

**Interfaces:**
- Produces `RetroCaseModelKey`, `RetroCasePhysicalKind`, `RetroCaseMeshRole`, and `RetroCaseModelDefinition`.
- Produces `normalizeRetroCaseConsole(consoleName: string): string`.
- Produces `resolveRetroCaseModel(consoleName: string): RetroCaseModelDefinition | undefined`.
- A definition exposes `key`, `url`, `kind`, `aliases`, `targetHeight`, `position`, `rotation`, and `requiredRoles`.

- [ ] **Step 1: Write failing alias and role tests**

```ts
import { describe, expect, it } from "vitest";
import {
  resolveRetroCaseModel,
  RETRO_CASE_MODEL_REGISTRY,
} from "../src/features/retro/retroCaseModelRegistry";

describe("retro physical case registry", () => {
  it.each([
    ["PS2", "ps2"],
    ["PlayStation 2", "ps2"],
    ["PS1", "ps1"],
    ["PlayStation", "ps1"],
    ["SNES", "snes"],
    ["Super Nintendo", "snes"],
    ["NES", "nes"],
    ["Nintendo Entertainment System", "nes"],
  ])("maps %s to %s", (input, expected) => {
    expect(resolveRetroCaseModel(input)?.key).toBe(expected);
  });

  it("does not guess unsupported console models", () => {
    expect(resolveRetroCaseModel("SWITCH")).toBeUndefined();
    expect(resolveRetroCaseModel("PSP")).toBeUndefined();
    expect(Object.keys(RETRO_CASE_MODEL_REGISTRY)).toEqual([
      "ps2",
      "ps1",
      "snes",
      "nes",
    ]);
  });
});
```

- [ ] **Step 2: Run the registry test and confirm the module is missing**

Run: `npx vitest run tests/retro-case-model-registry.test.ts`

Expected: FAIL resolving `retroCaseModelRegistry`.

- [ ] **Step 3: Implement the typed registry with processed asset imports**

```ts
import nesUrl from "../../assets/3D_OBJS/cases/nes-cartridge.processed.glb";
import ps1Url from "../../assets/3D_OBJS/cases/ps1-jewel-case.processed.glb";
import ps2Url from "../../assets/3D_OBJS/cases/ps2-dvd-case.processed.glb";
import snesUrl from "../../assets/3D_OBJS/cases/snes-cartridge.processed.glb";

export type RetroCaseModelKey = "ps2" | "ps1" | "snes" | "nes";
export type RetroCasePhysicalKind = "case" | "cartridge";
export type RetroCaseMeshRole =
  | "case_body"
  | "case_transparent"
  | "artwork_front"
  | "artwork_spine"
  | "artwork_back"
  | "cartridge_body"
  | "cartridge_label";

export interface RetroCaseModelDefinition {
  key: RetroCaseModelKey;
  url: string;
  kind: RetroCasePhysicalKind;
  aliases: readonly string[];
  targetHeight: number;
  position: readonly [number, number, number];
  rotation: readonly [number, number, number];
  requiredRoles: readonly RetroCaseMeshRole[];
}
```

Use target heights `2.02` for PS2, `1.72` for PS1, `1.35` for SNES, and `1.55` for NES. Processed assets are normalized, so all initial position and rotation tuples are `[0, 0, 0]`.

Normalize aliases with Unicode NFD, strip combining marks, lowercase, replace non-alphanumeric runs with one space, and trim. Build the alias lookup once at module initialization and throw on duplicate aliases mapped to different definitions.

- [ ] **Step 4: Run the registry tests**

Run: `npx vitest run tests/retro-case-model-registry.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit only the registry**

```bash
git add src/features/retro/retroCaseModelRegistry.ts tests/retro-case-model-registry.test.ts
git commit --only -m "feat(retro): register processed case models" -- src/features/retro/retroCaseModelRegistry.ts tests/retro-case-model-registry.test.ts
```

### Task 4: Isolate artwork, cloned materials, and disposal ownership

**Files:**
- Create: `src/features/retro/useRetroArtworkTexture.ts`
- Create: `src/features/retro/retroCaseInstance.ts`
- Create: `tests/retro-case-instance.test.ts`

**Interfaces:**
- Produces `useRetroArtworkTexture(url?: string): THREE.Texture | null`.
- Produces `resolveRetroArtwork({ coverTexture, wrapTexture, kind }): RetroArtworkSelection`.
- Produces `createRetroCaseInstance(sourceScene, definition, artwork): RetroCaseInstance`.
- `RetroCaseInstance` exposes `{ root, scale, position, ownedMaterials, ownedTextures, dispose() }`.

- [ ] **Step 1: Write failing priority, isolation, and disposal tests**

```ts
import { describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import {
  createRetroCaseInstance,
  resolveRetroArtwork,
} from "../src/features/retro/retroCaseInstance";
import { RETRO_CASE_MODEL_REGISTRY } from "../src/features/retro/retroCaseModelRegistry";

function sourceScene() {
  const root = new THREE.Group();
  for (const name of ["case_body", "artwork_front", "artwork_spine", "artwork_back"]) {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 0.1),
      new THREE.MeshStandardMaterial({ color: "#777777" }),
    );
    mesh.name = name;
    root.add(mesh);
  }
  return root;
}

describe("retro case instance ownership", () => {
  it("prefers wrap, otherwise limits cover to the front", () => {
    const cover = new THREE.Texture();
    const wrap = new THREE.Texture();
    expect(resolveRetroArtwork({ coverTexture: cover, wrapTexture: wrap, kind: "case" }))
      .toMatchObject({ mode: "wrap", texture: wrap, channel: 1 });
    expect(resolveRetroArtwork({ coverTexture: cover, wrapTexture: null, kind: "case" }))
      .toMatchObject({ mode: "cover", texture: cover, channel: 0 });
  });

  it("keeps two games isolated and disposes owned resources once", () => {
    const source = sourceScene();
    const sourceMaterial = (source.getObjectByName("artwork_front") as THREE.Mesh)
      .material as THREE.Material;
    const texture = new THREE.Texture();
    const first = createRetroCaseInstance(source, RETRO_CASE_MODEL_REGISTRY.ps2, {
      coverTexture: texture,
      wrapTexture: null,
    });
    const second = createRetroCaseInstance(source, RETRO_CASE_MODEL_REGISTRY.ps2, {
      coverTexture: texture,
      wrapTexture: null,
    });

    const firstFront = first.root.getObjectByName("artwork_front") as THREE.Mesh;
    const secondFront = second.root.getObjectByName("artwork_front") as THREE.Mesh;
    expect(firstFront.material).not.toBe(secondFront.material);
    expect(firstFront.material).not.toBe(sourceMaterial);
    expect((firstFront.material as THREE.MeshStandardMaterial).map)
      .not.toBe((secondFront.material as THREE.MeshStandardMaterial).map);

    const dispose = vi.spyOn(first.ownedMaterials[0], "dispose");
    first.dispose();
    first.dispose();
    expect(dispose).toHaveBeenCalledTimes(1);
    expect(() => second.dispose()).not.toThrow();
  });
});
```

- [ ] **Step 2: Run the test and confirm the lifecycle modules are missing**

Run: `npx vitest run tests/retro-case-instance.test.ts`

Expected: FAIL resolving `retroCaseInstance`.

- [ ] **Step 3: Implement the null-safe source texture cache**

`useRetroArtworkTexture` must cache `Promise<THREE.Texture | null>` by URL, configure successful source textures once, and never dispose cache entries:

```ts
texture.colorSpace = THREE.SRGBColorSpace;
texture.flipY = false;
texture.wrapS = THREE.ClampToEdgeWrapping;
texture.wrapT = THREE.ClampToEdgeWrapping;
texture.needsUpdate = true;
```

The hook uses an `active` flag in its effect cleanup so a stale load cannot update an unmounted or changed game. Loader errors resolve `null`; they do not reject into React.

- [ ] **Step 4: Implement artwork selection and instance cloning**

```ts
export function resolveRetroArtwork({ coverTexture, wrapTexture, kind }: ResolveArtworkInput): RetroArtworkSelection {
  if (wrapTexture) {
    return {
      mode: "wrap",
      texture: wrapTexture,
      channel: kind === "case" ? 1 : 0,
      roles: kind === "case"
        ? ["artwork_front", "artwork_spine", "artwork_back"]
        : ["cartridge_label"],
    };
  }
  if (coverTexture) {
    return {
      mode: "cover",
      texture: coverTexture,
      channel: 0,
      roles: kind === "case" ? ["artwork_front"] : ["cartridge_label"],
    };
  }
  return { mode: "embedded", texture: null, channel: 0, roles: [] };
}
```

`createRetroCaseInstance()` must:

1. Verify every `definition.requiredRoles` name exists before cloning; throw `Processed retro case <key> is missing role <role>` otherwise.
2. Clone the hierarchy with `sourceScene.clone(true)`.
3. Keep every mesh's geometry reference unchanged.
4. Clone every material or material-array entry and record it in `ownedMaterials`.
5. Clone the selected source artwork texture once per instance, set its `channel`, and record it in `ownedTextures`.
6. Assign that texture only to selected role materials supporting `map`; set color to white and `needsUpdate = true`.
7. Compute finite bounds, center the root, and scale it to `definition.targetHeight`.
8. Return an idempotent `dispose()` closing over a boolean; dispose each unique owned material and texture once, clear the arrays, and never traverse or dispose geometry.

- [ ] **Step 5: Run the lifecycle tests**

Run: `npx vitest run tests/retro-case-instance.test.ts tests/retro-play-scene-cleanup.test.tsx`

Expected: PASS, including repeated cleanup and a missing TV image.

- [ ] **Step 6: Commit only artwork and ownership boundaries**

```bash
git add src/features/retro/useRetroArtworkTexture.ts src/features/retro/retroCaseInstance.ts tests/retro-case-instance.test.ts
git commit --only -m "feat(retro): isolate case artwork resources" -- src/features/retro/useRetroArtworkTexture.ts src/features/retro/retroCaseInstance.ts tests/retro-case-instance.test.ts
```

### Task 5: Build the shared renderer and procedural fallback boundary

**Files:**
- Create: `src/features/retro/RetroCaseModelBoundary.tsx`
- Create: `src/features/retro/RetroPhysicalGameCase.tsx`
- Create: `src/features/retro/RetroGameCaseVisual.tsx`
- Create: `tests/retro-game-case-visual.test.tsx`

**Interfaces:**
- `RetroPhysicalGameCaseProps = { definition; coverTexture; wrapTexture }`.
- `RetroGameCaseVisualProps = { game; coverTexture; wrapTexture }`.
- `RetroCaseModelBoundaryProps = { resetKey: string; fallback: ReactNode; children: ReactNode }`.

- [ ] **Step 1: Write failing real-model, unsupported-model, and thrown-model tests**

Use jsdom and mock `RetroPhysicalGameCase` and `RetroProceduralCase3D` as HTML test doubles:

```tsx
it("uses a processed PS2 model and a procedural Switch fallback", () => {
  const { rerender } = render(
    <RetroGameCaseVisual game={game("PS2")} coverTexture={cover} wrapTexture={null} />,
  );
  expect(screen.getByTestId("physical-case")).toHaveAttribute("data-model", "ps2");

  rerender(
    <RetroGameCaseVisual game={game("SWITCH")} coverTexture={cover} wrapTexture={null} />,
  );
  expect(screen.getByTestId("procedural-case")).toBeInTheDocument();
});

it("resets to the procedural fallback when the GLB child throws", () => {
  render(
    <RetroCaseModelBoundary resetKey="ps2" fallback={<div data-testid="fallback" />}>
      <ThrowingModel />
    </RetroCaseModelBoundary>,
  );
  expect(screen.getByTestId("fallback")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the visual test and confirm the components are missing**

Run: `npx vitest run tests/retro-game-case-visual.test.tsx`

Expected: FAIL resolving `RetroGameCaseVisual`.

- [ ] **Step 3: Implement the resettable error boundary**

Use a class error boundary so loader errors thrown by the Suspense child are caught. `getDerivedStateFromError()` sets `failed: true`. In `componentDidUpdate`, if `resetKey` changed, reset to `failed: false`. Render the supplied fallback when failed; do not rethrow.

- [ ] **Step 4: Implement the processed GLB renderer**

```tsx
export function RetroPhysicalGameCase({
  definition,
  coverTexture,
  wrapTexture,
}: RetroPhysicalGameCaseProps) {
  const { scene } = useGLTF(definition.url);
  const instance = useMemo(
    () => createRetroCaseInstance(scene, definition, { coverTexture, wrapTexture }),
    [scene, definition, coverTexture, wrapTexture],
  );

  useEffect(() => () => instance.dispose(), [instance]);

  return (
    <group position={instance.position} scale={instance.scale} rotation={definition.rotation}>
      <primitive object={instance.root} dispose={null} />
    </group>
  );
}
```

Preload the four processed URLs after the component declaration. Do not preload source GLBs.

- [ ] **Step 5: Implement model selection with loading and failure fallback**

`RetroGameCaseVisual` resolves `game.console`. For no definition, render `RetroProceduralCase3D` immediately. For a definition, wrap `RetroPhysicalGameCase` in `RetroCaseModelBoundary` and `Suspense`, using the same procedural case element for both fallbacks. Set `resetKey` to `${definition.key}:${game.id}` so selecting a new game clears a prior failure.

- [ ] **Step 6: Run visual and lifecycle tests**

Run: `npx vitest run tests/retro-game-case-visual.test.tsx tests/retro-case-instance.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit only the shared renderer boundary**

```bash
git add src/features/retro/RetroCaseModelBoundary.tsx src/features/retro/RetroPhysicalGameCase.tsx src/features/retro/RetroGameCaseVisual.tsx tests/retro-game-case-visual.test.tsx
git commit --only -m "feat(retro): render real console-specific cases" -- src/features/retro/RetroCaseModelBoundary.tsx src/features/retro/RetroPhysicalGameCase.tsx src/features/retro/RetroGameCaseVisual.tsx tests/retro-game-case-visual.test.tsx
```

### Task 6: Integrate real cases into the rotating shelf

**Files:**
- Modify: `src/features/retro/RetroGameCase.tsx:1-215`
- Modify: `src/features/retro/retroModels.ts:1-31`
- Delete: `src/features/retro/RetroPs1GameCaseModel.tsx`
- Delete: `src/features/retro/RetroPs2GameCaseModel.tsx`
- Modify: `tests/retro-models.test.ts:1-24`
- Create: `tests/retro-game-case-integration.test.tsx`

**Interfaces:**
- `RetroGameCase` continues accepting the existing `game`, `position`, `selected`, `reducedMotion`, and `onSelect` props unchanged.
- `RetroGameCase` delegates only visual rendering to `RetroGameCaseVisual`.
- `retroModels.ts` retains `classifyJvcMesh`; runtime DVD source-node classification is removed.

- [ ] **Step 1: Write the failing shelf integration test**

Mock `useFrame`, `useRetroArtworkTexture`, and `RetroGameCaseVisual`. Render a PS2 game with both image URLs and assert:

```tsx
expect(screen.getByTestId("case-visual")).toHaveAttribute("data-console", "PS2");
expect(screen.getByTestId("case-visual")).toHaveAttribute("data-cover", "cover.jpg");
expect(screen.getByTestId("case-visual")).toHaveAttribute("data-wrap", "wrap.jpg");

fireEvent.click(container.querySelector("group")!);
expect(onSelect).toHaveBeenCalledTimes(1);
```

The test double for `useRetroArtworkTexture` returns distinct `THREE.Texture` objects for `cover.jpg` and `wrap.jpg`. The test double for `RetroGameCaseVisual` renders the received console and texture names as data attributes.

- [ ] **Step 2: Run the shelf test and verify it fails against the direct procedural child**

Run: `npx vitest run tests/retro-game-case-integration.test.tsx`

Expected: FAIL because `RetroGameCase` does not render `RetroGameCaseVisual`.

- [ ] **Step 3: Replace the in-file texture loader and direct procedural child**

In `RetroGameCase.tsx`:

- Remove `coverTextureCache`, `loadCoverTexture`, `useCoverTexture`, the unused `useSpineTexture`, and their cleanup effects.
- Import `useRetroArtworkTexture` and `RetroGameCaseVisual`.
- Resolve `coverTexture = useRetroArtworkTexture(game.coverImage)` and `wrapTexture = useRetroArtworkTexture(game.wrapImage)`.
- Replace the direct `<RetroProceduralCase3D>` child with:

```tsx
<RetroGameCaseVisual
  game={game}
  coverTexture={coverTexture}
  wrapTexture={wrapTexture}
/>
```

Do not modify `useFrame`, `SPIN_SPEED`, tilt constants, damping, pointer handlers, positions, or the `onSelect` contract.

- [ ] **Step 4: Remove obsolete runtime source-model heuristics**

Delete both experimental per-console model components. Remove `DvdCaseNodeRole` and `classifyDvdCaseNode` from `retroModels.ts`; retain `JvcMeshRole` and `classifyJvcMesh`. Remove only the DVD classification assertions from `tests/retro-models.test.ts`.

- [ ] **Step 5: Run focused interaction and route regressions**

Run: `npx vitest run tests/retro-game-case-integration.test.tsx tests/retro-game-case-visual.test.tsx tests/retro-case-motion.test.ts tests/retro-models.test.ts tests/retro-play-scene-cleanup.test.tsx tests/retro-gaming-page.test.tsx tests/retro-add-game-modal.test.tsx`

Expected: PASS; searching/adding a game, selecting it, opening details, returning, and unmounting the room do not throw.

- [ ] **Step 6: Commit only shelf integration and heuristic removal**

```bash
git add src/features/retro/RetroGameCase.tsx src/features/retro/retroModels.ts src/features/retro/RetroPs1GameCaseModel.tsx src/features/retro/RetroPs2GameCaseModel.tsx tests/retro-models.test.ts tests/retro-game-case-integration.test.tsx
git commit --only -m "refactor(retro): use processed models on shelf" -- src/features/retro/RetroGameCase.tsx src/features/retro/retroModels.ts src/features/retro/RetroPs1GameCaseModel.tsx src/features/retro/RetroPs2GameCaseModel.tsx tests/retro-models.test.ts tests/retro-game-case-integration.test.tsx
```

### Task 7: Enforce packaged assets and complete verification

**Files:**
- Modify: `scripts/verify-retro-assets.cjs:1-46`
- Create: `tests/retro-case-asset-contract.test.ts`
- Modify only if required by verification: `package.json:28-32`

**Interfaces:**
- `npm run verify:retro-assets` verifies both existing console-room models and the four processed case models.
- `npm run check:retro-cases` remains the authoritative source/output hash check.

- [ ] **Step 1: Write the failing packaged-asset contract test**

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("processed retro case asset contract", () => {
  it("imports only processed runtime models and ships their attribution", () => {
    const registry = readFileSync("src/features/retro/retroCaseModelRegistry.ts", "utf8");
    const notice = readFileSync("assets/THIRD_PARTY_3D_ASSETS.md", "utf8");
    const gameCase = readFileSync("src/features/retro/RetroGameCase.tsx", "utf8");
    const verifier = readFileSync("scripts/verify-retro-assets.cjs", "utf8");

    for (const filename of [
      "ps2-dvd-case.processed.glb",
      "ps1-jewel-case.processed.glb",
      "snes-cartridge.processed.glb",
      "nes-cartridge.processed.glb",
    ]) {
      expect(registry).toContain(filename);
    }
    expect(gameCase).not.toContain("dvdgame_case(1).glb");
    expect(gameCase).not.toContain("ps1_case_-_deathtrap_dungeon_1998.glb");
    expect(notice).toContain("Raphael Frei");
    expect(notice).toContain("Macky");
    expect(notice).toContain("SomeKevin");
    expect(notice).toContain("ConnorMartin");
    expect(verifier).toContain("retro-case-models.manifest.json");
    expect(verifier).toContain("outputSha256");
  });
});
```

- [ ] **Step 2: Run the asset contract before extending the verifier**

Run: `npx vitest run tests/retro-case-asset-contract.test.ts`

Expected: FAIL because `scripts/verify-retro-assets.cjs` does not yet read `retro-case-models.manifest.json` or validate `outputSha256`.

- [ ] **Step 3: Extend the packaged asset verifier**

Read `src/assets/3D_OBJS/cases/retro-case-models.manifest.json`. For every `models` entry:

- Confirm the processed output exists under `src/assets/3D_OBJS/cases/`.
- Recalculate and compare `outputSha256`.
- Confirm every manifest role matches the platform's required role list.
- Confirm the source URL, author, license ID, source filename, and output filename occur in `assets/THIRD_PARTY_3D_ASSETS.md`.
- Reject `NC`, `ND`, `unknown`, or ambiguous license text.

Keep the existing nine console-room checks unchanged. On success print `Assets retro verified: 9 console models and 4 case models.`

- [ ] **Step 4: Run deterministic asset checks**

Run: `npm run check:retro-cases`

Expected: PASS with four matching source/output pairs.

Run: `npm run verify:retro-assets`

Expected: PASS for the existing console-room assets and the four case models. If an existing unrelated console-room asset is absent, record that pre-existing blocker separately and still confirm the four new case checks pass through the focused Vitest contract.

- [ ] **Step 5: Run automated regression gates**

Run: `npm run test:typecheck`

Expected: PASS.

Run: `npm run lint`

Expected: PASS with no new warnings in the touched files.

Run: `npm test`

Expected: PASS, including the pipeline, registry, texture isolation, Strict Mode cleanup, search/add, selection, details, and existing gamepad tests.

Run: `npm run build`

Expected: PASS; Vite emits hashed copies of all four processed GLBs referenced by the registry.

- [ ] **Step 6: Perform the four-console visual smoke**

Run the Electron development launcher and inspect PS2, PS1, SNES, and NES at the existing shelf camera:

- The selected case rotates continuously with the existing tilt and damping.
- PS2 has no visible disc or CD.
- PS1 shows only the closed case.
- SNES and NES artwork stays inside the calibrated front label.
- A PS2 wrap changes front, spine, and back.
- A PS1 cover changes only the front and preserves embedded spine/back.
- Two games from the same console retain different covers while both are visible.
- Switch still renders the procedural case.
- Repeated search, selection, details open/close, and return produce no route error or console `dispose` exception.

- [ ] **Step 7: Commit only verification changes**

```bash
git add scripts/verify-retro-assets.cjs tests/retro-case-asset-contract.test.ts package.json
git commit --only -m "test(retro): verify processed case assets" -- scripts/verify-retro-assets.cjs tests/retro-case-asset-contract.test.ts package.json
```

## Completion Evidence

Before reporting completion, capture:

- Commit IDs for Tasks 1-7.
- `npm run check:retro-cases` output.
- Focused Vitest output for pipeline, registry, ownership, visual fallback, shelf integration, add/search, details, and cleanup tests.
- `npm run test:typecheck`, `npm run lint`, full `npm test`, and `npm run build` outputs.
- Manual visual-smoke notes for PS2, PS1, SNES, NES, and procedural Switch fallback.
- `git status --short` proving unrelated user changes remain present and were not committed by these task commits.

## Reference

- glTF Transform scripting API: https://gltf-transform.dev/

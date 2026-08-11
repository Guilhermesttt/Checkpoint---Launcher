# Real Retro Case Models Design

**Date:** 2026-08-10
**Status:** Approved in conversation; pending written-spec review

## Objective

Replace the shelf's procedural PS1, PS2, SNES, and NES cases with real console-specific GLB models while preserving the existing selection rotation and interaction boundary. Each game must apply its artwork only to the intended cover or cartridge-label surface. Disc, CD, open-case, and alternate-scene meshes are excluded.

This design supersedes the shelf-case adaptation in `2026-08-10-retro-jvc-glb-presentation-design.md`. In this scope, cases remain closed and physical media is not rendered. It does not replace the separately approved retro game-details experience.

## Scope

### Included

- Inspect and normalize the four supplied GLBs through a deterministic offline preparation script.
- Keep all source GLBs unchanged.
- Generate runtime-ready GLBs under `src/assets/3D_OBJS/cases/`.
- Remove disc, CD, open-case, and unused scene variants from generated models.
- Split artwork surfaces into stable, named meshes.
- Select the generated model by normalized console aliases.
- Apply `wrapImage` before `coverImage` and preserve embedded art when neither is usable.
- Clone mutable materials and textures per game instance.
- Keep `RetroProceduralCase3D` as the fallback for unsupported consoles and failed GLB loads.
- Preserve the existing shelf selection, rotation, reduced-motion, keyboard, gamepad, and sound behavior.
- Prevent nullable or shared WebGL resources from being disposed by an individual game case.

### Not included

- Changing `GameDetailPanel.tsx` or the approved retro details layout.
- Changing RetroAchievements integration, credentials, or backend routes.
- Adding models for Switch, PSP, N64, Genesis, GBA, or other consoles in this iteration.
- Downloading or transforming models at runtime.
- Editing source GLBs in place.
- Showing discs, CDs, opened cases, or alternate case variants.
- Removing the procedural fallback.

## Source Model Inspection

### PS2

Source: `src/assets/3D_OBJS/dvdgame_case(1).glb`

The source contains separate case and media meshes. The preparation adapter retains the case body, transparent plastic, and artwork surfaces. It removes these media-related meshes:

- `Cylinder_CD Colored_0`
- `Cylinder_CD Black_0`
- `Cylinder_CD Art_0`
- `Circle_Fingerprint_0`

The source artwork mesh is `Case_Art.001_0` with material `Art.001`. Its triangles are partitioned into front, spine, and back artwork surfaces. Case plastic and transparent case layers remain unchanged. Fingerprint geometry is retained only when it belongs to the case shell; fingerprint geometry attached to the physical disc is removed.

### PS1

Source: `src/assets/3D_OBJS/ps1_case_-_deathtrap_dungeon_1998.glb`

The file contains open and closed variants. Only the closed right-side hierarchy is retained:

```text
front.001_1/Object_7
```

The left/open variant and all of its descendants are excluded. The closed model is partitioned into case body plus front, spine, and back artwork surfaces without changing its visible closed-case proportions.

### SNES

Source: `src/assets/3D_OBJS/super_nintendo_cartridge.glb`

The source combines body and label in one mesh and material. A model-specific offline adapter separates the visible front label surface from the plastic cartridge body. The generated model exposes `cartridge_label` and `cartridge_body` as independent meshes.

### NES

Source: `src/assets/3D_OBJS/nes_cartridge__super_mario_bros.glb`

The source combines body and label in one mesh and material. A model-specific offline adapter separates the visible front label surface from the cartridge body. The generated model exposes `cartridge_label` and `cartridge_body` as independent meshes.

## Offline Preparation Pipeline

Create `scripts/prepare-retro-case-models.mjs`. It uses explicit per-model adapters rather than a generic runtime mesh-name heuristic. Each adapter validates the known source structure before producing output.

Generated files:

```text
src/assets/3D_OBJS/cases/
├── ps2-dvd-case.processed.glb
├── ps1-jewel-case.processed.glb
├── snes-cartridge.processed.glb
└── nes-cartridge.processed.glb
```

Stable generated mesh roles:

- `case_body`
- `case_transparent`
- `artwork_front`
- `artwork_spine`
- `artwork_back`
- `cartridge_body`
- `cartridge_label`

The adapters classify triangles using model-specific local-space orientation, connected surfaces, and bounded surface regions. The selection constants belong to the adapter for that exact source asset. They are protected by source signatures and output assertions, so a changed GLB cannot silently produce a plausible but incorrect result.

Every artwork role contains two explicit UV channels. `TEXCOORD_0` is normalized to the complete role surface for a standalone front cover or cartridge label. `TEXCOORD_1` preserves the source atlas coordinates used by a complete case wrap. The generated manifest records the finite bounds of both channels for every artwork role. Body meshes retain their original UV channels.

The script performs these operations in order:

1. Read the source GLB and verify its expected node, mesh, material, index, vertex, and UV signatures.
2. Retain only the approved hierarchy for that platform.
3. Remove explicitly excluded media and alternate-variant meshes.
4. Partition artwork or label triangles into the required stable roles.
5. Preserve normals, tangents, indices, embedded textures, and PBR material channels, then emit the normalized and atlas UV channels required by artwork geometry.
6. Validate non-empty geometry, finite bounds, finite UVs, and the exact required role set.
7. Write to a temporary output.
8. Atomically replace the processed GLB only after all validation succeeds.

A generated manifest records each source path and SHA-256 signature, output path and signature, adapter version, and emitted mesh roles. `npm run prepare:retro-cases` regenerates the outputs. `npm run check:retro-cases` verifies that committed outputs and the manifest match their sources without rewriting files.

The runtime imports only processed files. Original models remain inspection and regeneration inputs.

## Runtime Architecture

### Declarative registry

Create a focused case-model registry containing one entry per migrated platform. Each entry owns:

- Canonical platform key and accepted aliases.
- Processed GLB URL.
- Physical kind: `case` or `cartridge`.
- Position, rotation, scale, and target-height calibration.
- Artwork roles supported by the processed model.
- Optional per-platform material adjustments.

Alias normalization is deterministic and case-insensitive. PS1, PlayStation, PS2, PlayStation 2, SNES, Super Nintendo, NES, and Nintendo Entertainment System resolve to their canonical entries. An unknown platform does not guess a model.

### Shared renderer

`RetroPhysicalGameCase` is the only runtime renderer for the four processed model families. It receives the game artwork URLs, normalized platform, selection state, and presentation props. It does not own shelf navigation.

`RetroGameCase` remains the interaction and animation shell. It keeps selection, confirmation, rotation, reduced-motion, pointer, keyboard, and gamepad behavior. Its visual child chooses `RetroPhysicalGameCase` when the registry resolves a processed model and `RetroProceduralCase3D` otherwise.

Existing per-console experimental renderers that inspect source node names at runtime are replaced by the shared renderer after equivalent behavior is covered by tests. Runtime selection never depends on source mesh-name guessing.

## Artwork Data Flow

Artwork priority is strict:

1. For PS1/PS2, a usable `wrapImage` is applied to `artwork_front`, `artwork_spine`, and `artwork_back` through the preserved atlas UV channel. For SNES/NES, it targets only `cartridge_label`.
2. Without a usable wrap, `coverImage` is applied only to `artwork_front` for PS1/PS2 or `cartridge_label` for SNES/NES through the normalized UV channel.
3. Surfaces not replaced retain their embedded model material and texture.
4. If neither image is usable, all embedded artwork remains visible.

Texture loading preserves the current Three.js conventions:

- `flipY = false`
- `colorSpace = SRGBColorSpace`
- Clamp wrapping unless a platform adapter explicitly requires another mode.
- `channel = 0` for normalized cover/label UVs and `channel = 1` for full case-wrap UVs.
- Per-instance UV transform only on an instance-owned texture clone.

A failed image load does not remove the case. The renderer keeps the embedded artwork and exposes no unhandled promise rejection.

## Instance Isolation and Resource Lifecycle

The parsed `useGLTF` scene is immutable shared cache state. For every visible game instance:

- Clone the scene hierarchy.
- Share geometry only while it remains immutable.
- Clone every material that the instance may alter.
- Clone a loaded artwork texture when the instance changes its transform or assigns it to an instance-owned material.
- Never assign game artwork to a source GLTF material.

The rendered cloned scene disables automatic disposal of shared loader resources. Cleanup disposes only resources created or cloned by that instance. It never disposes source geometry, source GLTF materials, or loader-cache textures.

Cleanup is idempotent and null-safe. It checks ownership and resource existence before calling `dispose()`, removes stale async callbacks, and clears instance references after disposal. React Strict Mode mount/unmount cycles and rapid game changes must not produce `Cannot read properties of null (reading 'dispose')` or change another case's artwork.

## Loading and Failure Behavior

- Unsupported platform: render `RetroProceduralCase3D`.
- Processed GLB load failure: render the procedural case and keep shelf interaction available.
- Artwork load failure: keep the processed model with its embedded artwork.
- Missing required generated mesh role: treat the processed asset as incompatible and use the procedural fallback.
- Stale async texture completion: ignore it when the owning game instance has changed or unmounted.
- WebGL context loss: retain the launcher's existing visible recovery behavior.

No asset or texture failure may replace the entire route with React Router's default error page.

## Testing and Verification

### Preparation pipeline

- Known source signatures select the correct model-specific adapter.
- PS2 output contains no CD, disc-art, or disc-fingerprint mesh.
- PS1 output contains only the closed right-side case.
- SNES and NES outputs expose independent, non-empty body and label meshes.
- PS1 and PS2 outputs expose non-empty front, spine, and back artwork meshes.
- Every required output has finite geometry bounds, finite UVs, normals, and valid material references.
- A changed source signature fails without overwriting the last valid output.
- `check:retro-cases` detects missing, stale, or manually changed generated files.

### Runtime unit and component tests

- Console aliases resolve to the correct processed model.
- Unsupported consoles use `RetroProceduralCase3D`.
- `wrapImage` takes priority over `coverImage`.
- `coverImage` changes only the front or cartridge label.
- Missing and failed artwork preserve embedded materials.
- Two games using the same console have distinct mutable materials and artwork textures.
- Changing or unmounting one game does not alter or dispose another game's resources.
- Repeated Strict Mode mount/unmount and selection changes produce no null-disposal error.
- Searching, selecting, opening details, returning, and selecting another game do not crash the route.
- Existing selection rotation, confirmation, reduced-motion, keyboard, gamepad, and sound tests continue to pass.

### Visual and release checks

- Inspect front, side, back, scale, grounding, and selected rotation for PS2, PS1, SNES, and NES.
- Confirm that only the selected game's artwork changes.
- Confirm that no disc, CD, or open PS1 case is visible.
- Confirm cover-only behavior and wrap behavior separately.
- Run TypeScript, ESLint, relevant Vitest tests, the complete test suite, and the production build.
- Verify the packaged Electron application contains processed GLBs and required third-party attribution records.

## Asset Licensing

Each source model must have its source URL, author, license, required attribution, and local filename recorded in `assets/THIRD_PARTY_3D_ASSETS.md` before public distribution. Assets with unclear redistribution rights may be used for local development only and block a public release until replaced or licensed. Model metadata alone is not accepted as proof of redistribution rights.

## Acceptance Criteria

- PS2, PS1, SNES, and NES shelf games render their approved real GLB model.
- PS2 contains no CD or disc-related geometry.
- PS1 displays only the closed right-side case.
- SNES and NES apply artwork only to their front label.
- `wrapImage` replaces front, spine, and back; `coverImage` replaces only the front or label.
- Multiple games using the same GLB never share mutable material or texture state.
- Search, selection, details navigation, rapid switching, and Strict Mode cleanup produce no null `dispose` crash.
- Unknown or failed models use the procedural fallback without breaking navigation or Play access.
- Original GLBs remain unchanged and processed outputs can be reproduced and checked deterministically.
- Existing retro interaction, accessibility, gamepad, sound, reduced-motion, tests, and build behavior remain operational.

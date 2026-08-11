# Platform-Aware Retro Details Design

## Goal

Turn the retro game details screen into a simple PlayStation 2-inspired vertical interface while keeping the selected game and platform hardware visible beside a shared Sony PVM television. Reduce the CRT viewport curvature so the rendered content follows the physical screen opening more closely.

## Scope and constraints

- Preserve the current color values, opacity hierarchy, fonts, launch behavior, RetroAchievements integration, focus restoration, sounds, keyboard controls, gamepad controls, and reduced-motion behavior.
- Preserve the transparent-screen bounds already measured from `sony-crt.png`.
- Do not mutate or dispose shared `useGLTF` scenes, geometries, materials, or cached source textures.
- Clone instance-owned materials before adapting them and dispose only instance-owned resources.
- Unsupported consoles must keep a safe game-case fallback without showing incorrect hardware.
- Keep the existing selected game case or cartridge visible in detail mode.

## CRT curvature

Define one shared curve value for `.retro-tv-viewport`:

```css
--retro-tv-curve: clamp(8px, 1.1vw, 20px);
```

Use the same value in `border-radius` and `clip-path`. The insets remain `top: 4.5%`, `bottom: 4.5%`, `left: 12.7083%`, and `right: 12.6042%`.

## Details interface

The left side becomes one restrained text column inspired by the supplied PlayStation 2 menu reference.

- Width: `clamp(280px, 34vw, 460px)` inside the CRT viewport.
- Outer inset: the existing 32px scale on large layouts, reduced responsively at 1280x720.
- Navigation: a vertical list containing only `JOGAR`, `SOBRE`, and `CONQUISTAS`.
- Active item: current foreground color and existing red accent; inactive items retain the existing muted text color.
- Content: the selected section appears immediately below the list in the same single `overflow-y: auto` column.
- Typography: keep STIX Two Text for the retro interface and the existing uppercase tracking hierarchy. Do not introduce a new font or palette.
- The footer retains the launch or configure action without creating a second competing navigation system.

Arrow keys and D-pad Up/Down move through the vertical items. Enter/gamepad X activates the focused item or the current action. L1/R1 remain supported for cycling sections. Escape, Backspace, and gamepad O close the screen and restore shelf focus.

## Shared 3D stage

The right side remains visually open so the existing Canvas can present a fixed three-part composition:

1. Sony PVM television;
2. hardware resolved from the selected game's console;
3. selected game case or cartridge.

The stage occupies the right side of the CRT viewport and keeps stable anchors across platforms. Each model is normalized to a declared target size rather than relying on authored units. Reduced motion removes entry drift and floating motion without hiding any model.

### Television reuse

`sony_pvm-1341__sony_playstation.glb` contains both television and PlayStation objects. The television adapter keeps only the PVM node families (`main_body`, `back_pannel`, `front_panel`, `glass_and_fence`, and `pvm_plugs`) and clones their materials.

An instance-owned emissive screen surface displays `coverImage`, falling back to `wrapImage` and then a neutral dark screen. The surface uses high emissive intensity so the existing `RetroCrtPass` bloom reacts to it. A warm screen-colored light illuminates the console and game model from the TV direction. This combines visible bloom with real scene lighting without adding a postprocessing dependency.

## Platform registry

A typed registry resolves aliases to these exact models:

| Platform | Hardware source | Adaptation |
| --- | --- | --- |
| PS1 | `sony_pvm-1341__sony_playstation.glb` | Keep PlayStation body, details, plugs, cables, and controller nodes; television nodes are rendered by the shared TV adapter. |
| PS2 | `sony_playstation_2.glb` | Reuse the existing PS2 mesh filter and material adaptation. |
| SNES | `super_yes.glb` | Normalize the single authored hardware mesh to the SNES stage anchor. |
| NES | `nes_console_and_controller.glb` | Keep both `Console` and `Controller` groups. |

Aliases include `PLAYSTATION`, `PLAYSTATION 1`, `PSX`, `PLAYSTATION 2`, `SUPER NINTENDO`, `SUPER NES`, and `NINTENDO ENTERTAINMENT SYSTEM`. Unknown platforms return no hardware model.

## Component boundaries

- `retroPlatformRegistry.ts`: pure alias resolution, model URLs, target sizes, and transforms.
- `retroPlatformModel.ts`: pure node-role classification for PVM/PS1, PS2, NES, and SNES adapters.
- `RetroPvmTelevision.tsx`: shared TV clone, artwork screen, emissive material, and owned-resource cleanup.
- `RetroPlatformHardware.tsx`: registry-driven hardware loader with per-platform node filtering, normalization, fallback, and cleanup.
- `RetroPlatformDisplay.tsx`: composes TV, hardware, light, and fixed anchors inside the existing Canvas.
- `RetroGameDetailsScreen.tsx` and `RetroDetailTabs.tsx`: vertical text navigation and scrollable content only.
- `RetroGamingPage.tsx`: passes the active game to the platform display and keeps the existing case/cartridge scene.

## Loading and failure behavior

- Load TV and platform GLBs under independent Suspense boundaries so one failure does not blank the details screen.
- A model error boundary hides only failed hardware; the text interface and selected game remain usable.
- Missing artwork produces a dark powered screen, not a broken texture.
- Async texture/model cleanup is idempotent and guarded against unmount.

## Verification

- Registry tests cover every platform and alias plus the unsupported fallback.
- Model-role tests prove TV and PS1 nodes are separated and NES retains console/controller groups.
- Details tests cover vertical navigation, scrolling, launch/configure, keyboard, gamepad, close, and focus restoration.
- Page tests prove the active game drives the platform display while the existing case remains rendered.
- CRT tests lock the shared smaller curvature and unchanged screen insets.
- Run focused tests, the full Vitest suite, `npm run test:typecheck`, lint, and production build.
- Visually check 1600x900 and 1280x720 when a browser/Electron surface is available, including reduced motion and all four supported platforms.

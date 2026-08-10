# Checkpoint Retro Gaming Cinematic Interface

## Objective

Redesign `RetroGamingPage.tsx` as a fullscreen cinematic retro-library experience. The page should evoke playing PlayStation 2 on a well-adjusted consumer CRT television while using the visual hierarchy of the supplied Akira Kurosawa collection reference: minimal framing, a horizontal physical collection, one featured case, and restrained metadata.

This phase covers the interface and its local interactions only. Achievement API integration, game installation, emulation, launching, and detailed game pages are outside the scope of this design.

## Approved Direction

The entire visible composition will be rendered inside one React Three Fiber canvas. The collection, typography, filters, controls, and decorative interface will therefore pass through the same final CRT post-processing pipeline. An invisible semantic DOM layer will mirror interactive controls for accessibility, keyboard focus, and existing gamepad navigation.

This approach is intentionally favored over HTML overlays. It provides coherent curvature, bloom, chromatic separation, scanlines, noise, and transition artifacts across every visible element.

## Reference Analysis

The current Shader Development Studio site at `https://www.shader.se/` uses a fullscreen WebGL canvas and a restrained editorial interface. Its published client configuration combines animated noise, sepia, bloom, contrast, brightness, saturation, motion blur, lens distortion, chromatic aberration, and vignette. Its typography pairs STIX Two Text with very small utility text.

The implementation will use those principles rather than copy the site or its source. The supplied hierarchy image remains the layout reference; shader.se remains the motion, rendering, and image-treatment reference.

## Experience Principles

1. The selected game cover is always the focal point.
2. The interface should feel like a physical collection, not a modern card carousel.
3. A stationary screen resembles a good consumer CRT; aggressive analog faults happen only during selection transitions.
4. Metadata remains sparse and cinematic. Achievements and descriptions do not appear on this screen.
5. Existing launcher colors and sound behavior remain intact.
6. Visual fidelity must not remove keyboard, gamepad, reduced-motion, or screen-reader support.

## Visual Hierarchy

### Header

- Left: compact return control.
- Center: `CHECKPOINT RETRÔ` collection identity.
- Right: collection period or archive label.
- Below the identity: small, monochromatic decade filters.

### Collection Stage

- A horizontal row of physical game cases fills the central width.
- Non-selected games primarily show their spines.
- The selected case advances toward the viewer, rotates slightly, and reveals its cover.
- Neighboring cases retain enough visibility to communicate browsing direction and collection scale.
- The camera remains orthographic to preserve the poster-like hierarchy and avoid perspective drift.

### Game Information

- Centered beneath the stage: serif title, edition/subtitle, year, and console.
- No description, achievement progress, or secondary information appears here.
- Previous and next controls sit near the lower left and right edges.
- The play action appears only while the active case is focused or confirmed so it does not compete with the cover.

### Footer

- Minimal copyright text on the left.
- Minimal archive/engine identification on the right.

## Visual System

### Color

The retro page keeps its existing palette:

- near-black charcoal background;
- aged warm white for primary text and highlights;
- existing retro red as the only strong accent;
- subdued gray for inactive text and physical case materials.

No global launcher palette values will be changed.

### Typography

- Display titles: STIX Two Text, matching the editorial serif character of the reference.
- Interface labels: compact monospaced lettering with restrained tracking.
- Text is rendered as signed-distance-field geometry within the WebGL scene.
- Required font assets are packaged locally; runtime network font loading is not allowed.

### Geometry and Lighting

- Cases have believable depth, dark plastic edges, slightly rough covers, and individually generated spines.
- Lighting remains soft and frontal, with restrained red fill and subtle contact shadows.
- Materials should feel printed and plastic rather than metallic or glossy.
- The currently selected case may reveal an internal edge, but the disc animation is omitted from the default idle presentation because it distracts from the collection hierarchy.

## CRT Rendering Pipeline

The existing SVG turbulence/displacement filter will be removed. It produces fluid warping rather than lens curvature.

The final WebGL frame will pass through an ordered fullscreen shader pipeline:

1. analytic barrel distortion in UV space;
2. overscan and rounded tube mask;
3. subtle RGB chromatic separation that increases near the edges;
4. fine horizontal 480i-inspired scanlines;
5. restrained RGB phosphor mask;
6. soft bloom on bright content;
7. low-intensity animated analog noise;
8. slight black-level lift, restrained saturation, and warm tone mapping;
9. edge vignette caused by the simulated glass;
10. extremely low stationary flicker.

The normal state resembles a well-adjusted PS2-era television. Selection changes briefly introduce a vertical sync tear, stronger RGB displacement, and a short brightness disturbance. These faults resolve immediately after the new case becomes active.

There is no visible CRT-off control. When reduced motion is enabled, continuous flicker is disabled and the selection fault becomes a short cross-distortion without rapid flashes or large vertical movement.

## Components and Responsibilities

### `RetroGamingPage`

Owns filtered collection state, selected index, selection commands, return/play actions, reduced-motion state, and sound-effect integration. It provides stable event handlers to the canvas scene and accessibility layer.

### `RetroScene`

Owns the orthographic camera, lights, collection stage, render quality, and final composer. It contains no collection filtering logic.

### `RetroShelf`

Calculates visible case positions relative to the selected index. It keeps navigation circular and limits expensive offscreen objects without altering collection order.

### `RetroGameCase`

Loads the cover when available, builds a procedural spine from game metadata, animates between shelf and featured transforms, and exposes a single selection event. Textures are loaded once, configured for sRGB, cached, and disposed safely.

### `RetroInterface`

Renders header labels, decade filters, game metadata, navigation controls, play action, and footer as WebGL text and geometry. Pointer targets remain larger than their visible marks.

### `CrtPostProcessing`

Owns post-processing uniforms, stationary CRT animation, transition-fault timing, reduced-motion calibration, and adaptive quality settings. It does not know which game is selected.

### `RetroAccessibilityLayer`

Provides visually hidden semantic buttons and live text for the selected game. It mirrors return, filters, previous, next, play, and direct game-selection actions. Focus changes invoke the same commands used by pointer and gamepad input.

## State and Interaction Flow

1. A pointer, keyboard, or gamepad command requests a new index.
2. `RetroGamingPage` ignores duplicate commands while a transition is at its swap point.
3. `CrtPostProcessing` begins the short synchronization fault.
4. At peak distortion, the selected index changes.
5. `RetroShelf` animates the old case back and the new case forward using damped physical interpolation without elastic overshoot.
6. The fault resolves, metadata settles, and focus remains on the active selection.
7. Existing navigation/select/back sound effects play once per accepted command.

Changing the decade filter resets selection to the first available game in that filter through the same transition flow. Empty filters render a cinematic empty-state message without a broken case or invalid navigation controls.

## Asset Strategy and Failure Handling

- The supplied God of War cover is the initial hero-quality asset.
- Games without final art use procedural spines made from title, publisher/logo text, console, and existing palette values.
- A failed cover load falls back to a procedural front cover with the same metadata.
- Temporary remote Unsplash imagery is removed from the cinematic presentation.
- Texture loading errors remain local to the affected case.
- WebGL context loss pauses animation and displays a simple recoverable DOM message; context restoration recreates the scene.
- Font files and required visual assets are included in the packaged Electron build.

## Performance

- Target 60 frames per second in the desktop Electron window.
- Device pixel ratio adapts within 1.0 to 1.5.
- Bloom and noise may render at reduced internal resolution.
- Only a bounded neighborhood around the selected case uses full cover textures and shadows.
- Shader uniforms update in place; React state does not update per frame.
- Texture instances are cached by asset URL and disposed when the collection is released.
- Development Strict Mode must not duplicate texture loads, sounds, or animation loops.

## Accessibility and Input

- Return, filters, navigation, selection, and play remain operable by keyboard and gamepad.
- The active game title is announced through a polite live region after the transition resolves.
- Hidden semantic controls follow the same logical order as the visible composition.
- Reduced motion preserves the CRT character while removing continuous flicker and aggressive sync faults.
- Pointer interactions have enlarged invisible hit areas.
- Existing sound-theme and volume preferences continue to apply.

## Validation

### Automated

- decade filtering and empty-filter behavior;
- circular previous/next navigation;
- selection reset after filter changes;
- rejection of duplicate input at the transition swap point;
- one sound event per accepted command;
- procedural texture fallback after asset failure;
- reduced-motion CRT configuration;
- accessible names, focus order, and selected-game live text;
- typecheck, focused tests, lint for changed files, and production build.

### Visual and Runtime

- Compare the hierarchy at common launcher window sizes against the supplied reference.
- Verify that the selected cover remains the dominant focal point.
- Inspect barrel curvature, overscan, scanline density, phosphor mask, bloom, and edge chromatic separation.
- Confirm text remains readable after the full CRT pipeline.
- Verify the transition fault does not flash excessively or leave the frame displaced.
- Test pointer, keyboard, gamepad, sounds, reduced motion, and Electron resize behavior.
- Run an Electron smoke test with `ELECTRON_RUN_AS_NODE` unset.

## Acceptance Criteria

- Every visible element is rendered within the WebGL composition and receives the same CRT treatment.
- The layout follows the approved header, filter, physical collection, featured cover, centered metadata, lateral navigation, and minimal footer hierarchy.
- The stationary image evokes a well-adjusted PS2-era consumer CRT rather than a damaged VHS signal.
- Strong analog faults occur only during game changes and are reduced when reduced motion is enabled.
- The selected physical case, not a button or metadata panel, is the dominant focal point.
- Missing art produces intentional procedural cases without broken remote images.
- The existing launcher palette, sounds, keyboard/gamepad navigation, and return behavior remain intact.
- The page remains fluid and readable in the packaged Electron application.

# Retro Gaming Legibility and Interactive Game Case Design

**Date:** 2026-08-10  
**Status:** Approved in conversation; pending written-spec review

## Objective

Improve the cinematic retro page without losing its tube-TV identity. The screen must be clearly readable at launcher viewing distance, the game collection must become the dominant visual element, and each selected game must feel like a physical object that can be inspected.

## Approved visual direction

The CRT treatment remains a full-frame WebGL post-process. Its character comes from curvature, scanlines, phosphor structure, restrained noise, chromatic separation, bloom, and transition instability. Legibility takes priority over making the frame uniformly dark.

The balanced calibration will:

- lift exposure and midtones by roughly 25%;
- reduce vignette strength from `0.42` to approximately `0.26`;
- soften scanlines and noise while retaining visible CRT texture;
- keep curvature and chromatic aberration recognizable;
- use warmer, brighter interface whites that survive post-processing;
- increase game-case screen presence by approximately 30%;
- increase primary title size by approximately 45%;
- increase filters, metadata, navigation, and footer text by 35–55% according to hierarchy.

Exact shader and layout numbers may be calibrated from Electron screenshots, but the hierarchy above is the acceptance baseline.

## Interaction model

The interaction has two deliberate stages.

### Stage 1: selection

When navigation changes the active game, its case moves out from the shelf, rotates smoothly from spine view to front-cover view, grows into the focal position, and settles without a hard stop. Neighboring cases slide into their new circular positions at the same tempo.

Selection animation uses a damped ease with no bounce. It should feel weighted and physical, with an approximate settle time of 650–850 ms. Fast repeated navigation must retarget the current animation instead of restarting from a frozen pose.

### Stage 2: inspection

Clicking or confirming the already selected game opens the case around a left-side hinge. The front cover rotates to approximately 105–115 degrees, revealing the inner tray and a textured disc. The disc rotates slowly while the case is open. Confirming again may trigger the existing play action; Back/Escape closes inspection before leaving the page.

Opening and closing use a smoother, slightly slower motion than selection, approximately 800–1000 ms. The disc should begin rotating only after it is visibly revealed, avoiding abrupt motion under the cover.

## Physical model

The initial implementation uses repo-native Three.js geometry rather than adding a downloaded model dependency. This keeps the asset pipeline small and gives precise control over the hinge.

The case is composed of:

- a rigid back shell and tray;
- an independently pivoted front shell;
- a thin translucent plastic sleeve;
- front, spine, and rear artwork surfaces;
- a central disc hub;
- a separate disc mesh with label texture.

The existing optimized God of War cover is the first front texture. The original full-wrap scan may be cropped into front, spine, and back runtime textures without modifying the source scan. The first disc can use a purpose-built local label texture; if no label asset is available, a generated typographic God of War label is used as a graceful fallback.

## State and component boundaries

- `RetroGamingPage` owns selected game and inspection-open state.
- `RetroShelf` computes circular placement and passes selection/inspection intent.
- `RetroGameCase` owns only imperative mesh animation and physical rendering.
- A case-model helper defines dimensions and deterministic animation targets.
- The CRT profile remains independent of collection interaction.
- Semantic DOM controls mirror selection, inspection, close, and play actions for accessibility.

Only one case can be open. Changing selection closes the previously inspected case. Empty filtered collections cannot enter inspection mode.

## Input behavior

- Left/Right or gamepad horizontal navigation changes selection.
- Enter, Space, gamepad confirm, or clicking the selected case opens inspection.
- Confirm while inspection is already open invokes Play.
- Escape, Backspace, gamepad cancel, or clicking outside first closes inspection.
- A second cancel after inspection is closed returns to the launcher.

Existing navigation sounds remain. Opening and closing may reuse existing launcher UI sounds; no new audio dependency is required.

## Reduced motion and failure behavior

With reduced motion enabled, cases use short fades and direct transforms, the opening duration is reduced, disc rotation stops, and CRT flicker remains disabled.

If artwork or disc textures fail, the physical case remains usable with the existing generated title treatment. If WebGL is lost, the existing fallback remains visible and semantic controls continue to expose the page actions.

## Testing and acceptance

Automated coverage will verify:

- deterministic selection and inspection state transitions;
- selection changes close an open case;
- confirm opens first and plays only on the next confirm;
- cancel closes inspection before returning;
- reduced-motion animation targets;
- existing filtering and wrapped navigation behavior.

Visual verification in Electron must confirm:

- no WebGL context loss;
- readable filters and metadata at 1440×900;
- the active case occupies roughly 35–42% of viewport height;
- neighbor cases remain visible without obscuring the focal case;
- the CRT remains visibly nostalgic without crushing cover detail or interface text;
- selection and opening animations remain smooth during repeated input.

## Out of scope

- achievement API integration;
- downloading third-party 3D model files;
- unique case geometry for every console;
- unique disc scans for every game;
- changing the launcher-wide palette or unrelated navigation flows.

# Retro JVC Full-Screen and GLB Game Case Design

**Date:** 2026-08-10  
**Status:** Approved in conversation; pending written-spec review

## Objective

Remove the empty black area exposed by CRT curvature, place the cinematic interface inside an extreme close-up of the supplied JVC television, and replace the provisional PS2 case geometry with the supplied high-detail DVD/game-case GLB while preserving the approved selection and inspection behavior.

## Approved direction

- Use `src/assets/3D_OBJS/old_jvc_tv(1).glb` as a cropped physical frame around the viewport.
- Use `src/assets/3D_OBJS/dvdgame_case(1).glb` as the official PS2 case model.
- Keep `inconversant_cd_case.glb` available as a future jewel-case variant, but do not use it for PS2 games.
- Keep the existing two-stage interaction: selection presents the front cover; confirmation opens the case and reveals the disc.
- Preserve the brighter, readable CRT calibration and enlarged interface hierarchy.

## Model inspection findings

The JVC GLB is approximately 4.25 MB and contains separate `tv_case` and `display` materials. Its two principal meshes allow the cabinet to be retained while the embedded display surface is hidden or replaced.

The DVD/game-case GLB is approximately 4.88 MB and contains distinct case, artwork, transparent plastic, fingerprint, colored-disc, black-disc, and disc-art materials. The disc is already isolated in separate meshes. The case itself is delivered closed and contains no animation, so opening must be created in the launcher.

The inconversant model is approximately 0.53 MB but represents a simpler CD jewel case and has no separate disc. It is not the correct physical language for the initial PS2 collection.

None of the supplied GLBs contains animation clips.

## Full-screen CRT treatment

The CRT shader must never sample outside valid source pixels. Curvature will use an overscanned source rectangle so warped corner UVs remain inside the render target. The post-process will clamp the final sampling coordinates and remove the current branch that paints out-of-range pixels black.

The result must cover every viewport pixel. Curvature, chromatic separation, scanlines, phosphor structure, noise, bloom, and vignette remain visible, but there is no external black void around the curved image.

The JVC cabinet becomes the physical edge treatment. It is positioned as an extreme close-up so the television extends beyond all four viewport edges. Only a restrained portion of its bezel, vents, and controls may remain visible. No browser/background area may be visible outside the television.

The supplied `display` mesh is hidden to avoid covering the live interface. The CRT-composited interface remains behind the cabinet and is aligned to the display opening. The cabinet participates in the scene lighting but is excluded from the CRT source pass when practical, preventing scanlines from being applied twice to the physical shell.

## Render architecture

Rendering remains inside one React Three Fiber `Canvas` but uses two scene layers:

1. The content layer contains the collection, case models, lighting, and WebGL interface.
2. `RetroCrtPass` renders the content layer into its source target and applies the overscanned CRT shader to the default framebuffer.
3. A JVC overlay layer renders after the CRT pass without clearing color. It clears only depth and draws the cropped cabinet over the processed content.

The overlay uses a dedicated Three.js scene and camera so the CRT pass does not recursively capture the TV shell. The overlay camera and TV transform are calibrated at 1440×900 and respond to viewport aspect ratio without revealing the outer background.

If the TV model fails to load, the CRT interface still covers the full viewport; only the physical bezel is omitted.

## PS2 GLB adaptation

The GLB is loaded once and cloned for each visible game. Embedded camera and light nodes are discarded. Materials are cloned per case to prevent one game texture from modifying every instance.

The runtime adapter identifies the supplied node/material names:

- `Case_Plastic_0`
- `Case_Art.001_0`
- `Plastic_Transparent_0`
- `Plastic - Transparent_Fingerprint_0`
- `Cylinder_CD Colored_0`
- `Cylinder_CD Black_0`
- `Cylinder_CD Art_0`
- `Circle_Fingerprint_0`

The embedded artwork map is replaced with the selected game's cover texture. The God of War optimized runtime cover is the first acceptance asset. The disc-art material receives the existing procedural disc label until a licensed scan is supplied.

## Opening the closed model

Because the case GLB has no articulated hierarchy, case-related geometry is split once at load time by local depth. Triangles on the front half become a front-shell group; triangles on the rear half become a rear-shell group. All available geometry attributes and material assignments must be preserved.

The front group is repivoted to the left edge and uses the approved damped hinge rotation. The rear group and isolated disc remain fixed. Transparent plastic and fingerprint layers are split with the same rule so surface detail follows the correct half.

If a mesh cannot be separated safely, that layer stays on the rear group rather than failing the page. If the full adaptation fails, the current procedural articulated case remains the runtime fallback.

Neighboring spine cases may use lower-detail clones with the disc and interior layers hidden. Only the active case enables the complete model and transparent detail, limiting GPU cost.

## State and interaction

The existing state model remains unchanged:

- navigation changes selection and closes inspection;
- first confirm opens the selected case;
- second confirm invokes Play;
- cancel closes inspection before returning;
- only the active selected case can be open.

The GLB adapter consumes `selected`, `inspected`, and `reducedMotion` values from the current `RetroGameCase` boundary. It does not own navigation state.

Selection and opening retain the current damped, no-bounce motion. Reduced motion shortens transforms and stops disc rotation.

## Texture handling

Cover textures use sRGB color space and are cloned only when their UV transformation differs. Materials used for the cabinet, plastic, and disc retain their original PBR maps and channels.

All cloned geometries, materials, and generated textures are disposed when their owning instance unmounts. Shared source GLB resources are not disposed by individual cases.

## Performance

- Preload both approved GLBs when entering the retro page.
- Reuse the parsed source GLTF through Drei's loader cache.
- Render full-detail transparent/fingerprint meshes only for the active case.
- Keep the existing capped device-pixel ratio.
- Avoid new post-processing libraries.
- Maintain stable repeated navigation without WebGL context loss.

## Accessibility and fallback

Semantic controls and live announcements remain unchanged. Model loading does not block the hidden accessible interface. A loading case may temporarily use the procedural fallback.

WebGL context loss retains the existing visible recovery message. Model or texture failure never removes navigation, filtering, case-open state, or Play access.

## Validation

Automated tests will cover:

- overscan UV calculations never leaving the valid sampling interval;
- the CRT profile no longer producing an external black mask;
- deterministic classification of front/rear geometry triangles;
- material/node-role mapping for the known DVD-case model structure;
- fallback behavior when required GLB nodes are absent;
- preservation of selection, inspection, cancel, and reduced-motion behavior.

Electron validation at 1440×900 must confirm:

- all viewport corners contain CRT-composited image or physical JVC bezel;
- no empty background appears outside the curved screen;
- the JVC cabinet is recognizable but does not dominate the interface;
- the God of War cover aligns correctly on the GLB artwork UVs;
- the case opens around the left hinge without tearing transparent layers;
- the supplied disc meshes remain centered and readable;
- repeated selection/open/close remains smooth;
- no `webglcontextlost` event occurs.

## Asset licensing

The GLBs report Sketchfab exporters in their metadata. Their distribution license and attribution requirements are not encoded in the model structure inspected here. Before a public launcher release, the project owner must confirm that both selected assets may be redistributed and add any required attribution. This does not block local interface prototyping.

## Out of scope

- A room environment around the television.
- Showing the complete television body.
- Using the jewel-case model for PS2 games.
- Creating unique console-specific GLBs beyond the initial PS2 case.
- Replacing the achievement or game-data layer.
- Modifying unrelated launcher pages or user-owned working-tree changes.

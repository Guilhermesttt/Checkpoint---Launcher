# Retro Game Details Experience Design

Date: 2026-08-10
Status: Approved in conversation; pending written-spec review

## Objective

Replace the temporary retro details modal with a full-screen retro game details experience. The new screen borrows the proven behaviors of `GameDetailPanel.tsx` without duplicating that 2,450-line component or changing the standard launcher mode. It combines a fixed cinematic 3D room, a platform-specific console, a fixed 3D game case, a dedicated play action, and personal RetroAchievements progress.

## Scope

### Included

- Delete `src/features/retro/RetroGameDetailPanel.tsx`.
- Remove the `DETALHES` button and its callback from the retro shelf interface.
- Open the new details screen by clicking the selected case again or pressing `Enter`/gamepad `X`.
- Keep only the `JOGAR`, `SOBRE`, and `CONQUISTAS` tabs.
- Launch the game only from the `JOGAR` action inside the details screen.
- Preserve launcher sounds, keyboard and gamepad navigation, reduced-motion support, focus handling, and the existing close-on-launch preference.
- Integrate personal RetroAchievements progress through authenticated backend routes.
- Support distinct 3D console hardware for PS2, PS1, SNES, NES, N64, Genesis, GBA, Switch, and PSP.

### Not included

- Changes to the standard `GameDetailPanel.tsx` layout or behavior.
- `MODS` or `GERENCIAR` tabs in retro mode.
- Exposing a RetroAchievements API key to the renderer, preload, Electron package, or public client configuration.
- Runtime download of arbitrary 3D models.
- Ripped or unlicensed models from commercial games.

## Chosen Architecture

Create an independent `RetroGameDetailsScreen.tsx` instead of copying the complete standard panel. Reuse only stable services, contracts, launch behavior, and interaction patterns. This keeps the standard panel regression surface unchanged and prevents two large implementations from drifting.

The feature is divided into focused units:

- `RetroGameDetailsScreen`: full-screen shell, selected tab, focus trap, close behavior, play action, keyboard/gamepad routing, loading and error states.
- `RetroDetailTabs`: semantic tab list and the `JOGAR`, `SOBRE`, and `CONQUISTAS` content regions.
- `RetroDetailScene`: fixed Canvas, camera, TV, foreground controller, game stack, platform console, room lighting, and safe resource lifecycle.
- `RetroDetailCase`: fixed 3D case in a slight perspective with a subtle entry animation and no user rotation.
- `RetroConsoleModelRegistry`: maps normalized platform keys to lazily loaded GLB components and calibrated transforms.
- `retroAchievements` client service: renderer-facing calls to launcher backend routes only; contains no external API credentials.
- Backend RetroAchievements service: authorization, validation, game search, account resolution, progress retrieval, response normalization, caching, and secret redaction.

## Entry and Navigation Flow

1. The user selects a case on the shelf.
2. A second click on that selected case, `Enter`, or gamepad `X` opens the details screen.
3. Opening the screen does not launch a game.
4. The initial tab is `JOGAR`.
5. The user can change tabs with pointer, keyboard, or gamepad.
6. The internal `JOGAR` button launches the configured executable through the existing launcher service and honors close-on-launch.
7. `Escape`, `Backspace`, gamepad `O`, or the close button returns to the shelf and restores focus to the selected case.

The current intermediate console-room transition is replaced by this screen. The 3D room is part of the details experience, not a separate launch step.

## Visual Composition

The Canvas fills the viewport. Its composition follows the approved reference:

- Low, slightly lateral camera.
- JVC television on the left.
- Platform console to the right of the television.
- Controller in the foreground.
- Stack of games above the television.
- Fixed object positions and lighting across games.
- The television image, 3D case, and platform console change with the selected game.

The dark content panel occupies approximately 44 percent of the viewport and has a maximum width of 690px. The fixed 3D case is positioned on the right and vertically centered. A wide `JOGAR` button with a circular play icon sits below it. The close action remains in the top-right corner and control hints remain at the bottom.

On smaller layouts, the content panel becomes vertically scrollable. The case remains visible above its play action without overlapping tab content.

### Tokens

- Spacing: 8, 12, 16, 24, 32, and 48px.
- Radius: 12px for controls and 24px for the outer panel and case container. Nested elements always use a smaller radius than their parent.
- Display font: Unbounded for tabs, titles, labels, and `JOGAR`.
- Body font: Inter for descriptions, metadata, dates, errors, and achievement descriptions.
- Type sizes: 12px metadata, 14-16px body copy, and 20-24px section titles.
- The existing retro palette remains authoritative. `game.accent` is limited to existing game-associated accents and does not replace global colors.

Reduced motion removes entry movement and camera effects while preserving readable state changes.

## Platform-Specific Console Registry

`RetroConsoleModelRegistry` normalizes `RetroGame.console` and resolves one of these required models:

- PS2
- PS1
- SNES
- NES
- N64
- Genesis / Mega Drive
- GBA
- Switch
- PSP

Each registry entry owns:

- Lazy model loader.
- Canonical platform aliases.
- Target height.
- Position, rotation, and scale calibration.
- Optional material adaptation.
- Loading and failure fallback.

Only the selected console model is loaded. A model-load failure renders a discreet placeholder and leaves the rest of the screen operational. This fallback is an error state, not a substitute for providing all nine required production assets.

New assets must permit redistribution in the launcher, preferably under CC0 or CC BY. Every model must have recorded source URL, author, license, required attribution, and local filename. Ripped or ambiguously licensed models are rejected. Attribution and license records ship with the application where required.

## RetroAchievements Data Model

Extend retro game data with a stable optional field:

```ts
retroAchievementsGameId?: number;
```

The user profile stores the linked RetroAchievements identity as a stable ULID after initial username validation. The mutable username may be retained for display but is not the durable identity key.

Built-in games ship with confirmed RetroAchievements game IDs. Add/edit game flow searches by title and console through the backend. The user must confirm a result before its ID is saved. Ambiguous results are never selected automatically.

The achievements tab displays:

- Achievement badge, title, description, and points.
- Locked and unlocked state.
- Earned date when available.
- Normal and hardcore progress.
- Completed count, total count, and percentage.
- Mastery/highest award information when returned by the API.

Official API references:

- https://api-docs.retroachievements.org/getting-started.html
- https://api-docs.retroachievements.org/v1/get-game-info-and-user-progress.html

## Backend and Secret Boundary

`RETROACHIEVEMENTS_API_KEY` is a backend-only environment variable. It must never be placed in Vite variables, renderer code, preload code, client-visible configuration, logs, error payloads, or packaged Electron assets.

The backend exposes authenticated launcher routes for these operations:

- Resolve and validate a RetroAchievements username, returning a stable ULID and safe profile fields.
- Search games by normalized title and console.
- Fetch normalized game details and personal progress by game ID and user ULID.

Routes validate inputs, enforce request limits, cache safe responses, redact upstream URLs containing credentials, and return stable internal error codes. The renderer never calls `retroachievements.org` directly.

## Loading, Empty, and Error States

- No linked account: explain the requirement and link to the launcher setting used to connect a RetroAchievements username.
- Game not linked: offer a search-and-confirm action; never guess an ID.
- Loading: preserve layout with skeletons and keep close/navigation available.
- No user progress: show the achievement catalog as locked with 0 percent; this is not an error.
- API unavailable: show cached data when available and a retry action.
- Invalid or renamed username: request account relinking without exposing backend details.
- Model failure: render a neutral hardware placeholder while retaining TV, case, tabs, and play action.
- Texture failure: render a neutral screen/case fallback and dispose resources safely.

## Accessibility and Interaction

- The HTML interface remains semantic even though the scene is rendered in Canvas.
- Tabs use tablist, tab, and tabpanel semantics.
- The modal traps focus while open and restores focus to the selected shelf case when closed.
- All actions have accessible names and visible focus states.
- Keyboard and gamepad can open, close, switch tabs, scroll, retry, link, and launch.
- The Canvas is decorative to screen readers; relevant game, console, achievement, loading, and error information exists in HTML.
- Sounds use existing semantic sound events.

## Performance and Resource Lifecycle

- Lazy-load the details screen and platform GLBs.
- Load only the currently selected console.
- Cache reusable source textures without disposing shared cache entries.
- Dispose cloned textures, geometries, and materials when their owning scene unmounts.
- Guard nullable resources during async load and cleanup.
- Preserve the existing WebGL-loss recovery behavior.
- Avoid remounting the full Canvas when switching tabs.

## Testing and Verification

### Unit and contract tests

- Platform aliases resolve to the correct console registry entry.
- All nine supported platforms have production registry entries and attribution records.
- Transform calibration produces finite grounded bounds.
- RetroAchievements response normalization covers locked, normal, hardcore, mastered, empty, and malformed data.
- Backend secret redaction prevents API credentials from reaching errors or logs.
- Cache behavior and retry policy are deterministic.

### Component tests

- Selected case second-click and `Enter`/`X` open the screen.
- The old `DETALHES` action is absent.
- Only the three approved tabs exist.
- The internal play action invokes the existing launcher contract.
- Closing restores focus and does not launch.
- Linked, unlinked, loading, cached, empty, and failed achievement states render correctly.
- Reduced motion and gamepad navigation remain functional.
- A null texture or failed GLB does not crash during cleanup.

### Integration and release gates

- Backend route tests use controlled RetroAchievements fixtures and never real secrets.
- Build, TypeScript, ESLint, and the full Vitest suite pass.
- Visual smoke at 1600x900 and 1280x720 verifies the approved camera and overlay composition.
- Electron smoke verifies open, tab navigation, close, gamepad, and play behavior.
- Packaged-artifact inspection confirms GLBs and required license notices are present while the API key is absent.

## Acceptance Criteria

- `RetroGameDetailPanel.tsx` and the `DETALHES` button no longer exist.
- Second-click, `Enter`, or gamepad `X` on the selected case opens the new details screen.
- Only the internal `JOGAR` action launches the game.
- Only `JOGAR`, `SOBRE`, and `CONQUISTAS` are exposed.
- The fixed scene matches the approved composition.
- Television image and case follow the selected game.
- Console hardware follows the selected platform for all nine supported platforms.
- All console assets have acceptable redistribution licenses and documented attribution.
- Personal normal and hardcore RetroAchievements progress works after account linking.
- No RetroAchievements API credential is client-visible or included in the Electron package.
- Standard `GameDetailPanel.tsx` behavior remains unchanged.
- Accessibility, gamepad, sound, reduced motion, tests, build, and Electron smoke gates pass.

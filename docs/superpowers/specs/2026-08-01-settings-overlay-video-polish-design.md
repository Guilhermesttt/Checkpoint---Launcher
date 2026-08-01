# Settings and Overlay Video Polish Design

Date: 2026-08-01
Status: Approved design

## Goal

Correct the connected-account and profile-privacy controls, remove the redundant account sign-out action, and add subtle video backgrounds to the native social and achievement toast overlays without reducing readability or interaction reliability.

## Scope

### Connected accounts

- Preserve the current colors, opacity, gradients, borders, and overall three-card layout.
- Give the Steam, Spotify, and Discord cards consistent height and internal alignment.
- Keep the account icon, service name, and connection state in a stable left content column.
- Place Steam sync and unlink actions in a compact right-side vertical action column so `Steam`, `Sync`, and the connection state never wrap into one another.
- Keep Discord's single action aligned with the same right-side action area.
- Do not change the underlying connect, disconnect, or Steam synchronization behavior.

### Profile privacy

- Keep two choices: public and private.
- Correct the displayed Portuguese text and prevent truncation or encoding artifacts in the labels.
- Public profiles expose their available profile details to authenticated users.
- Private profiles expose details only to the owner and accepted Checkpoint friends; search results retain only basic identity.
- Persist a change through the existing Supabase `profiles.profile_visibility` column.
- Make the persistence function return the stored database value, and use that confirmed value as the UI state.
- Do not immediately refresh the full profile after saving, because a failed or stale refresh can overwrite the newly confirmed selection.
- On failure, restore the prior selection and display an inline error.
- Show saving and saved feedback in the privacy section.

### Account exit action

- Remove the `Sair da Conta` button from the settings sidebar.
- Retain `Sair do Aplicativo` and its current confirmation behavior.
- Do not remove authentication support or sign-out functionality elsewhere in the launcher.

## Native Toast Overlay Videos

The runtime overlay is `electron/overlay.html`, loaded by the transparent Electron overlay window. The new backgrounds therefore belong to the native toast card creation path, not the separate full command panel.

### Social cards

- Use `src/assets/Kristina_Lane__pindown.io_1785615277.mp4`.
- Apply it to all temporary social toast cards: game start/`Divirta-se`, friend request, friend accepted, friend playing, friend message, and other social notifications emitted through the same social-card path.
- Do not apply it to the large command panel opened through the overlay shortcut.
- Rotate the rendered video 90 degrees and scale it enough to cover the card after rotation.

### Achievement cards

- Use `src/assets/Overlay_Background.mp4`.
- Apply it only to temporary achievement toast cards.
- Do not add the social video's 90-degree rotation.

### Shared video behavior

- Create the video element through one reusable native overlay helper.
- Set `autoplay`, `loop`, `muted`, and `playsInline`.
- Mark it decorative with an empty accessible label role and no pointer interaction.
- Place it as the lowest visual child inside the clipped overlay shell.
- Use low opacity and `object-fit: cover`.
- Keep the existing dark radial and linear gradients above the video.
- Keep icons, text, progress, shine, borders, and click handlers above both the video and gradients.
- A video load or autoplay failure must leave the existing gradient card fully usable.
- Pause and release the video naturally when its toast card is removed.

## Packaging

- Include both MP4 files explicitly in the Electron builder file list.
- Unpack the videos from ASAR when required for reliable Chromium media streaming.
- Resolve each video relative to `electron/overlay.html` so development and packaged paths use the same markup.
- Keep unrelated video assets and background components unchanged.

## Testing

- Add a failing settings test that reproduces the Steam hierarchy problem, verifies removal of `Sair da Conta`, and verifies that `Sair do Aplicativo` remains.
- Add a failing privacy test that requires the persisted database value to be returned and ensures a successful selection is not overwritten by a profile refresh.
- Add native overlay structure tests for the social and achievement video assignments, required muted/autoplay/loop attributes, rotation class, layering, and packaging entries.
- Run the targeted tests through red-green cycles.
- Finish with the full Vitest suite, test typecheck, targeted lint, Electron syntax checks, and production build.
- Inspect the settings page and both toast variants visually if a browser or Electron inspection surface is available; otherwise report that limitation explicitly.

## Non-goals

- No redesign of the large in-game command panel.
- No palette, theme, sound, duration, placement, or toast routing changes.
- No changes to Steam authentication or synchronization semantics.
- No removal of sign-out capability outside this specific settings sidebar action.
- No autoplay audio; every background video remains muted.

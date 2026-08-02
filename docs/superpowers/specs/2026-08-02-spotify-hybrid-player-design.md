# Spotify Hybrid Player Design

**Date:** 2026-08-02

## Goal

Redesign the Checkpoint Spotify page as a stable hybrid music dashboard and expand it with responsive playback controls, live search, the real Spotify queue, shuffle, next-track visibility, and playlist creation and editing in the connected Spotify account. Fix the game-card flicker regression as part of the same delivery because background library refreshes currently unmount the game row.

## Constraints

- Keep the Checkpoint dark flat-design language and existing typography.
- Use Spotify green only for active status, progress, confirmation, and primary actions.
- Keep Spotify Authorization Code with PKCE. Never embed a Client Secret in Electron or Vite output.
- Development Mode users still require manual authorization in Spotify Users Management; the Spotify platform has no public API for self-adding users to that allowlist.
- Playback inside the launcher and player-control endpoints require an eligible Spotify Premium account.
- Preserve the Web Playback SDK fallback that controls an active Spotify Connect device.
- Avoid page-wide loading states for local operations.

## Information Architecture

The page uses a desktop-first three-column shell plus a persistent bottom player.

### Left column

- Compact Spotify identity and connection status.
- Navigation for Home, Search, Queue, and Playlists.
- User playlist list with an explicit New playlist action.
- The column scrolls independently when the playlist list exceeds its available height.

### Center column

- A now-playing hero with a restrained cover carousel inspired by the supplied references.
- Current track title, artist, album artwork, playback state, and device status.
- Context-dependent content below the hero:
  - discovery and live-search results;
  - an opened playlist and its items;
  - playlist creation and editing.
- Search results expose Play now, Add to queue, and Add to playlist actions.

### Right column

- The next track receives the strongest hierarchy.
- Remaining queue items appear as a compact ordered list.
- Queue state refreshes without replacing the now-playing surface.
- Checkpoint Jam remains a secondary social action available from this column or the page header.

### Persistent bottom player

- Compact artwork, track, and artist identity.
- Shuffle, previous, play/pause, next, seek, volume, and active-device controls.
- Remains mounted while search, queue, and playlist views change.

## Interaction Design

- Motion lasts 140-220 ms for button feedback, list insertion, search results, queue expansion, and track changes.
- Animations use opacity, short translations, and scale only; no large blur or long decorative movement.
- Playback commands update the interface optimistically, then reconcile with the SDK or Web API response.
- A failed command rolls back the optimistic state and displays a concise notification.
- Controls prevent duplicate in-flight commands without appearing frozen.
- Seek updates continuously while dragging and commits once when released.
- Live search starts 350 ms after the latest input, requires no submit button, cancels stale requests, and ignores stale responses.

## Spotify Authorization and Scopes

Add these scopes to the existing playback scopes:

- `playlist-read-private`
- `playlist-read-collaborative`
- `playlist-modify-public`
- `playlist-modify-private`

Existing connections whose stored token scope does not cover the required playlist scopes are marked for reauthorization. The UI explains why reconnection is required before opening the OAuth window.

PKCE continues to exchange authorization codes and refresh access tokens with `client_id` and `code_verifier`; no Client Secret is introduced.

## Playback State and Latency

The player hook remains the single owner of playback state but separates:

- authoritative SDK or Web API snapshots;
- optimistic command state;
- queue state;
- command-specific pending and error state.

The internal Web Playback SDK remains event-driven. Remote fallback no longer waits for the existing five-second polling cycle after a user command: it applies the expected state immediately and requests a fresh playback snapshot after the command. A lower-frequency passive reconciliation remains active to detect changes made in another Spotify client.

Play/pause, next, previous, seek, volume, and shuffle share one command pattern so latency handling and rollback remain consistent.

## Queue

- Load the real Spotify queue and map `currently_playing` plus queued items into Checkpoint track models.
- Add-to-queue targets the selected Checkpoint device when available, otherwise the active Spotify device.
- Refresh the queue after add, next, previous, and play-now operations.
- Show the first queued item as Next up and the remainder as the ordered queue.
- The UI does not promise deterministic ordering when competing Spotify clients issue commands concurrently.

## Spotify Playlists

- Load playlists owned by or available to the current user.
- Create a playlist with name, description, and public/private visibility.
- Add search results or queued tracks to a selected playlist.
- Open a playlist to display its current Spotify items.
- Remove items and reorder owned/collaborative playlist items using the current `/playlists/{id}/items` endpoints.
- Refresh the affected playlist after mutations and preserve its returned snapshot ID for safe follow-up changes.
- Mutations are limited to playlists the API permits the authenticated user to edit.

## Search

- Search begins after a 350 ms debounce.
- Queries shorter than two trimmed characters clear results and do not call Spotify.
- Each request has a monotonically increasing request ID or abort signal; only the newest response may update results.
- Development Mode search limits are respected, with a maximum of ten results per page.

## Game-card Flicker Regression

`refreshLibrary` currently sets the page-wide `isLoading` state for every refresh. The Home render path replaces the entire game surface with `LoadingSkeleton`, so background achievement, presence, sync, or profile activity can repeatedly unmount and remount `GameRow` and its cards.

Split library state into:

- initial loading, used only before the first usable library snapshot;
- background refreshing, which keeps the existing game array and cards mounted.

Background refreshes replace the game data atomically after loading completes. The selected game is preserved by stable game ID where possible, and the skeleton appears only when no usable library snapshot exists.

## Component Boundaries

- `useSpotifyPlayer`: authentication status, SDK lifecycle, playback commands, optimistic state, and remote fallback.
- Spotify API service: typed search, queue, shuffle, playlist, and item operations.
- Spotify page shell: responsive three-column composition and active sub-view.
- Now-playing hero: artwork carousel and primary metadata.
- Playlist browser/editor: playlist list, creation, items, reorder, and removal.
- Queue panel: next-up and ordered queue.
- Persistent transport: playback, progress, volume, shuffle, and device state.
- Search surface: debounced query and result actions.

Each component receives typed state and callbacks and does not call Electron IPC or Spotify endpoints directly.

## Error Handling

- 401: mark the connection for reauthorization and explain the reconnect action.
- 403: distinguish missing Premium/account access from playlist permission failures where possible.
- 404/no device: instruct the user to open Spotify on a device and start playback once.
- 429: honor `Retry-After`, disable only the affected action, and keep existing content visible.
- Network or SDK errors: retain the last known playback and queue state and expose retry without clearing the page.
- Playlist creation is not shown as complete until Spotify returns the created playlist ID.

## Accessibility and Gamepad

- Preserve visible controller focus only while a gamepad is connected.
- Establish explicit directional navigation among the left navigation, center content, queue, and bottom player.
- Every icon-only control has an accessible label and visible focus state.
- Search results and queue items remain keyboard navigable.
- Reduced-motion and low-performance preferences disable cover motion and nonessential transitions.

## Testing and Acceptance

Automated coverage includes:

- live-search debounce, short-query behavior, cancellation, and stale-response rejection;
- optimistic playback commands, reconciliation, rollback, and duplicate-command protection;
- shuffle and queue mapping/addition/refresh;
- playlist creation for public and private visibility;
- playlist item add, removal, and reorder using current endpoints;
- required-scope detection and reauthorization;
- persistent transport while changing Spotify sub-views;
- remote fallback behavior;
- game cards remaining mounted during a background library refresh.

Completion requires the focused tests, full test suite, TypeScript/Vite production build, and lint with zero errors. Existing unrelated lint warnings may be reported separately.

## Out of Scope

- Automatically adding Spotify accounts to Development Mode Users Management.
- Storing or distributing a Spotify Client Secret.
- Bypassing Spotify Premium, quota, or platform restrictions.
- A shared synchronized-audio Jam protocol; the existing Checkpoint invitation flow remains a secondary share action.

# Checkpoint Launcher

Checkpoint Launcher is a web-based game launcher for organizing a personal PC game library with a console-inspired interface.

It brings Steam-synced games and manually added local games into one place, with rich game detail pages, cover art, backgrounds, screenshots, trailers, achievements, favorites, categories, and a cinematic boot experience.

The launcher includes Steam account linking, automatic Steam library sync, manual metadata editing, local executable selection for desktop-runtime use, configurable sound themes, background music, and language preferences.

The project is designed around a premium living-room launcher feel: large visual cards, animated transitions, game-focused backgrounds, sound feedback, and a dedicated settings area for personalization.

## Highlights

- Steam account connection and library sync.
- Manual game entries for non-Steam or local games.
- Game detail panel with media, metadata and launch actions.
- Favorites, categories and search.
- Animated startup intro.
- Background music with adjustable volume.
- PS2 and Nintendo GameCube inspired sound themes.
- Portuguese, English and Spanish language preferences.
- Firebase-backed user accounts and library storage.

## Local Game Launching

Steam games can be opened from the browser with Steam protocol links.

Local `.exe` launching is prepared in the interface, but true local execution requires a desktop runtime such as Electron, because browsers do not expose full executable paths or allow launching arbitrary local programs directly.

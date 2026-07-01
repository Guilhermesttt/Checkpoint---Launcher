# Checkpoint Launcher

Checkpoint is a web launcher for organizing a PC game library with a console-style interface. It supports manual games, Steam account linking, Steam library sync, animated boot intro, sound themes, background music, and per-user preferences.

## Features

- Firebase Authentication and Firestore user library.
- Steam OpenID account linking.
- Steam library sync through a backend-held `STEAM_API_KEY`.
- Manual game creation and metadata editing.
- `.exe` picker for local game entries.
- Game detail view with screenshots, trailer, achievements and launch action.
- Background music with configurable volume.
- Sound themes: PS2 and Nintendo GameCube.
- Language preference: Portuguese, English and Spanish.

## Important Runtime Notes

The browser version can open Steam games through `steam://run/<appid>`.

Local `.exe` launching requires a desktop runtime, such as Electron, exposing:

```ts
window.electronAPI.launchExecutable(path)
```

Browsers do not expose the full local executable path for security reasons. The `.exe` picker in the add/edit modal prepares the local game entry, but true local launching needs a desktop wrapper.

## Tech Stack

- React
- TypeScript
- Vite
- Firebase Auth
- Firestore
- Express backend
- Steam Web API
- Framer Motion
- Tailwind CSS

## Environment

Copy `.env.example` to `.env.local` for local development.

Frontend variables are public by design:

```env
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_BACKEND_URL=http://localhost:8787
```

Backend-only secrets must never be committed:

```env
STEAM_API_KEY=
FIREBASE_SERVICE_ACCOUNT_KEY=
```

In production, keep backend secrets in Render or whichever host runs `server/index.mjs`. If Netlify only hosts the frontend, it does not need backend secrets.

## Development

Install dependencies:

```bash
npm install
```

Run frontend only:

```bash
npm run dev
```

Run backend only:

```bash
npm run server
```

Run both:

```bash
npm run dev:full
```

Build:

```bash
npm run build
```

## Steam Sync Flow

1. User signs in.
2. User connects Steam through OpenID.
3. Backend validates the Firebase ID token.
4. Backend verifies that the requested Steam ID belongs to the authenticated user.
5. Backend uses `STEAM_API_KEY` from the server environment to query Steam.
6. Frontend writes normalized games to the user's Firestore library.

## Security

- `.env`, `.env.local` and other env files are ignored.
- `STEAM_API_KEY` is server-side only.
- `FIREBASE_SERVICE_ACCOUNT_KEY` is server-side only.
- Steam library and achievements endpoints require Firebase authentication.
- Firestore rules restrict user data to the authenticated owner.

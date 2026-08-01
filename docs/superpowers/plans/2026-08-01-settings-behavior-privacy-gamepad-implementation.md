# Settings Behavior, Privacy, and Gamepad Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a compact Settings experience with five app behaviors, persistent public/private profiles, and predictable gamepad focus without changing the approved palette.

**Architecture:** Device-scoped behavior preferences remain in `PreferencesContext` and cross the existing typed Electron preload/IPC boundary only when main-process behavior is required. Account privacy is stored in Supabase, enforced by server-side projection/access helpers, and surfaced through the authenticated profile. Settings uses explicit gamepad neighbor metadata first and a tested spatial-ranking fallback elsewhere.

**Tech Stack:** Electron 39, React 19, TypeScript 6, Tailwind CSS 4, Supabase Postgres/RLS, Express 5, Vitest 4, Testing Library.

## Global Constraints

- Treat the current working tree and approved screenshots as the visual baseline.
- Do not alter existing colors, gradients, opacity values, theme behavior, or sound assets.
- Preserve Steam sync, authentication, achievements, friends/chat, Discord Rich Presence, overlays, notifications, themes, sounds, and navigation outside the changed Settings paths.
- Preserve all unrelated local changes; stage and commit only the files named by the current task.
- Support the existing minimum window size of 1280 × 720 and manually verify at 1365 × 768.
- Spotify remains unavailable and must not gain a non-functional connect action.
- Profile visibility accepts only `public` or `private`; existing and new accounts default to `public`.
- Run targeted tests after every task, then typecheck, lint, full tests, and build before completion.

---

## Planned File Structure

- `src/context/PreferencesContext.tsx`: owns the three new device preferences and hydration state.
- `src/services/launcherNavigation.ts`: validates and persists the last restorable category/subtab.
- `electron/window-behavior.cjs`: pure close-action decision logic that is testable without Electron.
- `electron/main.cjs`: applies window preferences, tray behavior, confirmation requests, and forced exits.
- `electron/preload.cjs` and `src/types/electron.d.ts`: expose the typed window-behavior IPC contract.
- `src/pages/Home.tsx`: restores navigation and owns the reusable exit confirmation modal.
- `src/pages/SettingsPage.tsx`: renders the compact audio layout, behavior controls, privacy controls, and explicit gamepad metadata.
- `src/services/profilePrivacy.ts`: validates and persists profile visibility for the authenticated account.
- `src/types/domain.ts` and `src/auth/AuthProvider.tsx`: define and carry visibility through the profile model.
- `supabase/migrations/20260801090000_profile_visibility.sql`: adds the constrained visibility field.
- `server/index.mjs`: enforces privacy for search and detailed profile responses.
- `src/pages/FriendsPage.tsx` and `src/pages/Home.tsx`: use the existing authenticated profile service to open allowed public profiles from search while preserving friend-request behavior.
- `src/utils/spatialFocus.ts`: contains pure declared-neighbor and spatial-ranking functions.
- `src/hooks/useGamepadFocusNavigation.ts`: integrates explicit navigation and fallback ranking.
- `src/context/GamepadContext.tsx` and `src/index.css`: gate the controller focus ring by connection and last input.
- Targeted tests live under `tests/` beside the existing Vitest suites.

---

### Task 1: Persist Device Behavior Preferences

**Files:**
- Modify: `src/context/PreferencesContext.tsx:19-47, 769-996`
- Create: `tests/preferences-context.test.tsx`

**Interfaces:**
- Produces: `minimizeToTrayOnClose: boolean`, `setMinimizeToTrayOnClose(value: boolean): void`.
- Produces: `restoreLastScreen: boolean`, `setRestoreLastScreen(value: boolean): void`.
- Produces: `confirmBeforeExit: boolean`, `setConfirmBeforeExit(value: boolean): void`.
- Produces: `preferencesHydrated: boolean`.
- Defaults: `minimizeToTrayOnClose=true`, `restoreLastScreen=false`, `confirmBeforeExit=true`.

- [ ] **Step 1: Write failing hydration and persistence tests**

```tsx
const Probe = () => {
  const prefs = usePreferences();
  return <button onClick={() => prefs.setRestoreLastScreen(true)}>
    {`${prefs.minimizeToTrayOnClose}:${prefs.restoreLastScreen}:${prefs.confirmBeforeExit}:${prefs.preferencesHydrated}`}
  </button>;
};

it("hydrates behavior preferences for the authenticated device user", async () => {
  localStorage.setItem("checkpoint_minimize_to_tray_user-1", "false");
  localStorage.setItem("checkpoint_restore_last_screen_user-1", "true");
  localStorage.setItem("checkpoint_confirm_before_exit_user-1", "false");
  render(<PreferencesProvider><Probe /></PreferencesProvider>);
  expect(await screen.findByRole("button")).toHaveTextContent("false:true:false:true");
});

it("persists a changed behavior preference under the current uid", async () => {
  const user = userEvent.setup();
  render(<PreferencesProvider><Probe /></PreferencesProvider>);
  await user.click(await screen.findByRole("button"));
  expect(localStorage.getItem("checkpoint_restore_last_screen_user-1")).toBe("true");
});
```

- [ ] **Step 2: Run the tests and confirm the new fields do not exist**

Run: `npx vitest run tests/preferences-context.test.tsx`

Expected: FAIL because the context does not expose the three behavior preferences or `preferencesHydrated`.

- [ ] **Step 3: Add state, hydration, persistence, and context exports**

```ts
const [minimizeToTrayOnClose, setMinimizeToTrayOnClose] = useState(true);
const [restoreLastScreen, setRestoreLastScreen] = useState(false);
const [confirmBeforeExit, setConfirmBeforeExit] = useState(true);

const savedMinimizeToTray = localStorage.getItem(prefKey(user.uid, "minimize_to_tray"));
const savedRestoreLastScreen = localStorage.getItem(prefKey(user.uid, "restore_last_screen"));
const savedConfirmBeforeExit = localStorage.getItem(prefKey(user.uid, "confirm_before_exit"));

if (savedMinimizeToTray !== null) setMinimizeToTrayOnClose(savedMinimizeToTray === "true");
if (savedRestoreLastScreen !== null) setRestoreLastScreen(savedRestoreLastScreen === "true");
if (savedConfirmBeforeExit !== null) setConfirmBeforeExit(savedConfirmBeforeExit === "true");
```

Add all three values to the guarded persistence effect and expose `preferencesHydrated` as `hydratedPreferencesUid === user?.uid`. Wrap preference reads/writes in small `try/catch` helpers. On storage failure, keep the in-memory value and log only the preference key, never user/profile data.

- [ ] **Step 4: Run the targeted tests**

Run: `npx vitest run tests/preferences-context.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit the preference model**

```powershell
git add src/context/PreferencesContext.tsx tests/preferences-context.test.tsx
git commit -m "feat(settings): persist app behavior preferences"
```

---

### Task 2: Apply Window Close and Quit Behavior Through Electron IPC

**Files:**
- Create: `electron/window-behavior.cjs`
- Modify: `electron/main.cjs:179-184, 1053-1058, 2454-2483, 3541-3544, 3598-3617`
- Modify: `electron/preload.cjs:48-57`
- Modify: `src/types/electron.d.ts:411-414`
- Create: `tests/window-behavior.test.ts`

**Interfaces:**
- Produces: `resolveWindowCloseAction(options): "hide" | "confirm" | "quit"`.
- Produces main helper `requestAppQuit(): { confirmationRequired: boolean }`.
- Produces preload API `setWindowBehavior({ minimizeToTray: boolean; confirmBeforeExit: boolean }): Promise<WindowBehavior>`.
- Produces preload API `requestAppQuit(): Promise<{ confirmationRequired: boolean }>`.
- Produces preload API `confirmAppQuit(): Promise<void>`.
- Produces preload API `onExitConfirmationRequested(callback: () => void): () => void`.

- [ ] **Step 1: Write failing decision-table tests**

```ts
const { resolveWindowCloseAction } = require("../electron/window-behavior.cjs");

it.each([
  [{ isQuitting: true, minimizeToTray: true, confirmBeforeExit: true }, "quit"],
  [{ isQuitting: false, minimizeToTray: true, confirmBeforeExit: true }, "hide"],
  [{ isQuitting: false, minimizeToTray: false, confirmBeforeExit: true }, "confirm"],
  [{ isQuitting: false, minimizeToTray: false, confirmBeforeExit: false }, "quit"],
])("resolves close precedence", (input, expected) => {
  expect(resolveWindowCloseAction(input)).toBe(expected);
});
```

- [ ] **Step 2: Run the test and verify the module is missing**

Run: `npx vitest run tests/window-behavior.test.ts`

Expected: FAIL with module-not-found for `electron/window-behavior.cjs`.

- [ ] **Step 3: Implement the pure resolver**

```js
const resolveWindowCloseAction = ({ isQuitting, minimizeToTray, confirmBeforeExit }) => {
  if (isQuitting) return "quit";
  if (minimizeToTray) return "hide";
  if (confirmBeforeExit) return "confirm";
  return "quit";
};

module.exports = { resolveWindowCloseAction };
```

- [ ] **Step 4: Add secure IPC and integrate the existing close/tray flow**

Maintain a main-process `windowBehavior` object. On `mainWindow.close`, call the resolver. Hide for `hide`; prevent default, show/focus, and emit `system:exit-confirmation-requested` for `confirm`; otherwise set `isQuitting=true` and allow close. Route the tray `Sair` item through the same confirmation request. Keep `update:quit-and-install`, `before-quit`, OS shutdown, and fatal startup paths forced by setting `isQuitting=true`.

```js
const requestAppQuit = () => {
  if (windowBehavior.confirmBeforeExit && mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.show();
    mainWindow.focus();
    mainWindow.webContents.send("system:exit-confirmation-requested");
    return { confirmationRequired: true };
  }
  isQuitting = true;
  app.quit();
  return { confirmationRequired: false };
};

registerSecureIpcHandler("system:set-window-behavior", (_event, requested) => {
  windowBehavior = {
    minimizeToTray: Boolean(requested?.minimizeToTray),
    confirmBeforeExit: Boolean(requested?.confirmBeforeExit),
  };
  return windowBehavior;
});
registerSecureIpcHandler("system:request-app-quit", () => requestAppQuit());
registerSecureIpcHandler("system:confirm-app-quit", () => {
  isQuitting = true;
  app.quit();
});
```

- [ ] **Step 5: Add preload methods and exact TypeScript declarations**

```ts
type WindowBehavior = { minimizeToTray: boolean; confirmBeforeExit: boolean };

setWindowBehavior?: (behavior: WindowBehavior) => Promise<WindowBehavior>;
requestAppQuit?: () => Promise<{ confirmationRequired: boolean }>;
confirmAppQuit?: () => Promise<void>;
onExitConfirmationRequested?: (callback: () => void) => () => void;
```

- [ ] **Step 6: Verify behavior tests and IPC contract checks**

Run: `npx vitest run tests/window-behavior.test.ts tests/ipc-security.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit the Electron behavior boundary**

```powershell
git add electron/window-behavior.cjs electron/main.cjs electron/preload.cjs src/types/electron.d.ts tests/window-behavior.test.ts
git commit -m "feat(electron): honor configurable window close behavior"
```

---

### Task 3: Restore the Last Stable Screen and Confirm Exit in the Renderer

**Files:**
- Create: `src/services/launcherNavigation.ts`
- Modify: `src/pages/Home.tsx:172-188, 690-701, 1680-1741, 2119-2130`
- Modify: `src/pages/SettingsPage.tsx:238-338, 392-480`
- Create: `tests/launcher-navigation.test.ts`

**Interfaces:**
- Consumes Task 1 behavior preferences and `preferencesHydrated`.
- Consumes Task 2 preload callbacks.
- Produces `SettingsTab = "general" | "personalization" | "account" | "connections" | "controller" | "notifications"`.
- Produces `readLastNavigation(uid): { category: RestorableCategory; settingsTab: SettingsTab }`.
- Produces `writeLastCategory(uid, category)` and `writeLastSettingsTab(uid, tab)`.
- Settings props add `initialTab: SettingsTab` and `onTabChange(tab: SettingsTab): void`.

- [ ] **Step 1: Write failing validation tests for persisted navigation**

```ts
it("falls back when stored navigation is transient or invalid", () => {
  localStorage.setItem("checkpoint_last_category_user-1", "UNKNOWN");
  localStorage.setItem("checkpoint_last_settings_tab_user-1", "modal");
  expect(readLastNavigation("user-1")).toEqual({ category: "ALL", settingsTab: "general" });
});

it("restores a stable category and settings subtab", () => {
  writeLastCategory("user-1", "SETTINGS");
  writeLastSettingsTab("user-1", "connections");
  expect(readLastNavigation("user-1")).toEqual({ category: "SETTINGS", settingsTab: "connections" });
});
```

- [ ] **Step 2: Run the tests and verify the service is absent**

Run: `npx vitest run tests/launcher-navigation.test.ts`

Expected: FAIL with module-not-found.

- [ ] **Step 3: Implement strict navigation persistence**

```ts
export const RESTORABLE_CATEGORIES = ["ALL", "FAVORITES", "STEAM", "LOCAL", "EPIC", "FRIENDS", "FEED", "MODS", "SETTINGS", "PROFILE", "DEALS"] as const;
export const SETTINGS_TABS = ["general", "personalization", "account", "connections", "controller", "notifications"] as const;
export type RestorableCategory = typeof RESTORABLE_CATEGORIES[number];
export type SettingsTab = typeof SETTINGS_TABS[number];
```

Validate stored strings against these arrays; never restore a modal, selected game, search, or temporary panel.

- [ ] **Step 4: Wire hydration, persistence, and the exit modal in `Home`**

After preferences hydrate, restore once only when `restoreLastScreen` is true. Always remember valid category/subtab changes for the next launch. Subscribe to `onExitConfirmationRequested`, include the modal in `isAnyModalOpen`, and reuse `ConfirmationModal` with `confirmAppQuit()`.

```tsx
<ConfirmationModal
  isOpen={exitConfirmationOpen}
  title="Sair do Checkpoint"
  description="O launcher e os recursos em segundo plano serão encerrados."
  confirmLabel="Sair do aplicativo"
  onClose={() => setExitConfirmationOpen(false)}
  onConfirm={() => window.electronAPI?.confirmAppQuit?.()}
  playSound={playSound}
/>
```

- [ ] **Step 5: Make Settings subtab state controlled by validated initial state**

Export `SettingsTab`, initialize from `initialTab`, and call `onTabChange(next)` in the same handler that updates local state. Add an explicit `Sair do aplicativo` action that invokes `requestAppQuit`; do not change `Sair da Conta` behavior in this task.

- [ ] **Step 6: Synchronize window behavior after preference hydration**

```ts
useEffect(() => {
  if (!preferencesHydrated) return;
  void window.electronAPI?.setWindowBehavior?.({
    minimizeToTray: minimizeToTrayOnClose,
    confirmBeforeExit,
  }).catch(console.error);
}, [confirmBeforeExit, minimizeToTrayOnClose, preferencesHydrated]);
```

- [ ] **Step 7: Run navigation and type tests**

Run: `npx vitest run tests/launcher-navigation.test.ts && npm run test:typecheck`

Expected: PASS.

- [ ] **Step 8: Commit stable navigation and exit confirmation**

```powershell
git add src/services/launcherNavigation.ts src/pages/Home.tsx src/pages/SettingsPage.tsx tests/launcher-navigation.test.ts
git commit -m "feat(settings): restore stable navigation and confirm exit"
```

---

### Task 4: Rebuild the Settings Behavior and Audio Hierarchy

**Files:**
- Modify: `src/context/PreferencesContext.tsx:49-760`
- Modify: `src/pages/SettingsPage.tsx:179-236, 502-660`
- Create: `tests/settings-page.test.tsx`

**Interfaces:**
- Consumes all five behavior values/setters from `PreferencesContext`.
- Keeps `VolumeSettingsCard` props unchanged.
- Produces translated labels for behavior controls in all six supported languages.

- [ ] **Step 1: Write failing semantic UI tests**

Render `SettingsPageV2` with the existing required props and mocked providers, then assert:

```tsx
expect(screen.getByRole("heading", { name: /comportamentos do app/i })).toBeInTheDocument();
expect(screen.getByText("Minimizar para a bandeja ao fechar")).toBeInTheDocument();
expect(screen.getByText("Restaurar a última tela aberta")).toBeInTheDocument();
expect(screen.getByText("Confirmar antes de sair")).toBeInTheDocument();

await user.click(screen.getByRole("button", { name: /personalização/i }));
expect(screen.getAllByRole("slider")).toHaveLength(4);
expect(screen.getByText("Som de conquista")).toBeVisible();
expect(screen.getByText("Som de notificação")).toBeVisible();
```

- [ ] **Step 2: Run the test and verify the new behavior copy is absent**

Run: `npx vitest run tests/settings-page.test.tsx`

Expected: FAIL on `Comportamentos do App` and the three new controls.

- [ ] **Step 3: Add localized behavior copy without changing palette values**

Add keys for `appBehavior`, `appBehaviorHint`, `minimizeToTray`, `restoreLastScreen`, and `confirmBeforeExit`, including hints, to Portuguese, English, Spanish, French, German, and Italian translation maps.

- [ ] **Step 4: Render five consistent behavior rows**

Replace the `Desempenho` header in General with `Comportamentos do App`, retain `Iniciar com o Windows` and `Ocultar ao Jogar`, and add the three approved switches. Use the current border/background/opacity values exactly; change only layout classes, dimensions, spacing, typography, and radius.

- [ ] **Step 5: Convert audio cards to a compact responsive 2 × 2 layout**

Use `grid-cols-1 md:grid-cols-2`. Inside `VolumeSettingsCard`, remove title truncation, align percentage and `Testar`, keep `Mudo`/`Máximo`, preserve music `max={35}`, and keep the same callback for each existing channel. Do not alter any inline color or opacity value.

- [ ] **Step 6: Run UI tests and typecheck**

Run: `npx vitest run tests/settings-page.test.tsx tests/use-sound-effects.test.tsx && npm run test:typecheck`

Expected: PASS.

- [ ] **Step 7: Commit the Settings hierarchy**

```powershell
git add src/context/PreferencesContext.tsx src/pages/SettingsPage.tsx tests/settings-page.test.tsx
git commit -m "feat(settings): organize behavior and audio controls"
```

---

### Task 5: Add the Persistent Profile Visibility Model

**Files:**
- Create: `supabase/migrations/20260801090000_profile_visibility.sql`
- Create: `src/services/profilePrivacy.ts`
- Modify: `src/types/domain.ts:69-130`
- Modify: `src/auth/AuthProvider.tsx:26-53`
- Modify: `tests/profile.test.ts`
- Modify: `tests/supabase-schema-contract.test.ts`

**Interfaces:**
- Produces `ProfileVisibility = "public" | "private"` from `src/types/domain.ts`.
- Adds `profileVisibility?: ProfileVisibility` to `UserProfile`.
- Produces `saveProfileVisibility(visibility: ProfileVisibility): Promise<ProfileVisibility>`.

- [ ] **Step 1: Write failing service and migration-contract tests**

```ts
it("accepts only public or private visibility", () => {
  expect(normalizeProfileVisibility("public")).toBe("public");
  expect(normalizeProfileVisibility("private")).toBe("private");
  expect(() => normalizeProfileVisibility("friends")).toThrow(/visibilidade/i);
});

it("adds a constrained public default", () => {
  expect(privacyMigration).toContain("profile_visibility text not null default 'public'");
  expect(privacyMigration).toContain("check (profile_visibility in ('public', 'private'))");
});
```

- [ ] **Step 2: Run tests and verify the model is absent**

Run: `npx vitest run tests/profile.test.ts tests/supabase-schema-contract.test.ts`

Expected: FAIL because the migration and privacy service do not exist.

- [ ] **Step 3: Add the idempotent migration**

```sql
begin;

alter table public.profiles
  add column if not exists profile_visibility text not null default 'public';

alter table public.profiles
  drop constraint if exists profiles_profile_visibility_check;
alter table public.profiles
  add constraint profiles_profile_visibility_check
  check (profile_visibility in ('public', 'private'));

commit;
```

- [ ] **Step 4: Implement authenticated persistence and mapping**

```ts
// src/types/domain.ts
export type ProfileVisibility = "public" | "private";

// src/services/profilePrivacy.ts
import type { ProfileVisibility } from "../types/domain";

export const normalizeProfileVisibility = (value: unknown): ProfileVisibility => {
  if (value === "public" || value === "private") return value;
  throw new Error("Visibilidade de perfil inválida.");
};

export const saveProfileVisibility = async (visibility: ProfileVisibility) => {
  const session = (await supabase.auth.getSession()).data.session;
  if (!session?.user) throw new Error("Faça login novamente para alterar a privacidade.");
  const { error } = await supabase.from("profiles")
    .update({ profile_visibility: visibility })
    .eq("uid", session.user.id);
  if (error) throw error;
  return visibility;
};
```

Map `profile_visibility` in `AuthProvider.toProfile`, defaulting missing rows to `public`.

- [ ] **Step 5: Run profile and schema tests**

Run: `npx vitest run tests/profile.test.ts tests/supabase-schema-contract.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit the account model**

```powershell
git add supabase/migrations/20260801090000_profile_visibility.sql src/services/profilePrivacy.ts src/types/domain.ts src/auth/AuthProvider.tsx tests/profile.test.ts tests/supabase-schema-contract.test.ts
git commit -m "feat(profile): persist public and private visibility"
```

---

### Task 6: Enforce Visibility in Server Search and Profile Responses

**Files:**
- Modify: `server/index.mjs:1409-1449, 1721-1759, 1824-1906`
- Modify: `tests/api.test.ts`

**Interfaces:**
- Consumes Task 5 `profiles.profile_visibility`.
- Produces `canViewDetailedProfile({ visibility, isSelf, isAcceptedFriend }): boolean`.
- Produces `projectSearchProfile(row):` basic identity for private profiles and current public projection for public profiles.
- Changes `GET /api/friends/:uid/profile`: allow public profiles to authenticated non-friends; require self or accepted friendship for private details.

- [ ] **Step 1: Add failing access-matrix and projection tests**

```ts
it.each([
  ["public", false, false, true],
  ["private", true, false, true],
  ["private", false, true, true],
  ["private", false, false, false],
])("enforces profile visibility", (visibility, isSelf, isAcceptedFriend, expected) => {
  expect(canViewDetailedProfile({ visibility, isSelf, isAcceptedFriend })).toBe(expected);
});

it("projects only name and avatar for private search results", () => {
  expect(projectSearchProfile({
    uid: "u2", display_name: "Player", photo_url: "https://img.example/a.png",
    profile_visibility: "private", status: "playing", playing: "Portal 2",
    discord_username: "secret",
  })).toEqual({
    uid: "u2", displayName: "Player", photoURL: "https://img.example/a.png",
    profileVisibility: "private",
  });
});
```

- [ ] **Step 2: Run the API tests and verify helpers are missing**

Run: `npx vitest run tests/api.test.ts`

Expected: FAIL on missing exports.

- [ ] **Step 3: Implement and export the pure privacy helpers**

Normalize missing visibility to `public`. Never include email, linked account identifiers, presence, current game, statistics, achievements, bio, website, genres, or games in a private non-friend search projection.

- [ ] **Step 4: Apply helpers to server queries**

Include `profile_visibility` in the search and detail queries. In the detail route, fetch the profile visibility and accepted friendship before authorizing. Return 403 with `Perfil privado disponível apenas para amigos.` for a private non-friend. Preserve full responses for accepted friends and allow public profiles for any authenticated requester.

- [ ] **Step 5: Audit related social routes**

Confirm `/api/friends/status` remains restricted to accepted friendship IDs and activity feeds remain audience-restricted. Add assertions to `tests/api.test.ts` that these routes still derive their audience from accepted relationships rather than visibility supplied by the client.

- [ ] **Step 6: Run server tests**

Run: `npx vitest run tests/api.test.ts tests/social-activity.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit server enforcement**

```powershell
git add server/index.mjs tests/api.test.ts
git commit -m "feat(profile): enforce visibility in social responses"
```

---

### Task 7: Add Privacy Controls and Public Profile Discovery UI

**Files:**
- Modify: `src/pages/SettingsPage.tsx:335-360, 748-855`
- Modify: `src/pages/FriendsPage.tsx:337-630`
- Modify: `src/pages/Home.tsx:1010-1030, 2043-2053`
- Modify: `tests/settings-page.test.tsx`
- Create: `tests/profile-privacy.test.ts`

**Interfaces:**
- Consumes `saveProfileVisibility`, `userProfile.profileVisibility`, and `refreshProfile`.
- Add `onViewProfile(profile: UserProfile): void` to `AddFriendModalProps`.
- Generalize the existing profile loader to accept a Checkpoint uid found in search, not only `cp-friend:*` IDs.

- [ ] **Step 1: Write failing rollback and public-profile service tests**

```ts
it("rolls back the selected visibility when Supabase rejects the update", async () => {
  updateMock.mockResolvedValue({ error: new Error("offline") });
  render(<SettingsHarness initialVisibility="public" />);
  await user.click(screen.getByRole("button", { name: /^privado/i }));
  expect(await screen.findByText(/não foi possível salvar/i)).toBeVisible();
  expect(screen.getByRole("button", { name: /^público/i })).toHaveAttribute("aria-pressed", "true");
});

it("requests a discovered public profile by uid", async () => {
  await getCheckpointFriendProfile("public-user");
  expect(fetchMock).toHaveBeenCalledWith(
    "https://backend.example/api/friends/public-user/profile",
    expect.any(Object),
  );
});
```

- [ ] **Step 2: Run the privacy tests and confirm missing UI behavior**

Run: `npx vitest run tests/profile-privacy.test.ts tests/settings-page.test.tsx`

Expected: FAIL until service mocks and privacy controls are wired.

- [ ] **Step 3: Split connected accounts and profile privacy into distinct blocks**

Keep existing Steam/Discord callbacks and Spotify disabled state unchanged. Add Public and Private choices with complete explanatory copy. Initialize from `userProfile.profileVisibility ?? "public"`.

- [ ] **Step 4: Implement saving, success, and rollback states**

```ts
const changeVisibility = async (next: ProfileVisibility) => {
  const previous = profileVisibility;
  setProfileVisibility(next);
  setPrivacyState("saving");
  try {
    await saveProfileVisibility(next);
    await refreshProfile();
    setPrivacyState("saved");
  } catch (error) {
    setProfileVisibility(previous);
    setPrivacyState("error");
  }
};
```

Disable both choices while saving and show explicit `Salvo` or `Não foi possível salvar. Tente novamente.` feedback.

- [ ] **Step 5: Let search results open allowed profiles**

Add a `Ver perfil` action beside the existing request action. Close the search modal, call the generalized uid profile loader, and render the existing `UserProfilePage` modal. For a 403 private response, retain the result card and show the server error rather than fabricating a local full profile.

- [ ] **Step 6: Run targeted privacy/UI tests**

Run: `npx vitest run tests/profile-privacy.test.ts tests/settings-page.test.tsx tests/profile.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit privacy UI and discovery**

```powershell
git add src/pages/SettingsPage.tsx src/pages/FriendsPage.tsx src/pages/Home.tsx tests/settings-page.test.tsx tests/profile-privacy.test.ts
git commit -m "feat(settings): add profile privacy controls"
```

---

### Task 8: Gate the Gamepad Focus Ring by Active Input

**Files:**
- Modify: `src/context/GamepadContext.tsx:87-114, 236-260, 278-312`
- Modify: `src/index.css:160-174`
- Modify: `tests/gamepad-navigation.test.tsx`

**Interfaces:**
- Produces root attribute `data-gamepad-navigation="active"` only when a gamepad is connected and `activeInputType === "gamepad"`.
- Keyboard `:focus-visible` remains independent.

- [ ] **Step 1: Add failing input-mode attribute tests**

```tsx
it("shows controller focus mode only for a connected active gamepad", () => {
  render(<GamepadProvider><Status /></GamepadProvider>);
  gamepads = [makeGamepad({ pressed: [0] })];
  runFrame();
  expect(document.documentElement).toHaveAttribute("data-gamepad-navigation", "active");

  fireEvent.mouseMove(window);
  expect(document.documentElement).not.toHaveAttribute("data-gamepad-navigation");
});
```

Also test disconnect and trusted keyboard input remove the controller attribute.

- [ ] **Step 2: Run the gamepad tests and observe the missing attribute**

Run: `npx vitest run tests/gamepad-navigation.test.tsx`

Expected: FAIL on the root attribute assertion.

- [ ] **Step 3: Synchronize and clean up the root attribute**

```ts
useEffect(() => {
  const active = isGamepadConnected && activeInputType === "gamepad";
  if (active) document.documentElement.dataset.gamepadNavigation = "active";
  else delete document.documentElement.dataset.gamepadNavigation;
  return () => delete document.documentElement.dataset.gamepadNavigation;
}, [activeInputType, isGamepadConnected]);
```

- [ ] **Step 4: Gate only the controller-specific CSS selector**

```css
html[data-gamepad-navigation="active"]
  [data-system-page]
  [data-gamepad-focused="true"] {
  outline: 2px solid rgb(var(--launcher-accent));
  outline-offset: 3px;
  box-shadow:
    0 0 0 4px rgb(var(--launcher-accent) / 0.18),
    0 0 24px rgb(var(--launcher-accent) / 0.28);
}
```

Keep all values exactly unchanged from the current controller ring.

- [ ] **Step 5: Run gamepad tests**

Run: `npx vitest run tests/gamepad-navigation.test.tsx`

Expected: PASS.

- [ ] **Step 6: Commit input-aware focus styling**

```powershell
git add src/context/GamepadContext.tsx src/index.css tests/gamepad-navigation.test.tsx
git commit -m "fix(gamepad): show focus ring only for active controller input"
```

---

### Task 9: Make Directional Focus Deterministic

**Files:**
- Create: `src/utils/spatialFocus.ts`
- Modify: `src/hooks/useGamepadFocusNavigation.ts:1-146`
- Modify: `src/pages/SettingsPage.tsx`
- Create: `tests/gamepad-focus-navigation.test.tsx`

**Interfaces:**
- Produces `SpatialDirection = "up" | "down" | "left" | "right"` from `src/utils/spatialFocus.ts`.
- Produces `findDeclaredNeighbor(root, current, direction): HTMLElement | null`.
- Produces `rankSpatialCandidates(currentRect, candidates, direction): HTMLElement[]`.
- Consumes `data-gamepad-id` and optional `data-gamepad-nav-up|down|left|right`.

- [ ] **Step 1: Reproduce the diagonal-jump bug in a failing pure ranking test**

```ts
it("prefers the aligned control below over a nearer diagonal control", () => {
  const current = rect(100, 100, 80, 40);
  const alignedBelow = candidate("below", rect(100, 190, 80, 40));
  const diagonal = candidate("diagonal", rect(260, 155, 80, 40));
  expect(rankSpatialCandidates(current, [diagonal, alignedBelow], "down")[0].dataset.gamepadId)
    .toBe("below");
});
```

Add tests for declared neighbors, hidden/disabled exclusion, left/right, and range handling.

- [ ] **Step 2: Run the test and verify the utility is absent**

Run: `npx vitest run tests/gamepad-focus-navigation.test.tsx`

Expected: FAIL with module-not-found.

- [ ] **Step 3: Implement declared-neighbor resolution and cone ranking**

For fallback candidates, require positive primary-axis distance and reject candidates whose secondary distance exceeds `primaryDistance * 1.5 + currentSecondarySize`. Sort by: declared neighbor, axis overlap, smallest angular deviation (`secondary / primary`), primary distance, then DOM order. Export pure functions for tests.

- [ ] **Step 4: Integrate the utility into the focus hook**

Use a declared neighbor first. If the focused element is a range, left/right must call `stepDown/stepUp` and dispatch bubbling `input` and `change`; up/down continues focus navigation. Clear stale `data-gamepad-focused` attributes before setting the next element.

- [ ] **Step 5: Add explicit Settings navigation metadata**

Give sidebar items stable IDs such as `settings-tab-general`. Give the first interactive item of each content tab an ID and declare horizontal neighbors between the active sidebar tab and content. Add IDs/neighbors to each 2 × 2 audio card and its slider/test button so down stays in the same column and left/right stays in the same row unless a slider consumes the direction. After a subtab change, clear stale focus and focus that tab's declared first control.

- [ ] **Step 6: Run focus, controller, and settings tests**

Run: `npx vitest run tests/gamepad-focus-navigation.test.tsx tests/gamepad-navigation.test.tsx tests/settings-page.test.tsx`

Expected: PASS.

- [ ] **Step 7: Commit deterministic focus navigation**

```powershell
git add src/utils/spatialFocus.ts src/hooks/useGamepadFocusNavigation.ts src/pages/SettingsPage.tsx tests/gamepad-focus-navigation.test.tsx
git commit -m "fix(gamepad): make settings focus navigation deterministic"
```

---

### Task 10: Regression and Visual Verification

**Files:**
- Modify only files from Tasks 1-9 if verification exposes an in-scope defect.

**Interfaces:**
- Consumes all prior task outputs.
- Produces a verified build; it does not publish or release anything.

- [ ] **Step 1: Run all targeted suites together**

Run:

```powershell
npx vitest run tests/preferences-context.test.tsx tests/window-behavior.test.ts tests/launcher-navigation.test.ts tests/settings-page.test.tsx tests/profile.test.ts tests/profile-privacy.test.ts tests/supabase-schema-contract.test.ts tests/api.test.ts tests/social-activity.test.ts tests/gamepad-navigation.test.tsx tests/gamepad-focus-navigation.test.tsx tests/use-sound-effects.test.tsx
```

Expected: all targeted tests PASS.

- [ ] **Step 2: Run repository-wide static and test validation**

Run:

```powershell
npm run test:typecheck
npm run lint
npm test
npm run build
```

Expected: every command exits 0. If lint reports pre-existing unrelated failures, record exact output and ensure no new failure points to files changed by this plan.

- [ ] **Step 3: Run the desktop flow manually**

Unset `ELECTRON_RUN_AS_NODE`, restart Electron after preload/main changes, and verify:

1. General shows all five behavior switches.
2. Closing follows hide/confirm/quit precedence and updater quit remains unblocked.
3. Last category and Settings tab restore only when enabled.
4. Audio uses a readable 2 × 2 layout at 1365 × 768 with four functional sliders.
5. Public/private survives restart; a non-friend sees only name/avatar for private and can open a public profile.
6. The focus ring appears only after controller input and disappears after mouse/keyboard input.
7. Down/up/left/right follows the visible Settings grid and sliders consume left/right.

- [ ] **Step 4: Inspect the final diff for palette and scope regressions**

Run:

```powershell
git diff --check
git diff --stat
git status --short
```

Compare every changed color/opacity line against the baseline. Revert only accidental changes introduced by this plan; do not touch unrelated user work.

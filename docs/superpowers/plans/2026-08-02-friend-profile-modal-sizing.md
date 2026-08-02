# Friend Profile Modal Sizing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand the friend profile modal to the available launcher viewport, keep every profile section reachable, and place the close button visually outside the profile surface.

**Architecture:** Keep `ModalShell` unchanged for all other dialogs and configure only the friend-profile instance in `Home.tsx`. Its animated outer element becomes an overflow-visible positioning frame; a new inner element owns the surface, clipping, border, and scrollable `UserProfilePage`, while the close button is positioned from the outer frame.

**Tech Stack:** React 19, TypeScript, Tailwind CSS 4, Framer Motion, Vitest.

## Global Constraints

- Keep the launcher background visible around the modal.
- Use a maximum width of 1440px with a 24px viewport margin.
- Use `calc(100dvh - 48px)` for modal height.
- Do not change profile data, statistics, permissions, or loading behavior.
- Preserve mouse, keyboard, Escape, backdrop, and gamepad close behavior.
- Keep `UserProfilePage` as the internal scroll owner on smaller displays.

---

### Task 1: Expand and restructure the friend profile modal

**Files:**
- Create: `tests/friend-profile-modal-layout.test.ts`
- Modify: `src/pages/Home.tsx:2186-2220`

**Interfaces:**
- Consumes: `ModalShell` props `maxWidthClassName`, `containerClassName`, `className`, `zIndexClassName`, and the existing `friendProfileModal` state.
- Produces: a friend-profile dialog whose outer frame permits overflow, whose inner surface clips its contents, and whose close button is outside that surface.

- [ ] **Step 1: Write the failing layout contract test**

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync("src/pages/Home.tsx", "utf8");
const friendModal = source.slice(
  source.indexOf('<ModalShell\n        isOpen={Boolean(friendProfileModal)}'),
  source.indexOf("<ConfirmationModal", source.indexOf('<ModalShell\n        isOpen={Boolean(friendProfileModal)}')),
);

describe("friend profile modal layout", () => {
  it("uses the large viewport frame and keeps its outer overflow visible", () => {
    expect(friendModal).toContain('maxWidthClassName="max-w-[min(1440px,calc(100vw-48px))]"');
    expect(friendModal).toContain('containerClassName="p-6"');
    expect(friendModal).toContain('className="relative h-[calc(100dvh-48px)] max-h-none overflow-visible p-0"');
  });

  it("clips the inner profile surface and offsets the close control outside it", () => {
    expect(friendModal).toContain('data-friend-profile-surface');
    expect(friendModal).toContain('className="flex h-full flex-col overflow-hidden rounded-[32px] border border-white/10 bg-[#050507] shadow-2xl"');
    expect(friendModal).toContain('aria-label="Fechar perfil do amigo"');
    expect(friendModal).toContain('-right-3 -top-3');
  });
});
```

- [ ] **Step 2: Run the focused test and verify that it fails**

Run: `npm test -- tests/friend-profile-modal-layout.test.ts`

Expected: FAIL because the current modal still uses `max-w-6xl`, `90dvh/820px`, clips the `ModalShell` itself, and positions the close control inside the surface.

- [ ] **Step 3: Implement the larger outer frame and clipped inner surface**

Replace the friend-profile `ModalShell` block in `Home.tsx` with this structure, preserving the existing close callbacks and `UserProfilePage` props exactly:

```tsx
<ModalShell
  isOpen={Boolean(friendProfileModal)}
  onClose={() => {
    playSound("back");
    setFriendProfileModal(null);
  }}
  maxWidthClassName="max-w-[min(1440px,calc(100vw-48px))]"
  containerClassName="p-6"
  zIndexClassName="z-[165]"
  className="relative h-[calc(100dvh-48px)] max-h-none overflow-visible p-0"
>
  <div
    data-friend-profile-surface
    className="flex h-full flex-col overflow-hidden rounded-[32px] border border-white/10 bg-[#050507] shadow-2xl"
  >
    {friendProfileModal && (
      <React.Suspense fallback={<div className="p-10 text-white/40">Carregando perfil...</div>}>
        <UserProfilePage
          userProfile={friendProfileModal.profile}
          user={{ email: null, photoURL: friendProfileModal.profile.photoURL }}
          games={friendProfileModal.games}
          editable={false}
          playSound={playSound as any}
          language={launcherLanguage}
          copyFriendDiscord
          onNotify={notify}
        />
      </React.Suspense>
    )}
  </div>
  <button
    type="button"
    aria-label="Fechar perfil do amigo"
    onClick={() => {
      playSound("back");
      setFriendProfileModal(null);
    }}
    className="absolute -right-3 -top-3 z-20 flex h-12 w-12 items-center justify-center rounded-full border border-white/20 bg-[#08080a] text-white/70 shadow-[0_12px_32px_rgba(0,0,0,0.6)] transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
  >
    <X className="h-5 w-5" />
  </button>
</ModalShell>
```

- [ ] **Step 4: Run the focused layout and existing profile hierarchy tests**

Run: `npm test -- tests/friend-profile-modal-layout.test.ts tests/chat-profile-layout.test.tsx tests/user-profile-links.test.tsx`

Expected: all tests PASS; profile hierarchy and external-link behavior remain unchanged.

- [ ] **Step 5: Run full verification**

Run: `npm run test:typecheck`

Expected: PASS with no TypeScript errors.

Run: `npm test`

Expected: complete Vitest suite PASS.

Run: `npm run lint`

Expected: exit code 0 with no new errors; pre-existing warnings may remain.

Run: `npm run build`

Expected: production build PASS.

Run: `git diff --check`

Expected: no whitespace errors.

- [ ] **Step 6: Commit the implementation**

```bash
git add src/pages/Home.tsx tests/friend-profile-modal-layout.test.ts
git commit -m "fix: expand friend profile modal"
```

Do not include unrelated existing worktree changes in this commit.

### Task 2: Use official Steam and Spotify brand icons

**Files:**
- Create: `tests/brand-icons.test.ts`
- Modify: `src/components/AddGameModal.tsx`
- Modify: `src/components/Sidebar.tsx`

**Interfaces:**
- Consumes: the installed `@fortawesome/react-fontawesome` and `@fortawesome/free-brands-svg-icons` packages.
- Produces: `SteamBrandIcon` in the Steam platform selector and `SpotifyBrandIcon` in the sidebar category map, without changing either control's existing layout or state styling.

- [ ] **Step 1: Write the failing brand icon contract test**

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const addGameModal = readFileSync("src/components/AddGameModal.tsx", "utf8");
const sidebar = readFileSync("src/components/Sidebar.tsx", "utf8");

describe("official platform brand icons", () => {
  it("uses the Font Awesome Steam icon in the add-game platform selector", () => {
    expect(addGameModal).toContain('import { faSteam } from "@fortawesome/free-brands-svg-icons"');
    expect(addGameModal).toContain('icon: () => <FontAwesomeIcon icon={faSteam} className="h-[17px] w-[17px]" />');
    expect(addGameModal).not.toContain('label: copy.steam, icon: () => <Globe');
  });

  it("uses the Font Awesome Spotify icon in the sidebar", () => {
    expect(sidebar).toContain("faSpotify");
    expect(sidebar).toContain("export const SpotifyBrandIcon");
    expect(sidebar).toContain('{ id: "SPOTIFY", label: "Spotify", Icon: SpotifyBrandIcon }');
    expect(sidebar).not.toContain('{ id: "SPOTIFY", label: "Spotify", Icon: Music2 }');
  });
});
```

- [ ] **Step 2: Run the focused test and verify that it fails**

Run: `npm test -- tests/brand-icons.test.ts`

Expected: FAIL because Steam still uses `Globe` and Spotify still uses `Music2`.

- [ ] **Step 3: Replace only the two requested icons**

In `AddGameModal.tsx`, remove `Globe` from the Lucide import, import `FontAwesomeIcon` and `faSteam`, then set the Steam platform option to:

```tsx
{ id: "steam" as const, label: copy.steam, icon: () => <FontAwesomeIcon icon={faSteam} className="h-[17px] w-[17px]" /> },
```

In `Sidebar.tsx`, remove `Music2`, import `faSpotify` beside the existing Font Awesome brands, add a `SpotifyBrandIcon` wrapper matching `SteamBrandIcon`, and update only the Spotify category:

```tsx
export const SpotifyBrandIcon: React.FC<{ className?: string; style?: React.CSSProperties }> = ({
  className,
  style,
}) => (
  <FontAwesomeIcon
    icon={faSpotify}
    className={className}
    style={style as React.ComponentProps<typeof FontAwesomeIcon>["style"]}
  />
);

{ id: "SPOTIFY", label: "Spotify", Icon: SpotifyBrandIcon },
```

- [ ] **Step 4: Run focused and full verification**

Run: `npm test -- tests/brand-icons.test.ts tests/add-game-modal.test.tsx`

Expected: all focused tests PASS.

Run: `npm run test:typecheck && npm test && npm run lint && npm run build`

Expected: TypeScript, full Vitest suite, lint, and production build complete without new errors.

Run: `git diff --check`

Expected: no whitespace errors.

- [ ] **Step 5: Commit the icon changes**

```bash
git add src/components/AddGameModal.tsx src/components/Sidebar.tsx tests/brand-icons.test.ts
git commit -m "fix: use official platform icons"
```

Do not stage unrelated local changes.

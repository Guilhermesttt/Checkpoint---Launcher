# Retro CRT Viewport Alignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fit the retro interface exactly inside the transparent opening of `sony-crt.png`.

**Architecture:** Preserve the current fixed fullscreen container and overlay layers. Correct only the percentage insets on `.retro-tv-viewport`, using bounds measured from the 1920 x 1200 PNG, then validate existing regressions and the rendered result.

**Tech Stack:** React, TypeScript, CSS, Vitest

## Global Constraints

- Do not change colors, opacity, effects, cameras, components, interactions, gamepad behavior, or sounds.
- Preserve all unrelated staged, unstaged, and untracked user work.
- Use `top: 4.5%`, `bottom: 4.5%`, `left: 12.7083%`, and `right: 12.6042%`.

---

### Task 1: Correct and validate the CRT viewport bounds

**Files:**
- Modify: `src/index.css`

**Interfaces:**
- Consumes: `.retro-tv-viewport` rendered by `RetroGamingPage`
- Produces: viewport bounds that match the transparent PNG opening

- [ ] **Step 1: Implement the measured bounds**

Replace only the four inset declarations in `.retro-tv-viewport`:

```css
top: 4.5%;
bottom: 4.5%;
left: 12.7083%;
right: 12.6042%;
```

- [ ] **Step 2: Verify relevant regressions**

Run:

```powershell
npm test -- --run tests/retro-gaming-page.test.tsx
npm run typecheck
```

Expected: both commands pass.

- [ ] **Step 3: Validate the rendered fit**

Open the launcher at the target viewport and verify that the retro content edges align with the transparent overlay opening without crossing onto the bezel.

- [ ] **Step 4: Inspect the scoped diff**

Run: `git diff -- src/index.css tests/retro-gaming-page.test.tsx`

Expected: within the implementation, only the four viewport declarations changed; unrelated pre-existing changes remain intact.

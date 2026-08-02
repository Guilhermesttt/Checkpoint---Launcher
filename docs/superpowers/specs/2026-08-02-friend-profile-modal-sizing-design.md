# Friend Profile Modal Sizing Design

## Goal

Make the friend profile modal use the available launcher viewport without clipping its content, while placing the close control visually outside the main profile card.

## Layout

- Keep the profile as a modal with the launcher background visible around it.
- Allow a maximum width of 1440px while respecting a 24px viewport margin.
- Use `calc(100dvh - 48px)` for the modal height.
- Keep the animated `ModalShell` container overflow visible so the external close button is not clipped.
- Add an inner wrapper that owns the rounded border, background, shadow, and `overflow-hidden` behavior.
- Keep `UserProfilePage` as the internal scroll owner so all profile sections remain reachable on smaller displays.

## Close Control

- Position the close button beyond the inner card's top-right edge.
- Increase its hit target and retain mouse, keyboard, Escape, backdrop, and gamepad close behavior.
- Keep it above both the modal content and the backdrop.

## Responsive Behavior

- On compact viewports, pull the close button back inside the safe viewport margin.
- Preserve the existing compact profile density rules and section hierarchy.
- Do not change profile data, statistics, permissions, or loading behavior.

## Verification

- Add a layout contract test for the larger dimensions, visible outer overflow, clipped inner surface, and external close offset.
- Run the profile layout tests, TypeScript check, complete test suite, lint, build, and `git diff --check`.

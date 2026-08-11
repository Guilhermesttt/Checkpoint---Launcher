# Retro CRT Viewport Alignment Design

## Goal

Align the entire retro interface exactly with the transparent screen opening in `src/assets/sony-crt.png`.

## Measured bounds

The 1920 x 1200 overlay has a transparent center opening whose center axes span:

- horizontal: pixels 244 through 1677, equivalent to `12.7083%` from the left and `12.6042%` from the right;
- vertical: pixels 54 through 1145, equivalent to `4.5%` from both the top and bottom.

## Implementation

Change only the `top`, `bottom`, `left`, and `right` values of `.retro-tv-viewport` in `src/index.css` to the measured percentages. Keep the overlay image sizing, colors, filters, CRT effects, cameras, components, interactions, and sound behavior unchanged.

Validate the existing retro page regressions and inspect the rendered overlay at the target viewport. A source-text assertion is intentionally excluded because it would test CSS text rather than the visible behavior.

## Acceptance criteria

- The retro viewport occupies only the transparent opening of `sony-crt.png`.
- The viewport is vertically centered instead of ending early at the bottom.
- No existing visual styling or retro behavior changes.
- The focused retro page tests and project typecheck pass, and the rendered viewport aligns with the overlay opening.

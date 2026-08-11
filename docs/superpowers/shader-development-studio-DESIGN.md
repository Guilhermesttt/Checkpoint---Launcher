---
version: alpha
name: "Retro CRT Splash"
description: "Shader Development Studio presents a deliberate retro-computing aesthetic modeled after 1980s–90s PC BIOS/software splash screens. The dominant visual is a deep cobalt-blue CRT display with visible scanline noise and screen curvature, rendering a large serif wordmark (\"SHADER\") in off-white with chromatic aberration fringing. A striped rainbow-gradient logo mark echoes classic OS-era iconography. A segmented progress bar rendered in block characters sits center-screen, and a copyright footer in amber/green monospace text completes the illusion. The underlying web stack uses Tailwind CSS with a single custom font variable (STIX Two Text) and a warm off-white foreground (#fcf9f3) against a near-black background (#000000 outer bezel), with the CRT blue (#3a3a9e approx.) as the dominant surface."
colors:
  border-hairline: "#e5e7eb"
  crt-blue-surface: "#3d3d9e"
  outer-bezel-black: "#000000"
  phosphor-white: "#fcf9f3"
typography:
  body-ui-text:
    fontFamily: "STIX Two Text"
    fontSize: "16px"
    fontWeight: "400"
    lineHeight: "24px"
  display-wordmark:
    fontFamily: "STIX Two Text"
    fontSize: "72px"
    fontWeight: "700"
    lineHeight: "1"
rounded:
  none: "0px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  copyright-footer-amber-terminal-text:
    fontFamily: "STIX Two Text (or monospace fallback)"
    fontSize: "14px (estimated)"
    textColor: "#c8a96e (amber/warm tint — visual estimate, not in CSSOM)"
    textAlign: "center"
  logo-mark-rainbow-stripe-disc:
    shape: "circular disc with horizontal stripe gradient"
    colors: "multi-color horizontal stripes (red, orange, yellow, green, blue, white)"
    size: "~80px diameter (estimated)"
    effect: "chromatic aberration fringing on edges"
  progress-bar-block-segment-bar:
    border: "1px solid #e5e7eb"
    rounded: "{rounded.none}"
    fillColor: "#fcf9f3 (block segments)"
    backgroundColor: "#3d3d9e (unfilled portion)"
    height: "~32px (estimated from screenshot)"
    width: "~40% of viewport width"
  splash-screen-default-boot-splash:
    backgroundColor: "#3d3d9e (CRT blue fill)"
    rounded: "0px (sharp corners, CRT bezel effect via outer black)"
    fontFamily: "STIX Two Text"
    fontSize: "16px"
    textColor: "{colors.phosphor-white}"
    layout: "centered column, full viewport height"
  version-string:
    fontFamily: "STIX Two Text"
    fontSize: "16px"
    fontWeight: "400"
    lineHeight: "{spacing.lg}"
    textColor: "{colors.phosphor-white}"
    textAlign: "center"
  wordmark-crt-display-wordmark:
    fontFamily: "STIX Two Text"
    fontWeight: "700"
    fontSize: "~72px (estimated)"
    textColor: "{colors.phosphor-white}"
    effect: "chromatic aberration — red/cyan fringe offset"
---

## Overview

Shader Development Studio presents a deliberate retro-computing aesthetic modeled after 1980s–90s PC BIOS/software splash screens. The dominant visual is a deep cobalt-blue CRT display with visible scanline noise and screen curvature, rendering a large serif wordmark ("SHADER") in off-white with chromatic aberration fringing. A striped rainbow-gradient logo mark echoes classic OS-era iconography. A segmented progress bar rendered in block characters sits center-screen, and a copyright footer in amber/green monospace text completes the illusion. The underlying web stack uses Tailwind CSS with a single custom font variable (STIX Two Text) and a warm off-white foreground (#fcf9f3) against a near-black background (#000000 outer bezel), with the CRT blue (#3a3a9e approx.) as the dominant surface.

**Signature traits:**
- Single-family weight hierarchy: Builds hierarchy from STIX Two Text across 2 weights rather than multiple families.
- Tight geometric corners: Near-square geometry with corner radii capped around 0px.

## Colors

The palette uses 4 validated color tokens across 1 theme profile. Semantic roles stay attached to observed usage so generation agents can choose accents without inventing new color meaning.

**Semantic naming:**
- **surface-background** maps to `crt-blue-surface`: Role "background" is grounded by usage context "Primary CRT screen fill — the dominant cobalt-blue background of the splash screen canvas".
- **surface-text** maps to `phosphor-white`: Role "text" is grounded by usage context "All foreground text, wordmark, and UI element strokes rendered on the CRT surface".
- **action-primary** maps to `border-hairline`: Role "primary" is grounded by usage context "Progress bar outline and UI element borders; action-centric usage across header, main, hero zones".

### Primary Brand
- **Border Hairline** (#e5e7eb): Progress bar outline and UI element borders; action-centric usage across header, main, hero zones. Role: primary. {authored: rgb(229, 231, 235), space: rgb}

### Text Scale
- **Phosphor White** (#fcf9f3): All foreground text, wordmark, and UI element strokes rendered on the CRT surface. Role: text. {authored: rgb(252, 249, 243), space: rgb}

### Surface & Shadows
- **CRT Blue Surface** (#3d3d9e): Primary CRT screen fill — the dominant cobalt-blue background of the splash screen canvas. Role: background.
- **Outer Bezel Black** (#000000): CRT monitor bezel / page outer background framing the screen. Role: background. {authored: rgb(0, 0, 0), space: rgb}

## Typography

Typography uses STIX Two Text across extracted hierarchy roles. Keep hierarchy mapped to these token rows before adding decorative type styles.

Uses STIX Two Text throughout for a uniform feel. Weight range spans regular, bold. Sizes range from 16px to 72px.

### Font Roles
- **Headline Font**: STIX Two Text
- **Body Font**: STIX Two Text

### Type Scale Evidence
| Role | Font | Size | Weight | Line Height | Letter Spacing | Stack / Features | Notes |
|------|------|------|--------|-------------|----------------|------------------|-------|
| Primary and only confirmed typeface — used for all body copy, version strings, copyright notice, and UI labels on the splash screen | STIX Two Text | 16px | 400 | 24px | normal | STIX Two Text, STIX Two Text Fallback | Extracted token |
| Large 'SHADER' wordmark headline — visually prominent serif display treatment with chromatic aberration effect | STIX Two Text | 72px | 700 | 1 | normal | STIX Two Text, STIX Two Text Fallback | Extracted token |

## Layout

Responsive system uses 3 breakpoint tier(s): tablet, desktop, wide.

This system uses a 8px base grid with scale values 4, 8, 16, 24, 32, 48, 64.

### Responsive Strategy
- **tablet (>= 640px)**: Increase spacing and column structure for medium-width viewports.
- **desktop (>= 1024px)**: Expand layout density and horizontal composition for wide viewports.
- **wide (>= 1536px)**: Stretch composition with generous gutters and wider layout spans.

### Spacing System
| Token | Value | Px | Notes |
|------|-------|----|-------|
| xs | 4px | 4 | Extracted spacing token |
| sm | 8px | 8 | Extracted spacing token |
| md | 16px | 16 | Extracted spacing token |
| lg | 24px | 24 | Extracted spacing token |
| xl | 32px | 32 | Extracted spacing token |

## Elevation & Depth

Keep depth flat unless validated shadow or interaction evidence appears in the extraction payload. Do not invent shadows beyond this evidence boundary.

### Shadow Evidence
| Shadow Token | Layers | Details |
|--------------|--------|---------|
| n/a | 0 | No validated shadow payload |

### Interaction Signals
| Theme | Signal | Evidence |
|-------|--------|----------|
| Light | outline-color | rgb(252, 249, 243) |
| Light | outline-width | 3px |
| Light | outline-offset | 0px |

## Shapes

Shape language maps directly to rounded tokens. Keep component corners consistent with the role mapping below before introducing bespoke geometry.

### Radius Roles
| Token | Value | Px | Role Mapping |
|------|-------|----|--------------|
| none | 0px | 0 | Hairline corner |

### Geometry Evidence
| Radius Token | Shape | Units |
|--------------|-------|-------|
| none | 0px | px |

## Components

Components should be recreated from token references first, then tuned with variant notes and probe-backed state guidance.
- **Splash Screen**: Full-viewport CRT-style splash screen with logo, wordmark, version string, progress bar, and copyright footer. Simulates a vintage software boot screen with scanline noise and screen curvature.
- **Progress Bar**: Segmented block-character progress bar styled after DOS/BIOS loading indicators. Rectangular outline with filled block segments, no border-radius.
- **Logo Mark**: Striped rainbow-gradient circular/disc logo mark with horizontal scan lines, evoking classic 1980s OS-era iconography (reminiscent of NeXT/SGI era branding).
- **Wordmark**: Large serif display wordmark 'SHADER' rendered in off-white with subtle chromatic aberration (RGB fringing) to simulate CRT phosphor bleed.
- **Copyright Footer**: Single-line copyright notice at the bottom of the splash screen in a warm amber/green tint, evoking phosphor monochrome terminal text.
- **Version String**: Subtitle text block showing product name and version number, centered below the wordmark.

### Copyright Footer

**Amber Terminal Text**
- fontFamily: STIX Two Text (or monospace fallback)
- fontSize: 14px (estimated)
- textColor: #c8a96e (amber/warm tint — visual estimate, not in CSSOM)
- textAlign: center
- State guidance: Amber color is a visual estimate from screenshot; not confirmed in CSSOM frequency data — possible hallucination. The warm tint is a deliberate retro-terminal styling choice.

### Logo Mark

**Rainbow Stripe Disc**
- shape: circular disc with horizontal stripe gradient
- colors: multi-color horizontal stripes (red, orange, yellow, green, blue, white)
- size: ~80px diameter (estimated)
- effect: chromatic aberration fringing on edges
- State guidance: Visual-only evidence; no CSSOM data for this SVG/canvas element.

### Progress Bar

**Block Segment Bar**
- border: 1px solid #e5e7eb
- rounded: 0px
- fillColor: #fcf9f3 (block segments)
- backgroundColor: #3d3d9e (unfilled portion)
- height: ~32px (estimated from screenshot)
- width: ~40% of viewport width
- State guidance: Rendered as a series of discrete vertical block characters inside a rectangular outline, mimicking DOS-era progress indicators.

### Splash Screen

**Default Boot Splash**
- backgroundColor: #3d3d9e (CRT blue fill)
- rounded: 0px (sharp corners, CRT bezel effect via outer black)
- fontFamily: STIX Two Text
- fontSize: 16px
- textColor: #fcf9f3
- layout: centered column, full viewport height
- State guidance: Probe evidence returned errors for all selectors; values derived from CSSOM frequency data and screenshot visual analysis.

### Version String

**Default**
- fontFamily: STIX Two Text
- fontSize: 16px
- fontWeight: 400
- lineHeight: 24px
- textColor: #fcf9f3
- textAlign: center
- State guidance: Confirmed by CSSOM frequency tuple: STIX Two Text 16px w400 / 24px ls:normal (×70).

### Wordmark

**CRT Display Wordmark**
- fontFamily: STIX Two Text
- fontWeight: 700
- fontSize: ~72px (estimated)
- textColor: #fcf9f3
- effect: chromatic aberration — red/cyan fringe offset
- State guidance: Font confirmed via --font-stix CSS variable. Size estimated from screenshot proportions.

## Do's and Don'ts

Guardrails protect Single-family weight hierarchy, Tight geometric corners without adding unsupported visual claims.

| Do | Don't |
|----|---------|
| Do maintain consistent spacing using the base grid | Don't make unsupported claims about absent visual features |
| Do maintain WCAG AA contrast ratios (4.5:1 for normal text) | Don't mix rounded and sharp corners in the same view |
| Do use the primary color only for the single most important action per screen |  |
| Do verify evidence before writing new design-system guidance |  |

## Responsive Evidence

### Breakpoints
| Name | Width | Key Changes |
|------|-------|-------------|
| Mobile | >= 640px | (min-width: 640px) |
| Tablet | >= 768px | (min-width: 768px) |
| Desktop | >= 1024px | (min-width: 1024px) |
| Desktop | >= 1280px | (min-width: 1280px) |
| Desktop | >= 1536px | (min-width: 1536px) |
| Breakpoint 6 | Unknown | (prefers-color-scheme: dark) |

## Agent Prompt Guide

### Example Component Prompts
- Create Copyright Footer variant that preserves Single-line copyright notice at the bottom of the splash screen in a warm amber/green tint, evoking phosphor monochrome terminal text..
- Create Logo Mark variant that preserves Striped rainbow-gradient circular/disc logo mark with horizontal scan lines, evoking classic 1980s OS-era iconography (reminiscent of NeXT/SGI era branding)..
- Create Progress Bar variant that preserves Segmented block-character progress bar styled after DOS/BIOS loading indicators. Rectangular outline with filled block segments, no border-radius..

### Iteration Guide
1. Start with extracted palette and typography roles only.
2. Map spacing and radius directly from token tables before visual polish.
3. Apply component patterns one section at a time and compare against source intent.
4. Keep elevation claims tied to explicit evidence in output.
5. Iterate with smallest diffs and re-check section hierarchy after each change.

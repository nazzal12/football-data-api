---
name: Pelota Libre +
colors:
  surface: '#131313'
  surface-dim: '#131313'
  surface-bright: '#393939'
  surface-container-lowest: '#0e0e0e'
  surface-container-low: '#1c1b1b'
  surface-container: '#201f1f'
  surface-container-high: '#2a2a2a'
  surface-container-highest: '#353534'
  on-surface: '#e5e2e1'
  on-surface-variant: '#b9ccb5'
  inverse-surface: '#e5e2e1'
  inverse-on-surface: '#313030'
  outline: '#849581'
  outline-variant: '#3b4b3a'
  surface-tint: '#00e55b'
  primary: '#edffe8'
  on-primary: '#003911'
  primary-container: '#00ff66'
  on-primary-container: '#007128'
  inverse-primary: '#006e27'
  secondary: '#c9c6c5'
  on-secondary: '#313030'
  secondary-container: '#474646'
  on-secondary-container: '#b7b4b4'
  tertiary: '#f9fafa'
  on-tertiary: '#2f3131'
  tertiary-container: '#dddddd'
  on-tertiary-container: '#606162'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#6bff83'
  primary-fixed-dim: '#00e55b'
  on-primary-fixed: '#002107'
  on-primary-fixed-variant: '#00531b'
  secondary-fixed: '#e5e2e1'
  secondary-fixed-dim: '#c9c6c5'
  on-secondary-fixed: '#1c1b1b'
  on-secondary-fixed-variant: '#474646'
  tertiary-fixed: '#e2e2e2'
  tertiary-fixed-dim: '#c6c6c7'
  on-tertiary-fixed: '#1a1c1c'
  on-tertiary-fixed-variant: '#454747'
  background: '#131313'
  on-background: '#e5e2e1'
  surface-variant: '#353534'
typography:
  display-lg:
    fontFamily: Archivo Narrow
    fontSize: 48px
    fontWeight: '800'
    lineHeight: '1.1'
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Archivo Narrow
    fontSize: 32px
    fontWeight: '700'
    lineHeight: '1.2'
    letterSpacing: -0.01em
  headline-lg-mobile:
    fontFamily: Archivo Narrow
    fontSize: 24px
    fontWeight: '700'
    lineHeight: '1.2'
  match-score:
    fontFamily: Archivo Narrow
    fontSize: 28px
    fontWeight: '800'
    lineHeight: '1'
    letterSpacing: 0.05em
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.5'
    letterSpacing: '0'
  label-caps:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '500'
    lineHeight: '1'
    letterSpacing: 0.1em
  data-tabular:
    fontFamily: JetBrains Mono
    fontSize: 14px
    fontWeight: '400'
    lineHeight: '1'
spacing:
  unit: 4px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  container-margin: 16px
  gutter: 12px
---

## Brand & Style
The design system is engineered for high-velocity sports data consumption. It prioritizes technical precision and athletic energy, moving away from soft, organic web trends in favor of a "Digital High-Performance" aesthetic. The personality is authoritative, sharp, and instantaneous.

The visual style is **Sharp-Edge Minimalism**. It utilizes raw geometric shapes, high-contrast intersections, and zero-radius corners to evoke a sense of professional timing and data accuracy. Influence is drawn from broadcast sports graphics and technical automotive displays, emphasizing clarity under pressure.

## Colors
The palette is built on a foundation of extreme contrast. The **Electric Green** primary color is used exclusively for actionable elements, live status indicators, and critical brand highlights. 

- **Dark Mode (Default):** Use #050505 for the base canvas. #121212 serves as the primary surface color for cards and containers to create subtle but crisp separation.
- **Light Mode:** Use #FFFFFF for the base canvas and #F5F5F5 for surfaces. High-emphasis text shifts to #050505.
- **Utility:** Use pure White or Black for maximum legibility. Avoid mid-tone greys; instead, use low-opacity versions of the foreground color (e.g., 60% white) to maintain vibrancy.

## Typography
The typographic hierarchy is designed for "glanceability." **Archivo Narrow** provides the aggressive, condensed punch required for sports headlines and scores, allowing for long team names to fit in tight spaces. **Inter** handles standard UI copy for maximum readability. 

**JetBrains Mono** is utilized for technical data points like match minutes, player stats, and timestamps, reinforcing the data-driven nature of this design system. All headers should be uppercase to maintain a broadcast-ready tone.

## Layout & Spacing
This design system uses a strict **4px baseline grid**. Information density is high, favoring condensed spacing to show more data without scrolling. 

- **Grid:** 12-column fluid grid for desktop, 4-column for mobile.
- **Margins:** 16px lateral margins on mobile to maximize the "Match Card" width.
- **Alignment:** Content is strictly aligned to the grid edges. Use 1px borders as dividers rather than whitespace where possible to maintain the "engineered" look.

## Elevation & Depth
Depth is created through **Tonal Layering** and **Sharp Outlines** rather than shadows. 

1. **Base:** The background color (#050505).
2. **Surface:** Surface containers (#121212) sit directly on the base with no shadow.
3. **Stroke:** Every interactive card or container must have a 1px solid border. Use #FFFFFF at 10% opacity for default states and the Primary Electric Green for active/live states.
4. **Active States:** Elements that are "Live" or selected utilize a glow-less solid fill or a high-contrast 2px border.

## Shapes
The shape language is strictly **Geometric and Sharp**. 

- **Corner Radius:** 0px across all elements (Buttons, Cards, Inputs).
- **Accents:** Use 45-degree chamfered corners for "Live" indicators or special tags to add a dynamic, aggressive feel.
- **Icons:** Use sharp-ended, stroke-based icons. Avoid rounded terminals or soft circles.

## Components

### Match Cards
The core unit of the app. Match cards use the Surface color (#121212) with a 1px #222222 border. Team names use `headline-sm`, while scores use the `match-score` token. When a match is live, the left border of the card becomes a 4px solid Electric Green bar.

### Live Score Indicators
A small rectangular tag with a #FF0000 (Live Red) background and White `label-caps` text. It flashes or pulses between 100% and 80% opacity—never uses a blur.

### Tournament Headers
Full-width bars using the Primary color or high-contrast White. Text is `label-caps`. Use a 1px bottom border to separate from the scrollable list of matches.

### Tab Bars
Bottom-anchored, 100% width, #050505 background. Active states are indicated by the Primary color on the icon and a 2px top-border on the active tab item. No background fills for active tabs.

### Buttons
Primary buttons are solid Electric Green with Black `label-caps` text. Secondary buttons are ghost-style (1px White border) with White text. All buttons have 0px radius.

### Input Fields
Dark surfaces (#121212) with a 1px White border (20% opacity). On focus, the border changes to the Primary color. Use `data-tabular` for numerical inputs.
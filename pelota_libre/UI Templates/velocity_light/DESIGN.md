---
name: Velocity Light
colors:
  surface: '#fcf9f8'
  surface-dim: '#dcd9d9'
  surface-bright: '#fcf9f8'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f6f3f2'
  surface-container: '#f0eded'
  surface-container-high: '#eae7e7'
  surface-container-highest: '#e5e2e1'
  on-surface: '#1c1b1b'
  on-surface-variant: '#3b4b3a'
  inverse-surface: '#313030'
  inverse-on-surface: '#f3f0ef'
  outline: '#6b7c68'
  outline-variant: '#b9ccb5'
  surface-tint: '#006e27'
  primary: '#006e27'
  on-primary: '#ffffff'
  primary-container: '#00ff66'
  on-primary-container: '#007128'
  inverse-primary: '#00e55b'
  secondary: '#5e5e5e'
  on-secondary: '#ffffff'
  secondary-container: '#e2e2e2'
  on-secondary-container: '#646464'
  tertiary: '#5d5f5f'
  on-tertiary: '#ffffff'
  tertiary-container: '#dddddd'
  on-tertiary-container: '#606161'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#6bff83'
  primary-fixed-dim: '#00e55b'
  on-primary-fixed: '#002107'
  on-primary-fixed-variant: '#00531b'
  secondary-fixed: '#e2e2e2'
  secondary-fixed-dim: '#c6c6c6'
  on-secondary-fixed: '#1b1b1b'
  on-secondary-fixed-variant: '#474747'
  tertiary-fixed: '#e2e2e2'
  tertiary-fixed-dim: '#c6c6c7'
  on-tertiary-fixed: '#1a1c1c'
  on-tertiary-fixed-variant: '#454747'
  background: '#fcf9f8'
  on-background: '#1c1b1b'
  surface-variant: '#e5e2e1'
typography:
  display-lg:
    fontFamily: Anton
    fontSize: 72px
    fontWeight: '400'
    lineHeight: '1.1'
    letterSpacing: 0.02em
  headline-lg:
    fontFamily: Anton
    fontSize: 48px
    fontWeight: '400'
    lineHeight: '1.2'
    letterSpacing: 0.02em
  headline-lg-mobile:
    fontFamily: Anton
    fontSize: 32px
    fontWeight: '400'
    lineHeight: '1.2'
  headline-md:
    fontFamily: Anton
    fontSize: 24px
    fontWeight: '400'
    lineHeight: '1.2'
  body-lg:
    fontFamily: Archivo Narrow
    fontSize: 18px
    fontWeight: '500'
    lineHeight: '1.5'
  body-md:
    fontFamily: Archivo Narrow
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.5'
  label-sm:
    fontFamily: Archivo Narrow
    fontSize: 12px
    fontWeight: '700'
    lineHeight: '1'
    letterSpacing: 0.1em
spacing:
  base: 4px
  xs: 8px
  sm: 16px
  md: 24px
  lg: 48px
  xl: 80px
  gutter: 16px
  margin-mobile: 16px
  margin-desktop: 32px
---

## Brand & Style

This design system embodies the high-octane energy of modern professional sports and athletic performance. The brand personality is aggressive, precise, and uncompromisingly modern. By utilizing a "High-Contrast / Bold" design style, the UI prioritizes speed of information delivery and an unmistakable visual impact.

The aesthetic is characterized by sharp edges, high-velocity accents, and a "Digital Performance" feel. It targets a competitive audience—athletes, bettors, and enthusiasts—who value performance data and real-time responsiveness. The shift to a light mode maintains this intensity by using stark white surfaces contrasted against razor-sharp black typography and a singular, neon brand signal.

## Colors

The palette is built on a foundation of high-contrast functionalism. 

- **Primary (Electric Green):** Used exclusively for high-priority actions, active states, and critical performance data. It acts as a "go" signal within the interface.
- **Secondary (Solid Black):** Used for primary headings and structural elements to provide a heavy visual anchor.
- **Surface (Off-White/Light Gray):** The background uses `#FFFFFF` for primary content areas and `#F4F4F4` for secondary containers to create subtle depth without losing the "clean" athletic feel.
- **Typography:** Text must remain at `#1A1A1A` or `#000000` to ensure maximum legibility against the light background, maintaining the system's aggressive clarity.

## Typography

Typography is used as a structural element. **Anton** provides a commanding, condensed presence for headlines, mimicking the urgency of stadium scoreboards and sports broadcast graphics. 

**Archivo Narrow** is utilized for body text and data displays. Its condensed nature allows for high information density—crucial for stats and lists—while maintaining excellent readability. All labels should be set in uppercase with increased letter spacing to enhance the technical, "engineered" look of the design system.

## Layout & Spacing

The layout follows a **Fluid Grid** model with high-density spacing. A 12-column grid is used for desktop, scaling down to 4 columns for mobile. 

The spacing rhythm is based on a 4px baseline, but defaults to larger, "breathable" gaps (`24px`+) between major sections to prevent the condensed typography from feeling cluttered. Gutters are kept tight (`16px`) to reinforce the systematic, data-heavy nature of the application. Elements should align to hard edges; avoid centered layouts in favor of strong left-aligned compositions that suggest forward momentum.

## Elevation & Depth

This design system eschews soft shadows in favor of **Bold Borders** and **Tonal Layers**. 

- **Depth through Contrast:** Use `1px` or `2px` solid black borders for cards and containers to create separation. 
- **Stacked Surfaces:** Elevation is indicated by shifting from a white background (`#FFFFFF`) to a light gray surface (`#F4F4F4`).
- **Active State:** Instead of a shadow, an active or elevated element may gain a thick `4px` bottom border in the Primary Electric Green or a hard "drop-block" (a solid black offset rectangle) to simulate a brutalist 3D effect.

## Shapes

The shape language is **Sharp**. Rounded corners are strictly prohibited to maintain a lean, aggressive, and industrial aesthetic. 

Every component—from buttons to input fields to images—must feature 90-degree angles. This geometric rigidity communicates precision and links the UI back to the technical lines found in sports architecture and track markings.

## Components

- **Buttons:** Primary buttons feature a Solid Black background with White text and a sharp 0px radius. On hover, they should flash to the Primary Electric Green. Secondary buttons are outlined in 2px Black.
- **Chips:** Small, rectangular tags with a light gray background (`#E5E5E5`) and bold uppercase labels. Active chips use the Primary Electric Green.
- **Lists:** Data rows separated by thin `1px` horizontal lines. Use alternating row fills (`#F9F9F9`) for high-density stat sheets.
- **Input Fields:** Thick `2px` black bottom-borders only, or full rectangular boxes. Focus states are highlighted by changing the border color to Primary Electric Green.
- **Cards:** White backgrounds with `1px` black borders. Headers within cards should have a solid black background with white Anton typography.
- **Score Indicators:** High-visibility boxes using the Primary Electric Green for "Live" or "Winning" states, ensuring they pop immediately against the neutral base.
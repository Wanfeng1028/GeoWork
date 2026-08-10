---
name: GeoWork Design System
colors:
  surface: '#f7f9fb'
  surface-dim: '#d8dadc'
  surface-bright: '#f7f9fb'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f4f6'
  surface-container: '#eceef0'
  surface-container-high: '#e6e8ea'
  surface-container-highest: '#e0e3e5'
  on-surface: '#191c1e'
  on-surface-variant: '#45464d'
  inverse-surface: '#2d3133'
  inverse-on-surface: '#eff1f3'
  outline: '#76777d'
  outline-variant: '#c6c6cd'
  surface-tint: '#565e74'
  primary: '#000000'
  on-primary: '#ffffff'
  primary-container: '#131b2e'
  on-primary-container: '#7c839b'
  inverse-primary: '#bec6e0'
  secondary: '#006a61'
  on-secondary: '#ffffff'
  secondary-container: '#86f2e4'
  on-secondary-container: '#006f66'
  tertiary: '#000000'
  on-tertiary: '#ffffff'
  tertiary-container: '#00210b'
  on-tertiary-container: '#49935c'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dae2fd'
  primary-fixed-dim: '#bec6e0'
  on-primary-fixed: '#131b2e'
  on-primary-fixed-variant: '#3f465c'
  secondary-fixed: '#89f5e7'
  secondary-fixed-dim: '#6bd8cb'
  on-secondary-fixed: '#00201d'
  on-secondary-fixed-variant: '#005049'
  tertiary-fixed: '#a6f4b5'
  tertiary-fixed-dim: '#8bd79b'
  on-tertiary-fixed: '#00210b'
  on-tertiary-fixed-variant: '#005226'
  background: '#f7f9fb'
  on-background: '#191c1e'
  surface-variant: '#e0e3e5'
typography:
  display-lg:
    fontFamily: Inter
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.01em
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  headline-md:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-sm:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-caps:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.05em
  data-mono:
    fontFamily: JetBrains Mono
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  base: 4px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  2xl: 48px
  3xl: 64px
  gutter: 20px
  margin-mobile: 16px
  margin-desktop: 32px
---

## Brand & Style
The design system is engineered for high-stakes professional environments where geospatial precision meets executive productivity. The brand personality is **modern, reliable, and efficient**, projecting a "tech-forward" authority that feels both innovative and grounded.

The visual direction follows a **Modern Minimalist** aesthetic. It prioritizes clarity over decoration, using ample white space to reduce cognitive load during complex data analysis. The UI is characterized by flat surfaces, crisp functional borders, and a rigorous adherence to a systematic grid, ensuring that the interface remains unobtrusive and allows the user's data to take center stage.

## Colors
This design system utilizes a sophisticated, high-contrast palette designed for professional endurance.

- **Primary (Deep Navy):** Used for core navigation, high-level headers, and primary text to establish a foundation of reliability.
- **Secondary (Professional Teal):** Reserved for primary actions, active states, and data highlights. It provides a technical, precise energy.
- **Tertiary/Accent (Earth Green):** Used strategically for "status: success" indicators, environmental data layers, and positive growth metrics.
- **Neutral:** A range of cool grays and slates provide the structural backdrop, ensuring the UI feels expansive and clean.

Color is used functionally: if an element is colored, it is either interactive or conveying specific data status.

## Typography
Typography is the primary vehicle for information hierarchy in this design system. **Inter** is the workhorse font, chosen for its exceptional legibility in both large displays and dense UI clusters.

A secondary typeface, **JetBrains Mono**, is introduced for technical labels and coordinate data to provide a distinct "geospatial/developer" feel that differentiates raw data from interface instructions. 

- **Headlines:** Should be tight and bold to create clear section anchoring.
- **Body:** Uses a generous line height to ensure readability during long research sessions.
- **Labels:** Small-caps mono-spacing is used for metadata, timestamps, and coordinates to evoke a sense of technical precision.

## Layout & Spacing
The design system employs a **Fluid-Fixed Hybrid Grid**. For productivity dashboards, the sidebar is a fixed width (280px) while the main content area (map or data table) is fluid.

- **Desktop:** 12-column grid with 20px gutters. Content is often contained in "Panels" that snap to grid intervals.
- **Mobile:** 4-column grid with 16px margins. Complex data tables should reflow into card stacks or horizontal scrolling modules.
- **Spacing Rhythm:** Based on a 4px baseline. Most UI elements use 16px (md) or 24px (lg) padding to maintain a professional, airy feel. 

Layouts should prioritize vertical stacking for tools and horizontal expansion for data visualization.

## Elevation & Depth
In line with the flat minimalist style, this design system avoids heavy shadows. Depth is communicated through **Tonal Layering** and **Low-Contrast Outlines**.

- **Level 0 (Background):** The base canvas, usually the lightest neutral or the map itself.
- **Level 1 (Panels/Cards):** Defined by a 1px solid border (`#E2E8F0`). No shadow.
- **Level 2 (Dropdowns/Modals):** A very subtle, "soft" shadow is permitted here to differentiate the overlay from the workspace (e.g., `0 4px 12px rgba(0,0,0,0.05)`).
- **Active States:** Indicated by a 2px Teal border or a subtle background tint, never by increasing "height" or shadow depth.

## Shapes
The shape language is **Soft** but disciplined. 

- **Components:** Standard buttons and input fields use a `0.25rem` (4px) radius. This provides just enough softness to feel modern without losing the professional, "engineered" edge required for a productivity tool.
- **Containers:** Large dashboard panels or map overlays use `0.5rem` (8px) to frame the content.
- **Icons:** Should follow a geometric, 2px stroke weight with slight rounding to match the component corners.

## Components
Consistent component behavior ensures the system remains "efficient" for the power user.

- **Buttons:**
    - *Primary:* Solid Deep Navy with white text. High-contrast.
    - *Secondary:* Ghost style with 1px Teal border and Teal text.
    - *Action:* Professional Teal background for "Submit" or "Create" actions.
- **Input Fields:** Flat, white backgrounds with `#E2E8F0` borders. On focus, the border transitions to Professional Teal with a subtle 1px glow.
- **Chips:** Small, rectangular with `body-sm` font. Used for filtering map layers or tagging locations. Earth Green background for "Active" layers.
- **Cards:** Used for location details or property data. Borders only, no shadows. Header text in `label-caps`.
- **Data Tables:** High-density, using `body-sm` or `data-mono`. Zebra striping is used sparingly; 1px horizontal dividers are preferred.
- **Map Controls:** Floating icon buttons (24x24px icons) in square containers with 4px roundedness, positioned in the top-right of the viewport.
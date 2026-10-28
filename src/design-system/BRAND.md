# Vettri HRMS Brand Identity

Quick reference for the public-facing brand. The in-app product design system
lives in `tokens.css`; this file documents how those same tokens extend into
marketing surfaces (landing page, careers pages, favicon).

## Logo

`src/components/brand/Logo.jsx` is the single source of truth - never hardcode
an ad-hoc badge again. The mark combines a blue V, orange growth sweep, and
people motif from the official Vettri HRMS identity.

- `<Logo />` - full lockup (mark + wordmark), color, for light backgrounds.
- `<Logo tone="onDark" />` - for the indigo gradient hero / login panel.
- `<Logo variant="mark" size={32} />` - icon-only, e.g. sidebar, favicon.
- `<Logo tagline="Careers" />` - wordmark with a small suffix label.

Static exports for places that can't render React: `public/favicon.svg`,
`public/logo-mark-white.svg`.

## Color

Brand colors are defined once in `styles/tokens.css` and reused everywhere.
Component CSS references the `--hz-*` role tokens, never raw hex.

| Role | Token | Hex | Use |
|---|---|---|---|
| Midnight Navy | `--vettri-navy` | `#10172A` | Active nav item, dashboard hero, brand moments |
| Deep Indigo | `--hz-primary-800` | `#1B2850` | Second stop of the navy gradient |
| Signature Blue | `--hz-primary-500` | `#4169E1` | Primary buttons, focus ring, data accents |
| Strong Blue | `--hz-primary-600` | `#3457C9` | Links and blue text on tinted surfaces |
| Electric Indigo | `--hz-accent-500` | `#6558F5` | Sparing secondary accent |
| Soft Blue Tint | `--hz-primary-50` | `#EEF3FF` | Selected/hover tints |
| Canvas | `--hz-bg-canvas` | `#F6F8FC` | Page background |
| Surface | `--hz-bg-surface` | `#FFFFFF` | Cards, panels, tables |
| Ink | `--hz-text-primary` | `#172033` | Body text |
| Secondary text | `--hz-text-secondary` | `#667085` | Supporting copy (4.97:1) |
| Border | `--hz-border` | `#E5EAF2` | Hairlines |
| Golden accent | static mark accent | `#FFB000` | Logo mark only |

Semantic colours come in steps: `-500` is the fill or icon colour, `-700` is
the text colour on the matching `-50` tint (every pair clears 4.5:1). Warning
amber `#B7791F` is only 3.6:1 on white, so never use it for body text.

| Meaning | Fill (`-500`) | Text on tint (`-700`) |
|---|---|---|
| Success | `#16876A` | `#0E5E4A` |
| Warning | `#B7791F` | `#8A5A12` |
| Error | `#D14343` | `#9E2C2C` |
| Info | `#3478D4` | `#24569C` |

Charts and per-category fills computed in JS use `CATEGORICAL_COLORS` from
`design-system/palette.js` (each at least 3:1 on white).

The navy gradient (`--hz-gradient-accent`) is reserved for one focal surface
per screen, such as the dashboard hero. Everywhere else stays on quiet neutral
surfaces so the brand moment keeps its impact. Status is never conveyed by
colour alone; badges always carry a text label.

## Typography

- **Display** (`--hz-font-display`, defined in `landing.css`): *Space
  Grotesk* - used only for large marketing headlines (hero, section titles).
  Chosen for a technical, structured character that fits a workforce
  platform without tipping into a generic "startup" look.
- **Body / UI** (`--hz-font-sans`): *Manrope* - every paragraph, label, nav
  item, and the entire authenticated product.

Both are loaded via the `@import` at the top of `landing.css`. If the app
later adds a build-time font pipeline, swap that `@import` for self-hosted
files - nothing else needs to change.

## Iconography

Lucide icons only (`lucide-react`), 1.5-2px stroke, no filled icons. This
keeps the marketing site visually identical to the authenticated product
instead of importing a second icon set just for marketing pages.

## Voice

Direct, specific, no hype adjectives ("revolutionary", "game-changing").
Describe what the product does for the person using it, the same register
already established on the login screen's brand panel.

# ShiftGuard: refactor the stylesheet into a token-based design system

## Goal
Turn the uploaded `style.css` (1,731 lines, about 40 hardcoded hex values, around 15 one-off font sizes like 10.5/11.5/12.5/14.5px, and spacing values with no pattern) into a clean `src/styles/global.css`. Every color, spacing value, border, radius, shadow and type style should come from CSS variables, and Tailwind v4 should read those same variables. The user changes the look by editing tokens, not components.

## What exists
- `src/index.css` contains only `@import 'tailwindcss';`. There is no `src/styles/` folder yet.
- The uploaded CSS defines a warm palette (paper, espresso, sage, amber, red, blue) and three typefaces: Inter (sans), Fraunces (serif), JetBrains Mono (mono). These are the only typefaces allowed.
- The selected Astra kit (`@figma/astraui`) is installed. The ShiftGuard tokens take priority over Astra's.

## File structure
1. `src/styles/global.css` is the single source of truth, with these sections in order:
   1. Google Fonts `@import` for Inter (400/500/600/700), Fraunces (600/700), and JetBrains Mono (500/600/700). It goes first, before Tailwind.
   2. `@import 'tailwindcss';`
   3. **Primitive tokens** (`:root`): raw color ramps such as `--espresso-50…900`, `--sage-*`, `--amber-*`, `--red-*`, `--blue-*`, `--paper-*`, and `--charcoal-*`. All current hexes are folded into these ramps, including the stray text colors (#8A5B14, #3E5237, #7D2821, #6E470B, #FEF3C7, #FDE68A, and others).
   4. **Semantic tokens** (`:root`), built only from primitives:
      - Surfaces: `--color-surface-page/card/raised/sunken/inverse`
      - Text: `--color-text-primary/secondary/muted/inverse/link`
      - Border: `--color-border-default/strong/focus`
      - Status triads (`-bg`, `-fg`, `-border`) for: `danger`, `warning`, `success`, `info`, `neutral`
      - Domain aliases mapped to the triads: severity (critical/warning/info), evidence (contradicted/unverified/review/supported), workflow (open/resolved), and highlight (quote span default/hover/active)
   5. **Scale tokens**:
      - Spacing: a 4px base (`--space-0_5` = 2px, `--space-1` = 4px, then 6, 8, 10, 12, 16, 20, 24, 32, 40)
      - Radius: `xs` 4, `sm` 6, `md` 10, `lg` 14, `full`
      - Border widths: `--border-width-thin` 1px, `-accent` 3px, `-rail` 4px
      - Shadows: `subtle`, `card`, `focus-ring`, `selected`
      - Motion: `--duration-fast` 150ms and an easing token
      - Layout: rail 250px, drawer 390px, topbar height
   6. **Typography tokens**:
      - Families: `--font-sans`, `--font-serif`, `--font-mono`
      - A fixed size scale that replaces the half-pixel sizes: `2xs` 10, `xs` 11, `sm` 12, `base` 13, `md` 14, `lg` 16, `xl` 18, `2xl` 22
      - Weights and line heights, and tracking for eyebrow labels
      - Composite role classes: `.text-display`, `.text-title`, `.text-heading`, `.text-body`, `.text-caption`, `.text-eyebrow`, `.text-data` (mono). Serif is used for titles, mono for codes, IDs and numbers, and sans for everything else.
   7. `@theme inline` maps the semantic tokens to Tailwind (`--color-*`, `--spacing`, `--radius-*`, `--font-*`, `--text-*`, `--shadow-*`). This makes utilities like `bg-surface-card`, `text-danger-fg`, `rounded-md`, and `font-serif` resolve to the variables. Tailwind's default color palette is cleared (`--color-*: initial`) so off-system colors can't be used.
   8. `@layer base`: reset, body defaults, `:focus-visible` ring using the focus token, a `prefers-reduced-motion` rule, `.sr-only`, and form elements inheriting the font.
   9. `@layer components`: the existing class names are kept (`.btn`, `.finding-row`, `.badge-*`, `.topbar`, and so on) so the markup contract from the brief stays the same. They are rewritten to use only tokens, and duplicates are merged. For example, `.panel` is a base class shared by report-panel, carryover-panel and telemetry-box, and the badge/status variants use `[data-tone]` or modifier classes backed by the status triads. Missing states are added: hover, focus-visible, disabled, and `aria-pressed` / `.active`.
   10. Responsive rules (breakpoints at 1200px and 768px, which is new: on mobile the rail collapses and everything stacks) and a print stylesheet that uses tokens and `--print-*` overrides.
2. `src/index.css` becomes `@import './styles/global.css';`, so it stays the entry point that `main.tsx` already loads.

## Rules for all generated UI
- No raw hex, rgb or px values in components. Only tokens, the Tailwind utilities mapped to them, or the component classes.
- Only the three defined font families are used.
- A token header comment in `global.css` documents which layer to edit (primitives for the brand, semantics for meaning).

## Verification
- Search `global.css` to confirm hex values appear only in the primitive block.
- Check that the dev preview renders a token swatch, the type scale, and the button and badge variants from the existing `App.tsx` (or a temporary check). `App.tsx` is not otherwise changed in this step.
- Change one primitive (for example the espresso ramp) and confirm the change shows up everywhere.

## Out of scope
- Building ShiftGuard screens. That comes next and will use this system.
- Dark mode. The semantic layer is set up so it can be added later with a `[data-theme="dark"]` block.

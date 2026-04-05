---
description: "Use when creating or editing app UI in Tailwind for CJ NET. Supports stronger visual design, reusable palette-safe variants, and mobile-first operational flows."
name: "Tailwind Brand Components"
applyTo: "src/app/**/*.{tsx,css}"
---
# Tailwind Brand Component Rules

Use these rules for all visual UI work in app routes and admin screens.

## Core Palette
- Brand yellow: `#F4D400`
- Brand red: `#E53935`
- Warm canvas: `#F5F1E8`
- Card surface: `rgba(255,255,255,0.9)`
- Muted panel: `rgba(255,248,230,0.72)`
- Text primary: `#171717`
- Text secondary: `#5F5B52`

## Design Direction
- Build interfaces that feel deliberate and modern, but more like a utility tool than a SaaS product.
- Keep the palette controlled: mostly warm neutrals, with yellow for direction and red for risk.
- Prefer quiet surfaces and precise spacing over decorative styling.
- Mobile-first for customer flows, high-scannability for staff flows.
- Default to less framing: fewer cards, fewer badges, smaller headings.
- For simple chooser screens, prefer equal-weight actions unless product intent explicitly requires prioritization.

## Color Rules
- Never flood the whole page with yellow or red.
- Yellow is for primary actions, active state cues, progress emphasis, and highlights.
- Red is only for danger, cancellation, or urgent exceptions.
- Use neutrals for the majority of layout, cards, and text.

## Typography
- Prefer the repo display/body font pairing when available.
- Use a stronger display style for page titles and hero copy.
- Keep support text compact and calm.

## Component Patterns
- Primary button: yellow gradient or solid yellow, dark text, rounded-2xl, confident weight, visible hover/focus.
- Secondary button: bright neutral surface, subtle border, same radius and sizing as primary.
- Ghost button: dashed or muted panel treatment for optional actions.
- Cards: layered neutral surfaces with soft shadows, rounded-2xl or rounded-3xl.
- Status pills: small uppercase labels or compact badges that communicate state quickly.
- Stats: large numbers with low-noise framing and clear labels.
- Customer-facing labels should describe the task, not the transport technology.

## Layout And Spacing
- Follow an 8px-based spacing rhythm.
- Start with stacked mobile sections, then expand to split panes on larger screens.
- Each page must have one obvious primary action and a clean secondary path.
- Avoid squeezing too many equally weighted boxes into the first screen.
- If the page can work as one simple column, prefer that over a hero-plus-sidebar layout.

## Variation Generation
- When asked for “variations”, produce 3 distinct but palette-safe directions.
- Variation examples:
  - `Signal Desk`: sharper operational dashboard, stronger contrast, denser information blocks.
  - `Warm Studio`: softer glass cards, warmer surfaces, more welcoming customer-facing pages.
  - `Bold Queue`: oversized typography, high-emphasis progress states, editorial hero treatment.
- Keep IA and product rules stable while changing typography, surface treatment, density, and emphasis.

## Accessibility
- Meet WCAG AA contrast for text and controls.
- Keep touch targets comfortable on phones.
- Preserve visible focus states and state feedback.

## Implementation Notes
- Reuse shared CSS classes/tokens from `src/app/globals.css` before inventing per-page one-offs.
- Avoid unnecessary dependencies and avoid “AI slop” gradients or neon effects.
- Favor clarity over novelty for print-task workflows.

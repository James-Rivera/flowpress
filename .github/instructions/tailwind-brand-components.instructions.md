---
description: "Use when creating or editing app UI in Tailwind for buttons, cards, alerts, badges, hierarchy, and mobile-first spacing with CJ NET brand colors."
name: "Tailwind Brand Components"
applyTo: "src/app/**/*.{tsx,css}"
---
# Tailwind Brand Component Rules

Use these rules for all visual UI work in app routes and admin screens.

## Tokens
- Yellow primary: `#F4D400`
- Red accent: `#E53935`
- App bg: `#F7F7F8`
- Card bg: `#FFFFFF`
- Border: `#E5E7EB`
- Text primary: `#111827`
- Text secondary: `#6B7280`

## Color Usage
- Keep the UI neutral-first (white and gray surfaces).
- Use yellow only for primary buttons, active states, and directional highlights.
- Do not use yellow as a full-page background.
- Use red only for danger, warnings, and destructive actions.

## Component Patterns
- Primary button: yellow fill, dark text, rounded-xl, bold label, strong focus ring.
- Secondary button: white/neutral background with border, rounded-xl.
- Cards: white background, subtle shadow, rounded-xl, clear padding.
- Important status chips: neutral by default, red only for critical states.

## Layout And Spacing
- Mobile-first first pass before desktop polish.
- Follow 8px spacing scale (`p-2`, `p-4`, `p-6`, `gap-2`, `gap-4`, `gap-6`).
- Keep each screen visually simple with one clear primary action.

## Accessibility
- Meet WCAG AA contrast for text and controls.
- Keep interactive elements easy to tap on mobile.
- Preserve visible focus states.

## Implementation Notes
- Reuse existing Tailwind patterns in the codebase when possible.
- Avoid unnecessary dependencies and visual effects.
- Favor clarity over novelty for print-task workflows.

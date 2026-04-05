---
description: "Use when designing or implementing CJ NET UI/UX for customer upload and staff printing operations in a real-world, fast-paced shop environment."
name: "CJ NET Operations Context"
applyTo: "src/app/**/*.tsx"
---
# CJ NET Operational UX Context

Design and build this system as a real internal tool for a physical printing shop, not a generic app.

## Environment
- Walk-in customers and active queues are normal.
- Staff work under time pressure.
- Mistakes cost money and materials.

## User Priorities
- Customers: often phone-first and not tech-savvy; keep interactions simple.
- Staff: primary operational user; prioritize speed, clarity, and correctness.

## Workflow Rules
- Customer sends file via Messenger or upload.
- Job appears in dashboard queue.
- Staff selects next job, prints, and manually confirms completion.

## Critical Constraints
- Never trigger printing automatically.
- Require clear manual confirmation for print state transitions.
- Prioritize the current actionable task.

## UX Principles
- Speed over aesthetics.
- Clarity over complexity.
- Minimal steps and obvious actions.
- Strong visual hierarchy with low cognitive load.
- Design can feel premium, but operational clarity must still win every time.
- Treat the product like a real-world utility app, not a SaaS dashboard.
- Remove wording or visuals that make the tool feel technical, formal, or intimidating for walk-in customers.

## Device Context
- Staff interfaces should optimize for desktop/laptop scanning and fast actions.
- Customer interfaces should optimize for mobile simplicity and clear guidance.

## Visual Direction
- Professional and calm, not generic SaaS and not a marketing page.
- Neutral-first UI with controlled brand accents.
- Use the yellow/red palette as signal, not wallpaper.
- Customer screens should feel welcoming and easy.
- Staff screens should feel decisive, scan-friendly, and fast.
- Prefer plain, direct headings over branded hero copy.
- Prefer one main task container over multiple decorative panels when possible.

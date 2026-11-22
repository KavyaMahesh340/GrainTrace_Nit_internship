# GRAINTRACE — Design System

## Design thesis

The interface should feel like an industrial instrument with editorial discipline: precise, dense where necessary, spacious where meaning demands it, and always accountable. Every screen should make the material journey legible and every number look like evidence.

The core concept is **MATERIAL JOURNEY**. The signature visualization is **BATCH DNA**, which will eventually connect raw material sources, production steps, finished goods, and delivery.

## Color tokens

| Token | Hex | Use |
| --- | --- | --- |
| Obsidian | `#171A18` | Primary dark surface, primary text on paper, masthead. |
| Paper | `#F2F1EB` | Primary light surface, text on dark. |
| Signal Lime | `#C8F169` | Active state, primary action, emphasis, key chart series. |
| Machine Grey | `#888E87` | Secondary metadata, inactive states, chart axes. |
| Alert Rust | `#C65D40` | Exceptions, critical stock, threshold references. |
| Pale Sage | `#DADFD4` | Passive chart series, subtle dividers, neutral fills. |
| Deep Forest | `#243D31` | Stable state, dark accent surface, focus ring. |

Rules:

- Use light and dark surfaces intentionally, not as decoration.
- Signal Lime is functional emphasis; it must not become a general background.
- Alert Rust is reserved for risk and exception states.
- Machine Grey is for supporting data, never primary body copy.
- Avoid generated gradients and glass effects.

Primary shadcn-compatible HSL tokens are defined in `src/app/globals.css` and mapped in `tailwind.config.ts`.

## Typography

- Primary UI: local Geist Sans variable font.
- Technical data: local Geist Mono variable font.
- Monospaced treatment is required for batch codes, order references, timestamps, quantities, currency, chart labels, and status metadata.
- Body text prefers `text-sm`/`text-xs` with generous line height for operational density.
- Display headings use tight tracking (`tracking-tightest`) and close leading for editorial force.
- Technical labels use uppercase monospaced type with wide tracking.

### Type roles

| Role | Treatment |
| --- | --- |
| Page hero | `text-[clamp(2.75rem,7.4vw,7rem)]`, semibold, `leading-[0.88]`, `tracking-tightest` |
| Section heading | `text-2xl` to `text-4xl`, semibold, tight tracking |
| Body copy | `text-sm`, `leading-7`, reduced opacity |
| Technical label | `.mono-label`: mono, 10px, uppercase, wide tracking |
| Data value | mono with `tabular` class |
| Reference code | mono, usually Signal Lime on dark surfaces |

## Layout principles

- Use editorial asymmetry: a dominant narrative column paired with a narrower context column.
- Use hairline borders instead of heavy containers.
- Use varied section structures instead of repeating cards.
- Keep corners sharp or slightly rounded (`0.14rem` to `0.3rem`).
- Use purposeful whitespace between sections; keep alignment within sections exact.
- Horizontal scrolling is acceptable for the eleven-stage flow rail because the journey is a continuous sequence.
- At mobile widths, stacked sections preserve hierarchy and avoid truncated critical data.

## Surface patterns

| Pattern | Surfaces | Purpose |
| --- | --- | --- |
| Hero | Paper with faint engineering grid | Establish identity and operational context. |
| Chart split | Paper with vertical hairline | Pair narrative with production evidence. |
| Flow rail | Paper | Show the continuous journey as a physical path. |
| Data table | Paper with horizontal rules | Present orders without card chrome. |
| Meter list | Paper with stacked rules | Show stock cover as a measurable condition. |
| Exception ledger | Obsidian | Separate interruptions from routine flow. |
| Action band | Signal Lime | Force a single clear next action. |
| Timeline | Paper with vertical rule | Present chronology as a ledger. |
| Batch DNA | Deep Forest | Mark the signature trace visualization. |
| Dark header/footer | Obsidian | Frame the product like an operating console. |

## Motion

- Motion must explain state or continuity; it must not decorate.
- `Reveal` uses a short opacity/vertical translation as sections enter the viewport.
- Batch DNA line draw communicates progressive linkage.
- Micro-interactions are limited to color, border, and small arrow movement.
- All motion respects `prefers-reduced-motion`.
- No looping ambient animation, parallax, floating elements, or fake live indicators.

## Component conventions

### Button

Variants: `default` (Signal Lime), `dark`, `outline`, `light`, `ghost`.
Sizes: `default`, `sm`, `lg`, `icon`.
All actions must navigate to a real route or perform a real state change.

### Badge

Used only for compact status or mode labels. Preview mode always uses the explicit **Preview data** badge.

### Sheet

Radix Dialog-based mobile navigation with a dark surface, clear title/description, and a functioning close control.

### Empty state

Used for future modules and not-found routes. It states that the workflow is planned, names the phase, and offers a real navigation action.

### Skeleton

Used in `loading.tsx` with section-specific shapes rather than a generic card grid.

### Error state

Provides retry via the Next.js error boundary `reset` function and a real route back to the overview.

## Factory overview composition

The overview must include, in order:

1. Editorial factory heading with operational date, shift, and snapshot time.
2. Production pulse with planned and actual preview series.
3. Material flow across all eleven journey stages.
4. Orders awaiting action as a table with references preserved in URLs.
5. Stock risk as days-cover meters.
6. Production exceptions on a dark ledger surface.
7. Prominent action band tied to the highest-priority preview order.
8. Recent activity as a chronological ledger.
9. Batch DNA signature strand.

The composition deliberately avoids a sidebar plus KPI-card template. Data is presented as a working surface: rules, rails, ledgers, banding, and measured intervals.

## Accessibility

- Maintain visible focus rings; dark surfaces use Signal Lime.
- Use semantic tables, lists, times, and landmarks.
- Provide text alternatives for status dots and meters through `aria-label`.
- Do not rely on color alone: every state also has a text label.
- Respect reduced-motion preferences.
- Ensure body and secondary text do not rely on low-contrast machine grey for critical information.

## Anti-patterns

Do not introduce:

- Generic sidebar plus KPI card dashboards.
- Excessive rounded cards or soft shadows.
- Purple gradients or glassmorphism.
- Random floating shapes.
- Emoji.
- Decorative charts without meaning.
- Fake AI insights or fake live states.
- Unnecessary animation.
- Dead buttons or placeholder links.
- Unlabeled preview data presented as real production data.

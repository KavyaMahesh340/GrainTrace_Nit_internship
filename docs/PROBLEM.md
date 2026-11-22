# GRAINTRACE — Source Brief

> The workspace did not contain `docs/PROBLEM.md` when work began. Per explicit instruction, the user supplied this brief in conversation and directed that it be treated as the source of truth. This file preserves that brief for the project record.

---

# GRAINTRACE — PHASE 1: FOUNDATION & DESIGN SYSTEM

Act as a senior software architect, senior frontend engineer, product designer, and technical mentor. We are building GRAINTRACE from scratch for an internship evaluation. The project must demonstrate exceptional engineering, thoughtful UX, accurate manufacturing workflows, and an unforgettable UI.

## 1. Begin by understanding the project

- Read `docs/PROBLEM.md` completely.
- Treat it as the source of truth.
- Do not invent requirements.
- Create `docs/REQUIREMENTS.md` with every functional requirement, role, workflow, business rule, calculation, report, and benchmark requirement.
- Create `docs/IMPLEMENTATION_PLAN.md`.
- Create `docs/ARCHITECTURE.md`.
- Create `docs/DESIGN_SYSTEM.md`.

## 2. Fixed stack

- Next.js 14 App Router
- TypeScript
- Tailwind CSS
- shadcn/ui
- Framer Motion
- Recharts
- SQLite
- Drizzle ORM
- Zod validation
- Vitest
- ExcelJS
- @react-pdf/renderer
- PWA support with IndexedDB offline queue

Do not change the stack without a compelling technical reason.

## 3. Product identity

Product: GRAINTRACE

Tagline: Every packet produced. Every gram accounted for.

This is a manufacturing intelligence system for small food manufacturers. The interface must feel like a combination of industrial operations software, editorial design, material science, and financial precision.

Do not create a generic SaaS admin dashboard.

## 4. Visual system

Colors:
- Obsidian: #171A18
- Paper: #F2F1EB
- Signal Lime: #C8F169
- Machine Grey: #888E87
- Alert Rust: #C65D40
- Pale Sage: #DADFD4
- Deep Forest: #243D31

Typography:
- Geist or Inter for primary UI.
- Monospaced typography for batch codes, technical data, numbers, and timestamps.

Design principles:
- Strong typographic hierarchy.
- Editorial asymmetry.
- Purposeful whitespace.
- Precise alignment.
- Restrained borders.
- Sharp or slightly rounded corners, not excessively rounded.
- Light and dark surfaces used intentionally.
- Manufacturing-inspired visualizations.
- Meaningful motion.
- Responsive layouts.
- Accessible contrast.

Avoid:
- Generic sidebar + KPI card dashboard templates.
- Excessive rounded cards.
- Purple gradients.
- Glassmorphism.
- Random floating shapes.
- Emoji.
- Decorative charts with meaningless data.
- Excessive shadows.
- Unnecessary animations.
- Fake AI insights.

## 5. Design concept

Build the product around the concept of MATERIAL JOURNEY.

The system tracks:

SALESMAN ORDER → APPROVAL → PURCHASE → RAW MATERIAL INVENTORY → RECIPE → PRODUCTION → FINISHED GOODS → INVOICE → DISPATCH → COLLECTION → AUDIT.

Design a signature visualization named BATCH DNA. It will eventually trace a batch from raw material sources through production to finished goods and delivery.

The product must visually communicate that every quantity and transaction is accountable.

## 6. Phase 1 implementation

Only implement the foundation:

- Initialize the Next.js project.
- Install and configure dependencies.
- Set up Tailwind, shadcn, typography and design tokens.
- Set up Framer Motion.
- Set up SQLite and Drizzle with a basic migration workflow.
- Create the initial application shell.
- Create the factory overview page.
- Create responsive navigation.
- Add meaningful loading, empty, and error states.
- Add a clear route structure for future modules.
- Use clearly labeled preview data only.
- Create reusable components.
- Set up Git and `.gitignore`.
- Create README with exact setup instructions.

Do not implement all business workflows yet.

## 7. Factory overview UI

The initial page must be visually distinctive and must not resemble a template.

Explore a composition containing:
- Editorial factory heading.
- Operational date and shift context.
- Production pulse visualization.
- Material flow.
- Orders awaiting action.
- Stock risk.
- Production exceptions.
- Recent activity.
- A prominent action area.

Use varied layouts instead of repeating cards.

The overview must feel like a real factory operating system, not a marketing website.

## 8. Quality requirements

- No fake interactions.
- No dead buttons.
- No placeholder links.
- No TypeScript errors.
- No console errors.
- No unnecessary dependencies.
- Test responsive behavior at 375px, 768px, 1024px, and 1440px.
- Build must succeed.
- Document any unfinished item honestly.

## 9. Git

Initialize Git if not already initialized.

Create a checkpoint commit for the foundation.

Never delete the entire project, overwrite user work, or run destructive cleanup commands without permission.

## 10. Final response

Report:
1. What was built.
2. Folder structure.
3. Design decisions.
4. Commands to run.
5. Build/test results.
6. Known limitations.
7. Files created.
8. The exact next phase.

Stop after Phase 1. Do not continue automatically.

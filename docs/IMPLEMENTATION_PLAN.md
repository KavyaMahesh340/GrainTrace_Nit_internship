# GRAINTRACE — Implementation Plan

## Planning principle

The plan follows the source brief strictly. Business formulas, report definitions, role permissions, and benchmark numbers were not supplied, so they are treated as discovery inputs for the phase that needs them rather than invented during Phase 1.

## Phase 1 — Foundation and design system (current)

**Goal:** establish a production-quality shell, visual language, tooling, and honest route structure without implementing workflows.

Delivered:

1. Next.js 14 App Router project pinned to a patched 14.2.x release.
2. Fixed dependency set installed and configured.
3. Tailwind tokens, Geist typography, shadcn/ui component conventions, and reusable primitives.
4. Framer Motion with reduced-motion support and restrained, meaningful animation.
5. SQLite plus Drizzle schema, generated migration, migration runner, and workflow scripts.
6. Zod-validated preview snapshot used by the UI.
7. Application shell with responsive masthead, desktop navigation, and mobile sheet navigation.
8. Factory overview composed from varied editorial and industrial layouts.
9. Loading, empty, error, not-found, and offline states.
10. Explicit route structure for all eleven journey stages plus Batch DNA.
11. PWA manifest, service worker shell cache, and native IndexedDB mutation queue.
12. Vitest suite covering formatting, preview validation, offline queue, and an empty state.
13. Git repository, ignore rules, and setup documentation.

**Exit criteria:** typecheck, lint, tests, and production build pass; responsive review completed at 375px, 768px, 1024px, and 1440px; limitations documented.

## Exact next phase

**Phase 2 — Domain foundation and order-to-purchase workflows.**

Scope:

1. Run a requirements discovery session to capture the missing business rules: approval conditions, purchase rules, units, tolerance definitions, role permissions, and numbering formats.
2. Expand the Drizzle schema into a normalized material-journey domain with an append-only transaction/quantity ledger that enforces the accountability principle.
3. Add Zod schemas and typed service functions for orders, approvals, purchase orders, suppliers, and raw-material receipts.
4. Implement the first four journey stages as real workflows: salesman order, approval, purchase, and raw material inventory.
5. Replace the relevant preview sections on the factory overview with repository-backed data and explicit loading/error behavior.
6. Add integration tests for quantity conservation, state transitions, and authorization once rules are supplied.
7. Keep Batch DNA, production, finance, dispatch, collection, and audit as clearly labeled future modules until their phases.

**Phase 2 does not begin automatically after Phase 1.**

## Phase 3 — Recipe, production, and finished goods

Planned scope:

- Recipe versions and ingredient ratios.
- Production batches, input weighing, output recording, and exceptions.
- Finished-goods packets and lot linkage.
- Physical Batch DNA trace across raw material, production, and finished goods.
- Manufacturing calculation tests once formulas are supplied.

## Phase 4 — Invoice, dispatch, collection, and audit

Planned scope:

- Invoice generation and collection tracking.
- Dispatch challans and delivery confirmation.
- Append-only audit events across every state change.
- Reconciliation views that prove quantity and transaction accountability.

## Phase 5 — Reports, exports, and offline synchronization

Planned scope:

- ExcelJS-based operational exports.
- `@react-pdf/renderer` document generation.
- Report definitions supplied by the product owner.
- Offline queue synchronization with conflict handling and retry states.
- Accessibility and performance audits against supplied benchmarks.

## Dependency policy

The fixed stack must not change without a compelling technical reason. Any change must be recorded in `docs/ARCHITECTURE.md` with the reason, alternatives considered, and impact.

## Definition of done for each phase

- Requirements traceability updated.
- Types compile without errors.
- Lint passes.
- Tests pass.
- Production build succeeds.
- Responsive behavior reviewed at the required breakpoints.
- No fake interactions, dead buttons, or placeholder links.
- Unfinished work documented honestly.

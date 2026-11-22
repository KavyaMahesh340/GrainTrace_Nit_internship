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

## Phase 2 — Database, authentication, and roles (completed)

The active Phase 2 brief narrowed the next phase to persistence, authentication, and authorization. It explicitly deferred other business modules.

Delivered:

1. A thirty-one-table normalized Drizzle schema with foreign keys, indexes, constraints, timestamps, integer money, and integer base-unit quantities.
2. Committed migrations plus a deterministic, rerunnable seed transaction for the factory, roles, five demo users, and baseline master data.
3. bcrypt password hashing, generic authentication errors, and role-derived login redirects.
4. Database-backed sessions with hashed tokens, twelve-hour expiration, httpOnly cookies, and server-side revocation on logout.
5. A documented permission matrix with server-enforced route guards and permission-filtered navigation.
6. Standalone login and session-expired pages, plus unauthorized, operating-profile, and confirmed-logout experiences.
7. Zod validation for credentials, session tokens, and route references; no client role or user ID is trusted.
8. Authentication tests covering hashing, login success/failure, session states, permissions, validation, and duplicate users.

**Exit criteria:** migrations, seed, typecheck, lint, tests, production build, and responsive checks pass; Phase 2 is committed before stopping.

## Phase 3 — Domain engine and benchmark (completed)

The active Phase 3 brief required business logic before large workflow UI screens.

Delivered:

1. A pure `src/domain/` layer with no React, UI, or database imports.
2. Integer-paise money helpers, rational unit costs, margin and markup separation, and basis-point calculations.
3. Exact base-unit quantity conversions for grams, millilitres, and pieces with explicit conversion failures.
4. Append-only stock ledger functions with source references, balance derivation, negative-stock prevention, and duplicate-posting rejection.
5. Weighted average costing and immutable production cost snapshots.
6. GST functions with HSN validation, intra-state CGST/SGST split, inter-state IGST, and paise rounding.
7. Production metrics for planned usage, actual usage, output, damage, yield, variance flags, overhead allocation, and cost per good packet.
8. Invoice, payment, order fulfilment, partial dispatch, backorder, and overpayment rules.
9. A deterministic benchmark fixture and nine-test Vitest suite covering all supplied values plus required edge cases.
10. A human-readable acceptance report in `docs/BENCHMARK.md`.

**Exit criteria:** all tests pass, typecheck and lint pass, production build succeeds, and Phase 3 is committed before stopping.

## Phase 4 — Purchases and inventory (completed)

The active Phase 4 brief replaced the earlier invoice/dispatch/collection/audit plan with end-to-end purchasing and inventory workflows.

Delivered:

1. A `src/lib/workflows/` service layer with server-only actors, permission checks, Zod input contracts, error mapping, audit recording, and domain-backed ledger posting.
2. Supplier master creation and purchase order creation with integer paise totals, factory scoping, document-number uniqueness, and line validation.
3. Purchase order state transitions: draft, submitted, approved, partially received, received, and cancelled, with cancellation blocked after receipt.
4. Goods receipt posting with actual accepted quantities, damaged and rejected quantities, lot codes, expiry dates, source-line linkage, duplicate guards, over-receipt guards, and automatic order status recalculation.
5. Batch-linked raw material and packaging stock with append-only stock ledger entries and audit events.
6. Inventory service queries for raw materials, packaging, and finished goods with derived balances, weighted average cost, stock value, minimum-stock status, expiry alerts, batch detail, and movement history.
7. Reason-coded stock adjustments that post ledger entries and never edit balances directly.
8. Live `/purchases` and `/inventory` screens with dense tables, search, filters, sorting, document inspectors, forms, loading states, error states, empty states, and source links.
9. API route handlers with independent server-side session and permission checks for every read and write.
10. Workflow tests covering status transitions, receipt guards, duplicate receipts, damaged/rejected quantities, weighted average cost, ledger linkage, negative-stock prevention, invalid adjustments, and role authorization.

**Exit criteria:** schema migration applies, typecheck and lint pass, tests and Phase 3 benchmark pass, production build succeeds, and Phase 4 is committed before stopping.

## Phase 5 — Invoice, dispatch, collection, and audit

Planned scope:

- Invoice generation and collection tracking.
- Dispatch challans and delivery confirmation.
- Append-only audit events across every remaining state change.
- Reconciliation views that prove quantity and transaction accountability.
- ExcelJS exports, PDF documents, offline synchronization, and accessibility/performance audits against supplied benchmarks.

No subsequent phase begins automatically.

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

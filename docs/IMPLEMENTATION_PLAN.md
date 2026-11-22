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

## Phase 5 — Production and Batch DNA (completed)

The active Phase 5 brief supersedes the earlier invoice/dispatch/collection/audit plan. It narrows the phase to production execution and real source-to-customer traceability.

Delivered scope:

1. A production schema extension for actual output, damaged output, labour, gas, selling price, posting time, planned material lines, and immutable cost snapshots.
2. Production workflow services with draft, planned, in-progress, completed, and posted states, server-side permission checks, Zod validation, and audit recording.
3. Atomic posting that consumes source batches, records material damage separately, posts finished goods and output damage, seals the cost snapshot, and prevents double posting.
4. Three-percent material and yield variance flagging using the Phase 3 domain rules.
5. Live `/production` workspace with lifecycle actions, run inspection, planned versus actual output, exception watch, and cost evidence.
6. A Batch DNA trace service that joins suppliers, receipts, lots, ledger entries, recipes, runs, consumption, yield, finished goods, dispatch, invoices, and customers into real nodes and edges.
7. Live `/batch-dna` instrument with upstream/downstream traversal, clickable evidence nodes, edge quantities, risk flags, provenance gaps, and record links.
8. Server-authorized APIs for production reads and writes plus trace index/detail reads.
9. Workflow tests covering the full production lifecycle, posting guards, ledger references, cost snapshots, variance flags, and traceability relationships.

**Exit criteria:** schema migration applies, typecheck and lint pass, tests and Phase 3 benchmark pass, production build succeeds, and Phase 5 is committed before stopping.

## Phase 6 — Sales to Collection (completed)

The active Phase 6 brief extends the material journey from salesman order through dispatch, GST invoice, and collection while preserving all earlier phases.

Delivered scope:

1. A schema and migration extension for customers, sales orders and items, dispatch details, GST invoices and items, credit notes and items, payments, and financial-year document-number sequences.
2. Server-authoritative customer, sales order, approval, dispatch, invoice, PDF, credit-note, and payment workflow services with Zod validation, audit recording, permission checks, and transactional guards.
3. April-March document numbering for dispatch, invoices, credit notes, and receipts using configurable factory prefixes and transactional sequence allocation.
4. FEFO packet allocation, partial fulfilment, backorder calculation, over-dispatch prevention, and append-only finished-goods ledger postings in whole packets.
5. Tax-invoice creation from dispatched, uninvoiced packets using the Phase 3 GST engine, frozen party jurisdiction, multi-HSN handling, immutable posted lines, printable PDF output, and full reversal credit notes.
6. Numbered receipts with overpayment prevention, outstanding tracking, invoice status recalculation, and collection history.
7. A mobile-first salesman console with guided entry, live monetary calculations, large touch targets, order detail, network state, and honest offline draft queuing.
8. Live order tracking, dispatch, invoice, and collection workspaces with search, filters, status actions, document inspectors, source links, and responsive layouts.
9. Server-authorized APIs for every Phase 6 page, with approval, dispatch, and payment permissions separated from order creation and salesman access.
10. Workflow tests covering numbering, customer status, approval separation, partial dispatch, packet ledger decrement, GST posting, over-invoice prevention, receipts, overpayment prevention, credit notes, and role authorization.

**Exit criteria:** schema migration applies, typecheck and lint pass, tests and Phase 3 benchmark pass, production build succeeds, and Phase 6 is committed before stopping.

## Phase 7 — Finance, Reporting, and Audit (completed)

The active Phase 7 brief extends the material journey after collection with corrective finance workflows, accountability reporting, and real audit navigation while preserving all earlier phases.

Delivered scope:

1. A schema and migration extension for signed payment direction, correction links and reasons, duplicate payment keys, audit actor role/reason/before/after evidence, and product category.
2. Pure-domain correction rules that append debit receipts, prevent over-correction, recalculate signed paid totals, and derive credit-note-aware invoice payment status.
3. Transactional payment correction APIs and workflows that mark the original receipt as corrected, recalculate the invoice, and append a reason-coded audit event.
4. A collections dashboard with due, overdue, collected, corrected, aging-bucket, and per-customer exposure views plus duplicate reference protection.
5. A server-only report engine with ten report definitions covering sales, GST, collections, receivables aging, inventory value, production cost variance, purchases, customer ledger, product profitability, and stock movements.
6. Shared report filters for date range, customer, product, and category, applied consistently to on-screen reports and exports.
7. CSV, Excel, and PDF export services and server-authorized export APIs using the active report and filters.
8. A read-only auditor role and permission additions for payment correction, report viewing/export, and audit access.
9. A live audit explorer with event filters, before/after inspector, invoice and batch auditor trails, and source-document links.
10. Workflow tests for corrections, duplicate references, signed report totals, CSV/Excel/PDF output, audit search, and source-to-transaction trails.

**Exit criteria:** schema migration applies, typecheck and lint pass, tests and Phase 3 benchmark pass, production build succeeds, and Phase 7 is committed before stopping.

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

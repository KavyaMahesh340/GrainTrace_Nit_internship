# GRAINTRACE — Requirements

## Source and scope

Source of truth: `docs/PROBLEM.md`. The original file was absent from the workspace; the supplied brief was preserved there and used verbatim.

GRAINTRACE is a manufacturing intelligence system for small food manufacturers. Phase 1 delivered the foundation, design system, application shell, factory overview, and honest route structure. Phase 2 delivered the normalized database, authentication, expiring sessions, and server-enforced role permissions. Phase 3 delivered the pure domain engine and deterministic benchmark. Phase 4 adds live purchasing and inventory workflow services, APIs, and UI screens. Other workflow stages remain intentionally unimplemented.

A requirement is marked **explicit** when stated in the brief and **implied** when directly named by the material-journey chain but lacking detail. Implied items are recorded for planning only and are not implemented or expanded with invented rules.

## Functional requirements

| ID | Requirement | Source | Phase 1 status |
| --- | --- | --- | --- |
| FR-01 | Initialize a Next.js 14 App Router project with TypeScript. | Explicit | Implemented |
| FR-02 | Install and configure the fixed stack. | Explicit | Implemented |
| FR-03 | Configure Tailwind, shadcn/ui conventions, typography, and design tokens. | Explicit | Implemented |
| FR-04 | Configure Framer Motion for meaningful motion. | Explicit | Implemented |
| FR-05 | Configure SQLite and Drizzle ORM with a basic migration workflow. | Explicit | Implemented |
| FR-06 | Create the initial application shell. | Explicit | Implemented |
| FR-07 | Create the factory overview page. | Explicit | Implemented |
| FR-08 | Create responsive navigation. | Explicit | Implemented |
| FR-09 | Add meaningful loading, empty, and error states. | Explicit | Implemented |
| FR-10 | Add a clear route structure for future modules. | Explicit | Implemented |
| FR-11 | Use clearly labeled preview data only. | Explicit | Implemented |
| FR-12 | Create reusable components. | Explicit | Implemented |
| FR-13 | Set up Git and `.gitignore`. | Explicit | Implemented |
| FR-14 | Create a README with exact setup instructions. | Explicit | Implemented |
| FR-15 | Provide PWA support with an IndexedDB offline queue. | Explicit | Foundation implemented |
| FR-16 | Validate preview data with Zod. | Stack requirement | Implemented |
| FR-17 | Make ExcelJS and `@react-pdf/renderer` available for later report work. | Stack requirement | Dependencies installed; no reports implemented |
| FR-18 | Do not implement all business workflows yet. | Explicit | Honored |

## Product identity requirements

- Product name: **GRAINTRACE**.
- Tagline: **Every packet produced. Every gram accounted for.**
- Interface character: industrial operations software, editorial design, material science, and financial precision.
- The interface must not resemble a generic SaaS admin dashboard.
- The product must visually communicate that every quantity and transaction is accountable.
- The organizing concept is **MATERIAL JOURNEY**.

## Roles

| Role label | Basis | Phase 1 treatment |
| --- | --- | --- |
| Salesman | Explicitly named in “salesman order”. | Referenced in journey and route copy only. |
| Approver | Implied by “approval” stage. | Stage shown in preview flow; permissions not defined. |
| Purchaser / purchase role | Implied by “purchase” stage. | Stage shown in preview flow; permissions not defined. |
| Raw material / store role | Implied by “raw material inventory” stage. | Stage shown in preview flow; permissions not defined. |
| Recipe owner | Implied by “recipe” stage. | Stage shown in preview flow; permissions not defined. |
| Production role | Implied by “production” stage. | Stage and preview exceptions shown; permissions not defined. |
| Finished goods role | Implied by “finished goods” stage. | Stage shown in preview flow; permissions not defined. |
| Finance / invoicing role | Implied by “invoice” stage. | Stage shown in preview flow; permissions not defined. |
| Dispatch role | Implied by “dispatch” stage. | Stage shown in preview flow; permissions not defined. |
| Collections role | Implied by “collection” stage. | Stage shown in preview flow; permissions not defined. |
| Auditor | Implied by “audit” stage. | Stage shown in preview flow; permissions not defined. |

The brief does not specify role permissions, authentication, assignment rules, or approval authority. None are invented or implemented.

## Workflows

The material journey is explicitly defined as:

1. SALESMAN ORDER
2. APPROVAL
3. PURCHASE
4. RAW MATERIAL INVENTORY
5. RECIPE
6. PRODUCTION
7. FINISHED GOODS
8. INVOICE
9. DISPATCH
10. COLLECTION
11. AUDIT

| ID | Workflow stage | Phase 1 treatment |
| --- | --- | --- |
| WF-01 | Salesman order | Preview flow stage, orders table, and `/orders` route. |
| WF-02 | Approval | Preview flow stage; no approval action implemented. |
| WF-03 | Purchase | Preview flow stage and `/purchases` route. |
| WF-04 | Raw material inventory | Preview flow stage, stock-risk preview, and `/inventory` route. |
| WF-05 | Recipe | Preview flow stage and `/recipes` route. |
| WF-06 | Production | Preview flow stage, exceptions preview, and `/production` route. |
| WF-07 | Finished goods | Preview flow stage and `/finished-goods` route. |
| WF-08 | Invoice | Preview flow stage and `/invoices` route. |
| WF-09 | Dispatch | Preview flow stage and `/dispatch` route. |
| WF-10 | Collection | Preview flow stage and `/collections` route. |
| WF-11 | Audit | Preview flow stage and `/audit` route. |
| WF-12 | Batch DNA trace | Concept visualization at `/batch-dna`; no trace engine implemented. |

No transition rules, state machines, approval conditions, document flows, or role assignments were specified, so none are implemented.

## Business rules

| ID | Rule | Source |
| --- | --- | --- |
| BR-01 | Every quantity and transaction is accountable. | Explicit |
| BR-02 | Only clearly labeled preview data may be used in Phase 1. | Explicit |
| BR-03 | No fake interactions. | Explicit |
| BR-04 | No dead buttons or placeholder links. | Explicit |
| BR-05 | The fixed stack must not change without a compelling technical reason. | Explicit |
| BR-06 | No business workflow is implemented in Phase 1. | Explicit |

No tolerance limits, pricing rules, tax rules, yield formulas, credit terms, reorder thresholds, or audit retention rules were supplied. These must be gathered before Phase 2.

## Calculations

No calculation formulas or derivation rules were supplied in the brief.

Phase 1 therefore implements **no live calculations**. Values shown in the production pulse, stock cover, order value, and Batch DNA panel are static preview values. They are not derived from transactions and must not be interpreted as computed manufacturing or financial results.

Items requiring formulas in later phases include, but are not limited to, yield, variance, stock cover, order valuation, invoice totals, and collection status. Their definitions are intentionally deferred.

## Reports

No report names, fields, layouts, filters, or output rules were supplied.

ExcelJS and `@react-pdf/renderer` are installed because they are part of the fixed stack, but Phase 1 produces no Excel or PDF reports. Report specifications must be supplied before implementation.

## Benchmarks and quality requirements

| ID | Benchmark | Phase 1 verification |
| --- | --- | --- |
| QM-01 | No fake interactions. | All rendered links resolve to real routes; no nonfunctional buttons. |
| QM-02 | No dead buttons or placeholder links. | Navigation, table links, retry, and route links are functional. |
| QM-03 | No TypeScript errors. | `npm run typecheck`. |
| QM-04 | No console errors. | Browser runtime review during verification. |
| QM-05 | No unnecessary dependencies. | Dependency list reviewed against the fixed stack and direct needs. |
| QM-06 | Responsive at 375px, 768px, 1024px, and 1440px. | Automated browser breakpoint review via `npm run verify:responsive`. |
| QM-07 | Build must succeed. | `npm run build`. |
| QM-08 | Unfinished items documented honestly. | This document and `README.md`. |

No performance budgets, uptime targets, latency thresholds, or acceptance percentages were supplied.

## Factory overview content requirements

The overview must include:

- Editorial factory heading.
- Operational date and shift context.
- Production pulse visualization.
- Material flow.
- Orders awaiting action.
- Stock risk.
- Production exceptions.
- Recent activity.
- A prominent action area.

Layout requirements:

- Visually distinctive; not a template.
- Varied layouts instead of repeated cards.
- Must feel like a real factory operating system, not a marketing website.

## Visual requirements

- Use the seven specified brand colors exactly as design tokens.
- Use Geist (primary UI) and monospaced typography for batch codes, technical data, numbers, and timestamps.
- Use strong hierarchy, editorial asymmetry, purposeful whitespace, precise alignment, restrained borders, and slightly rounded corners.
- Use light and dark surfaces intentionally.
- Use manufacturing-inspired visualizations and meaningful motion.
- Maintain accessible contrast and responsive layouts.
- Avoid generic sidebar/KPI-card layouts, excessive rounding, purple gradients, glassmorphism, random shapes, emoji, meaningless charts, excessive shadows, unnecessary animation, and fake AI insights.

## Explicitly out of scope for Phase 1

- Order approval workflow.
- Purchase order workflow.
- Raw material ledger and valuation.
- Recipe versioning and tolerance rules.
- Production execution and batch records.
- Finished-goods ledger.
- Invoicing, tax, and collections.
- Dispatch and delivery confirmation.
- Audit trail engine.
- Batch DNA trace engine.
- Excel or PDF report generation.
- Authentication and authorization.
- Live data ingestion or device integration.
- Real-time alerting.

## Phase 2 requirements

The Phase 2 brief supplied in conversation is the active source for this section. It does not replace the Phase 1 record above; it extends it with database, authentication, and role requirements.

| ID | Requirement | Status |
| --- | --- | --- |
| P2-FR-01 | Build a normalized SQLite schema with Drizzle covering users, roles, sessions, customers, suppliers, products, raw materials, packaging materials, recipes/BOMs, sales orders, purchase orders, goods receipts, production runs, material batches, stock ledger, finished goods, invoices, payments, dispatches, and audit log. | Implemented |
| P2-FR-02 | Add foreign keys, indexes, constraints, timestamps, integer money, and integer base-unit quantities. | Implemented |
| P2-FR-03 | Commit generated migrations; never rely on runtime auto schema creation. | Implemented |
| P2-FR-04 | Hash passwords securely and seed deterministic demo accounts without plaintext storage. | Implemented |
| P2-FR-05 | Provide login, logout, session expiration, protected routes, and server-side session validation. | Implemented |
| P2-FR-06 | Validate credentials and route references with Zod on the server; never trust client role or user IDs. | Implemented |
| P2-FR-07 | Return safe generic authentication errors. | Implemented |
| P2-FR-08 | Define `Owner`, `Admin`, `Salesman`, `Production`, and `Accountant` roles and document the permission matrix. | Implemented in `docs/ARCHITECTURE.md` |
| P2-FR-09 | Enforce permissions on the server, not only in navigation. | Implemented |
| P2-FR-10 | Provide a distinctive login experience, role-aware navigation, role-specific landing destinations, unauthorized and session-expired states, an operating profile, and confirmed logout. | Implemented |
| P2-FR-11 | Seed deterministic demo accounts and necessary initial master data safely on rerun. | Implemented |
| P2-FR-12 | Support transactions for related writes and use them in the seed. | Implemented |
| P2-FR-13 | Test hashing, login success/failure, session validation, role access, invalid input, and duplicate users. | Implemented |
| P2-FR-14 | Run migrations, seed, tests, build, and commit Phase 2. | Implemented and committed |

Business workflows, quantity-conservation services, reports, and offline synchronization remained out of scope for Phase 2.

## Phase 3 requirements

The Phase 3 brief supplied in conversation is the active source for this section. It adds domain logic and benchmark verification without starting large workflow UI screens.

| ID | Requirement | Status |
| --- | --- | --- |
| P3-FR-01 | Keep business logic independent of React, UI components, and database access in `src/domain/`. | Implemented |
| P3-FR-02 | Store and calculate all money as integer paise; provide addition, subtraction, tax, rounding, percentage, margin, and balance helpers. | Implemented |
| P3-FR-03 | Store quantities as integer grams, millilitres, or pieces and provide exact conversion utilities. | Implemented |
| P3-FR-04 | Derive stock balances only from an append-only ledger with a source reference for every movement. | Implemented |
| P3-FR-05 | Calculate weighted average raw-material cost and snapshot production cost at posting. | Implemented |
| P3-FR-06 | Allocate production overhead to good output and keep historical cost independent of later purchases. | Implemented |
| P3-FR-07 | Support HSN, GST, CGST plus SGST for intra-state transactions, IGST for inter-state transactions, and paise rounding. | Implemented |
| P3-FR-08 | Calculate planned and actual material usage, good and damaged output, yield, material variance, yield variance, cost per good packet, and overhead allocation. | Implemented |
| P3-FR-09 | Use a default 3% variance tolerance and flag values that exceed it. | Implemented |
| P3-FR-10 | Record payments, calculate outstanding balances, support partial payments, validate payments, and prevent overpayment. | Implemented |
| P3-FR-11 | Prevent dispatch beyond available finished goods while supporting partial fulfilment and backorders. | Implemented |
| P3-FR-12 | Create a deterministic benchmark fixture and `benchmark.test.ts` covering every supplied target and required edge case. | Implemented |
| P3-FR-13 | Produce a human-readable benchmark report in `docs/BENCHMARK.md`. | Implemented |
| P3-FR-14 | Run tests and fix failures, then verify and commit Phase 3. | Implemented and committed |

Workflow services that write to SQLite, live reporting, and workflow UI screens were out of scope for Phase 3.

## Phase 4 requirements

The Phase 4 brief supplied in conversation is the active source for this section. It replaces the earlier invoice/dispatch/collection/audit plan with end-to-end purchasing and inventory workflows.

| ID | Requirement | Status |
| --- | --- | --- |
| P4-FR-01 | Implement supplier master and purchase order workflows with server-side validation, factory scoping, and document-number uniqueness. | Implemented |
| P4-FR-02 | Support purchase order statuses: draft, submitted, approved, partially received, received, and cancelled, with guarded transitions. | Implemented |
| P4-FR-03 | Prevent stock increase until a goods receipt is posted against an approved or partially received order. | Implemented |
| P4-FR-04 | Capture actual accepted quantities, damaged and rejected quantities, unit costs, lot codes, and expiry dates on receipts. | Implemented |
| P4-FR-05 | Prevent duplicate receipts, duplicate receipt lines, over-receipt, unknown lines, and receipt against invalid order states. | Implemented |
| P4-FR-06 | Post every accepted receipt quantity to the append-only stock ledger with source document reference and unit cost. | Implemented |
| P4-FR-07 | Recalculate purchase order status after each receipt based on fully delivered order lines. | Implemented |
| P4-FR-08 | Provide inventory views for raw materials, packaging, and finished goods with item, unit, balance, average cost, stock value, minimum stock, status, and last movement. | Implemented |
| P4-FR-09 | Provide working search, filters, sorting, low-stock alerts, expiry alerts, stock history, and batch detail. | Implemented |
| P4-FR-10 | Require a reason for every stock adjustment and post an append-only ledger entry; never edit stored balances directly. | Implemented |
| P4-FR-11 | Enforce role permissions on both pages and API route handlers; separate purchase posting from inventory adjustment authority. | Implemented |
| P4-FR-12 | Provide loading, error, empty, and validation states without fake buttons or simulated actions. | Implemented |
| P4-FR-13 | Use the Phase 3 domain engine for balance, valuation, average cost, money arithmetic, and stock movement validation. | Implemented |
| P4-FR-14 | Test purchase orders, receipts, inventory valuation, adjustments, negative-stock prevention, and role authorization. | Implemented |
| P4-FR-15 | Preserve Phase 1–3 behavior and benchmark results, then verify and commit Phase 4. | Implemented |

Purchases and inventory are the only live workflow stages. Recipes, production, finished goods, invoices, dispatch, collections, audit reporting, live report exports, and offline write synchronization remain out of scope for Phase 4.

# GRAINTRACE — Technical Overview

## 1. Scope and honestly stated status

GRAINTRACE is a working full-stack prototype of a small food manufacturer's material journey. It implements live workflows for purchases, inventory, production, Batch DNA, sales orders, dispatch, GST invoices, collections, finance reports, and audit. Recipes and finished goods are explicit route shells. Offline support is limited to salesman order entry; other workflows require connectivity.

The system is designed around transactional correctness and inspectable evidence. It is not presented as a certified accounting product, a complete ERP, or a multi-tenant hosted service.

## 2. Technology stack

| Layer | Technology |
| --- | --- |
| Application framework | Next.js 14 App Router, React 18, TypeScript |
| Styling and motion | Tailwind CSS, Framer Motion, Recharts |
| Database | SQLite via `better-sqlite3`; schema and queries via Drizzle ORM |
| Migrations | SQL files in `drizzle/` applied by `src/lib/db/migrate.ts` |
| Validation | Zod schemas in workflows, auth, and offline queue |
| Authentication | bcryptjs hashes, database-backed sessions, SHA-256 token hashes, httpOnly cookie |
| Domain engine | Pure TypeScript modules in `src/domain/` |
| Offline | Service worker shell cache; native IndexedDB v2 order queue |
| Exports | ExcelJS, `@react-pdf/renderer`, CSV |
| Testing | Vitest, Testing Library, jsdom, fake-indexeddb, Puppeteer Core responsive harness |

Node.js 22.19.0 and npm 11.21.1 were used for verification. Node.js 20 LTS or newer is required.

## 3. Architecture diagram

```text
Browser
  ├─ App Router pages (server components by default)
  │    ├─ requireSession / requirePermission
  │    └─ workflow reads for initial page data
  ├─ Client workspaces
  │    ├─ fetching through /api/* with session cookie
  │    ├─ Zod-aware forms and visible workflow state
  │    └─ salesman IndexedDB draft/queue/retry UI
  └─ Service worker
       └─ static shell cache + public /offline fallback

Next.js server
  ├─ /api/auth/*           login, logout
  ├─ /api/purchases/*      suppliers, purchase orders, receipts
  ├─ /api/inventory/*      items, detail, overview, adjustments
  ├─ /api/production/*     options, runs, plan, complete, post
  ├─ /api/batch-dna/*      trace index and detail
  ├─ /api/sales/*          customers, options, orders, approval, sync
  ├─ /api/dispatch/*       plan, dispatch, status
  ├─ /api/invoices/*       candidates, invoices, PDF, cancellation
  ├─ /api/payments/*       receipts and signed corrections
  ├─ /api/reports/*        queries and CSV/Excel/PDF exports
  └─ /api/audit/*          event explorer and source-to-transaction trails

Shared server layer
  ├─ src/lib/auth           sessions, permissions, role landing paths
  ├─ src/lib/workflows      actor checks, transactional use cases, audit writes
  ├─ src/domain             pure calculations and invariants
  └─ src/lib/db             Drizzle schema, migration runner, seed

SQLite database
  ├─ master and identity data
  ├─ documents and workflow state
  ├─ append-only stock_ledger
  ├─ immutable production_cost_snapshots
  ├─ audit_log and document_number_sequences
  └─ sessions with hashed tokens
```

Requests do not pass a client role or user ID into a workflow. `requireApiActor` resolves the session server-side and returns JSON 401 or 403; page guards redirect to `/login`, `/session-expired`, or `/unauthorized`.

## 4. Database overview

`src/lib/db/schema.ts` defines 38 Drizzle tables. The connection in `src/lib/db/index.ts` uses `DATABASE_URL` or `./data/graintrace.db`, enables WAL mode and foreign keys, and accepts `:memory:` for tests.

| Group | Tables |
| --- | --- |
| Identity and master | `factories`, `roles`, `users`, `sessions`, `customers`, `suppliers`, `products`, `raw_materials`, `packaging_materials` |
| Recipes | `recipes`, `recipe_ingredients`, `recipe_packaging` |
| Sales | `sales_orders`, `sales_order_items` |
| Purchasing | `purchase_orders`, `purchase_order_raw_materials`, `purchase_order_packaging_materials`, `goods_receipts`, `goods_receipt_items` |
| Batches and production | `material_batches`, `packaging_batches`, `production_runs`, `production_run_inputs`, `production_run_materials`, `production_cost_snapshots`, `finished_goods`, `finished_good_packets` |
| Stock | `inventory_adjustments`, `stock_ledger` |
| Finance | `invoices`, `invoice_items`, `payments`, `dispatches`, `dispatch_items`, `credit_notes`, `credit_note_items` |
| Evidence | `audit_log`, `document_number_sequences` |

The schema uses integer quantities and monetary paise, base units of grams, millilitres, and pieces, foreign keys, indexes, and SQLite check constraints. Migration `0007_violet_abomination.sql` adds `stock_ledger.movement_key` and is required for the inventory workspace.

## 5. Stock ledger design

The stock ledger is the single balance authority in the implemented workflows.

- Entries are append-only: corrections are new rows, not edits to historical movements.
- `movement_key` is unique per factory; `stock_ledger_movement_key_unique` prevents duplicate posting.
- Each row records direction and magnitude via `quantity_delta`, base unit, running `balance`, optional cost, source type/reference, batch dimensions, and an audit link.
- Check constraints require a nonzero delta, non-negative balance, valid base unit, and a source.
- Goods receipts create lot-linked incoming movements with actual unit cost.
- Material consumption, material damage, finished-good receipt, output damage, dispatch, and inventory adjustments create sourced movements.
- `calculateStockBalance` replays posted movements rather than trusting a mutable cached quantity.
- Batch DNA links ledger events to lots, production runs, and downstream documents.

This design lets the system answer "where did this packet come from?" without reconstructing state from unrelated document tables.

## 6. Money, costing, and valuation

`src/domain/money.ts` defines money as integer paise. Rational numbers are represented as reduced numerator/denominator pairs so intermediate unit costs do not lose precision. Rounding occurs when a rational result must become paise.

Key rules:

- `addPaise`, `subtractPaise`, and `multiplyPaiseByInteger` validate non-negative integers and safe integer bounds.
- `applyBasisPoints` calculates percentage amounts with rational arithmetic before rounding.
- `calculateBasisPoints`, `calculateVarianceBasisPoints`, `calculateMarginBasisPoints`, and `calculateMarkupBasisPoints` return signed integer basis points.
- `formatPaise` formats paise as rupees with exactly two decimal places.

`src/domain/costing.ts` replays a ledger for an item using weighted average cost. Receipts add quantity at their rational unit cost; issues remove value at the current weighted average. `calculateCostOfUsage` prices actual production consumption and rounds only the resulting paise amount.

`createProductionCostSnapshot` stores:

- per-line material quantity, rational unit cost, and cost in paise;
- material cost, labour, gas, derived overhead, and total run cost;
- good output and cost per good packet;
- optional selling price, gross margin per packet, margin basis points, and markup basis points.

Snapshots are sealed in `production_cost_snapshots`; later receipts do not rewrite historical batch cost.

## 7. Production calculations

Production is a state machine: `draft → planned → in_progress → completed → posted`.

- `planMaterialUsage` scales each BOM line by `plannedOutputPackets / recipe.expectedOutputPackets`, using rational arithmetic and integer rounding for base units.
- Planning selects real stocked batches; a run cannot consume an arbitrary unentered lot.
- `calculateProductionMetrics` computes good output as actual minus damaged output and yield variance against planned output.
- `calculateMaterialVariances` compares actual and planned quantities per item.
- Default tolerance is 300 basis points (3%). A variance is flagged when absolute variance is greater than the tolerance.
- Completion stores consumption and output facts before posting.
- Posting atomically writes material consumption, material damage, finished-good receipt, output damage, the cost snapshot, and audit events.
- Posted runs are immutable; corrections go through reason-coded inventory adjustments.

Verified demo values: plan 200 packets, actual 200, damaged 12, good 188, yield variance `-600 bps`, salt variance `+500 bps`, material cost `₹4523`, total cost `₹6323`, cost per good packet `₹33.63`.

## 8. GST and invoice calculations

`src/domain/tax.ts` implements tax rules:

- HSN must be 4–8 digits.
- Default rate is 500 basis points (5%), configurable per invoice within 0–10,000 basis points.
- `resolveGstJurisdiction` compares normalized origin and destination states: same state is `intra_state`; different states are `inter_state`.
- Intra-state tax is split into CGST and SGST; the remaining paise after rounded CGST are assigned to SGST so components always sum to total tax.
- Inter-state tax is recorded as IGST.
- All rates and amounts are integer basis points/paise; no floating-point money result is persisted.

Invoices are built only from dispatched packets. The document freezes business GSTIN, address, state, HSN, tax jurisdiction, taxable value, tax components, and total. Payment state is maintained separately: `amountPaidPaise` is updated when receipts or corrections post, and outstanding is derived from invoice and payment values rather than stored. Cancellation inserts reversing credit-note rows, adjusts invoiced order quantities and the invoice's payment/cancellation fields, and writes an audit event; it does not post a stock-ledger reversal.

Verified demo invoice: 180 packets × `₹100` = `₹18000`; 5% intra-state tax = `₹450` CGST + `₹450` SGST; total `₹18900`. A `₹10000` receipt leaves `₹8900` outstanding.

## 9. Authentication and authorization

- Six seeded roles: owner, admin, salesman, production, accountant, auditor.
- Passwords are stored as bcrypt hashes from `src/lib/auth/demo-hashes.ts`.
- Login creates a random session token; only its SHA-256 hash is stored in `sessions`.
- The `graintrace_session` cookie is httpOnly, `SameSite=lax`, secure in production, and expires after 12 hours.
- Logout revokes the server session and clears the cookie.
- `src/lib/auth/permissions.ts` defines 25 permissions and a role matrix.
- Server pages use `requireSession` and `requirePermission`; APIs use `requireApiActor`; workflows re-check the required permission inside the use case.
- Role-specific landing paths are `/` for owner/admin, `/orders` for salesman, `/production` for production, `/invoices` for accountant, and `/audit` for auditor.

## 10. Offline order queue

Only salesman order entry is offline-capable.

- The IndexedDB database is `graintrace-offline`; the v2 store is `mutation_queue` with a legacy v1 migration that preserves records.
- Order records support `draft`, `queued`, `syncing`, `synced`, and `failed` states.
- Each record has an idempotency key, retry metadata, timestamps, server order ID, and last error.
- Customer and product reference data can be cached for field entry.
- `syncQueuedOrders` resets stale syncing records, posts queued records to `/api/sales/sync` with a 15-second timeout, and records success, replay, or failure.
- `createSalesOrder` checks the idempotency key inside a transaction. Replaying the same key returns the existing order; reusing a key for a different order is rejected.
- The service worker caches static shell assets only. It does not cache authenticated pages, API responses, or business data.

## 11. Audit system

`recordAudit` writes inside the same workflow transaction as the business change. Each entry includes factory, user, session, actor email and role, action, entity type and ID, severity, optional reason, metadata, and optional before/after JSON.

Examples of audited actions include sales order creation/status changes, purchase order and receipt actions, production posting, dispatch, invoice creation/cancellation, and payment/correction events.

The auditor workspace supports filtered event search and an **AUDITOR TRAIL** lookup by invoice number, batch code, or run number. Trails assemble source order, tax document, payment, production evidence, and audit steps, and report gaps when downstream evidence is absent.

## 12. Document numbering

`src/lib/workflows/numbering.ts` allocates numbers transactionally per factory, document type, and financial year. The financial year runs April–March.

| Document | Prefix | Example from verified demo |
| --- | --- | --- |
| Dispatch | `DSP` | `DSP/2025-26/0001` |
| Invoice | `TN` | `TN/2025-26/0001` |
| Payment | `PAY` | `PAY/2025-26/0001` |
| Credit note | `CN/TN` | Generated on cancellation |

Manual workflow references such as `SO-DEMO-001`, `PO-DEMO-001`, `GRN-DEMO-001`, `RUN-DEMO-001`, and `FG-DEMO-001` are user-entered and uniqueness-checked; they are not system-generated numbers.

## 13. Testing strategy

Commands:

```powershell
npm run verify
npm run verify:responsive
```

`npm run verify` runs TypeScript typecheck, ESLint, all Vitest tests, and a production build. The verified full suite has 11 files and 49 tests. Vitest uses `DATABASE_URL=":memory:"` so tests start from isolated databases.

Test coverage includes:

- pure money, unit, stock, costing, production, tax, invoice, and payment rules;
- deterministic benchmark acceptance calculations;
- purchases, receipts, and inventory posting;
- production posting, cost snapshots, and Batch DNA;
- sales orders, dispatch, invoices, and collections;
- offline queue migration, durability, replay, conflict handling, and sync;
- authentication and role behavior;
- responsive route checks at 375px, 768px, 1024px, and 1440px, including console errors, heading/main landmarks, mobile navigation, and public fallback routes.

The benchmark fixture is a pure deterministic calculation case, not the live UI demo dataset. See `docs/BENCHMARK.md` and `docs/BENCHMARK_RESULTS.md` for its inputs and verified outputs.

## 14. Known boundaries

- Recipes and finished goods are labeled shells.
- Offline mutation support is limited to salesman orders.
- Docker configuration exists but was not built or run in the verification environment.
- `next start` requires a current `npm run build`; a dev run can overwrite `.next`.
- The mandated Next.js 14 line and a transitive ExcelJS dependency have upstream advisories that require an unauthorized stack change to resolve.

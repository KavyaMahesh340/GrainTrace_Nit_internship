# GRAINTRACE — Architecture

## System intent

GRAINTRACE is a material-journey accountability system. The architecture must make quantity and transaction provenance easy to trace from salesman order through audit, while the interface presents that provenance as an operational surface rather than a generic dashboard.

Phase 1 established the runtime, design tokens, route topology, data workflow, and honest preview experience. Phase 2 added the normalized database, authentication, expiring sessions, and server-enforced role permissions. Phase 4 added live purchasing and inventory workflows. Phase 5 added production execution and Batch DNA traceability. Phase 6 added sales orders, approval control, dispatch, GST invoices, credit notes, collections, and mobile order entry built on the Phase 3 pure domain engine. Phase 7 added signed payment corrections, collections analytics, ten live reports, CSV/Excel/PDF exports, and audit exploration. Phase 8 adds an installable PWA, durable offline order queueing, and idempotent synchronization. Phase 9 adds a strict final audit, ledger-authoritative balance posting, cancellation reversals, corrected finance reports, recoverable offline states, Docker configuration, and final benchmark evidence; recipes and finished goods remain unimplemented.

## Stack decisions

| Concern | Choice | Reason |
| --- | --- | --- |
| Application framework | Next.js 14 App Router | Fixed stack. Pinned to 14.2.35, a patched 14.2.x release. |
| Language | TypeScript in strict mode | Fixed stack; catches domain errors early. |
| Styling | Tailwind CSS | Fixed stack; token-driven utility styling. |
| Components | shadcn/ui conventions with Radix primitives | Fixed stack; copy-owned components rather than a locked design-system dependency. |
| Motion | Framer Motion | Fixed stack; used once per section boundary and for the Batch DNA line draw, with reduced-motion support. |
| Charts | Recharts | Fixed stack; used for the production pulse, which compares planned and actual preview output. |
| Database | SQLite via `better-sqlite3` | Fixed stack; appropriate for a small manufacturer and local-first operation. |
| ORM | Drizzle ORM | Fixed stack; typed schema, migrations, and SQL transparency. |
| Validation | Zod | Fixed stack; validates preview snapshot, offline queue payloads, login credentials, session tokens, and route references. |
| Tests | Vitest + Testing Library + fake-indexeddb | Fixed stack plus focused test adapters. |
| Excel export | ExcelJS | Fixed stack; renders Phase 7 report workbooks and remains available for invoices. |
| PDF export | `@react-pdf/renderer` | Fixed stack; renders printable Phase 6 tax invoices and Phase 7 report documents. |
| PWA | Manifest, custom service worker, native IndexedDB | Fixed stack; avoids a heavyweight framework plugin while keeping behavior explicit. |
| Password hashing | `bcryptjs` | Added in Phase 2 because Node's built-in crypto does not provide a password KDF; bcrypt supplies salted adaptive hashing. |
| Server boundary guard | `server-only` | Added in Phase 2 so auth session helpers fail the build if imported into a client bundle. |

No fixed-stack technology was replaced. `geist` font package was removed after scaffold inspection because the Next scaffold already ships local Geist font files. `bcryptjs` and `server-only` are narrow supporting dependencies added for secure authentication.

## Directory structure

```text
src/
├── app/
│   ├── (app)/                   Session-protected application routes
│   │   ├── (modules)/           Journey-stage route shells
│   │   ├── error.tsx            Protected route error boundary
│   │   ├── layout.tsx           Session guard plus AppShell
│   │   ├── loading.tsx          Overview loading skeleton
│   │   └── page.tsx             Factory overview
│   ├── (auth)/                  Standalone authentication routes
│   │   ├── login/               Login page and client form
│   │   └── session-expired/     Expired/revoked session state
│   ├── api/auth/                Login and logout route handlers
│   ├── api/purchases/           Supplier, order, status, and receipt APIs
│   ├── api/inventory/           Stock, detail, overview, and adjustment APIs
│   ├── api/production/          Production run, planning, posting, and option APIs
│   ├── api/sales/               Customer, sales order, option, status, and sync APIs
│   ├── api/dispatch/            Fulfilment plan, dispatch, detail, and status APIs
│   ├── api/invoices/            Invoice, PDF, cancellation, option, and candidate APIs
│   ├── api/payments/            Receipt and collection APIs
│   ├── api/batch-dna/           Batch trace index and detail APIs
│   ├── globals.css              Tokens and base styles
│   ├── offline/                 Public offline fallback page
│   ├── layout.tsx               Fonts, metadata, PWA manifest, global service worker registration
│   └── not-found.tsx            Root unknown-route state
├── components/
│   ├── layout/                  App shell, header, footer, navigation, user menu
│   ├── overview/                Overview-specific compositions
│   ├── purchases/               Live purchasing workspace
│   ├── inventory/               Live inventory workspace
│   ├── production/              Live production workspace
│   ├── sales/                   Salesman console and order, dispatch, invoice, collection workspaces
│   ├── system/                  Preview badge, reveal, module guards
│   └── ui/                      Reusable shadcn-style primitives
├── domain/                      Pure business engine; no React, UI, or DB imports
│   ├── benchmark.ts             Deterministic acceptance fixture
│   ├── costing.ts               Weighted average and usage costing
│   ├── inventory.ts             Append-only stock ledger rules
│   ├── invoices.ts              GST invoice construction
│   ├── money.ts                 Integer paise and exact rational helpers
│   ├── orders.ts                Fulfilment, partial dispatch, backorders
│   ├── payments.ts              Payment recording and balances
│   ├── production.ts            Yield, variance, overhead, cost snapshots
│   ├── tax.ts                   HSN, CGST/SGST, IGST, paise rounding
│   ├── units.ts                 Exact base-unit conversions
│   └── validation.ts            Domain errors and primitive invariants
├── lib/
│   ├── auth/                    Passwords, sessions, permissions, login service
│   ├── data/preview.ts          Zod-validated preview snapshot
│   ├── db/                      Drizzle schema, connection, migrations, seed
│   ├── domain/preview.ts        Preview schema and inferred types
│   ├── format.ts                Number and currency presentation helpers
│   ├── navigation.ts            Permission-aware route registry
│   ├── offline/                 IndexedDB v2 order queue, reference cache, and sync client
│   ├── pdf/                     React PDF tax invoice document
│   ├── workflows/               Transactional purchasing, inventory, production, sales, dispatch, invoice, payment, and trace services
│   └── utils.ts                 Class merge utility
└── tests/                       Vitest setup and test suites
```

## Request and data flow

```text
Browser request
  → Next.js App Router
  → Root layout
  → Protected layout calls requireSession on the server
  → Permission-filtered AppShell
  → Route component calls requirePermission
  → Zod-validated preview snapshot or module status component
  → Reusable UI primitives
  → Browser

Sign-in flow:
  → LoginForm posts JSON to /api/auth/login
  → Zod validates credentials
  → bcrypt verifies the stored hash
  → Session token is generated, hashed with SHA-256, and stored in SQLite
  → httpOnly cookie is attached to the response
  → Server returns only the role-derived landing path

Workflow write flow:
  → Client form posts JSON to a workflow API route
  → Route reads the server-validated session and required permission
  → Zod schema parses the input and the workflow builds a factory-scoped actor
  → Workflow service opens a SQLite transaction
  → Domain engine validates quantities, balances, and money
  → Workflow writes source documents, audit events, and append-only ledger rows
  → UI refreshes server-rendered data
```

Protected pages never receive a role, user ID, or permission list from the client. The role is read from the database through the server-validated session. Preview data remains explicitly labeled outside the live purchases and inventory workflows.

Phase 3 introduces a pure calculation layer beside the UI and persistence layers:

```text
Domain input (plain data)
  → src/domain validation
  → money, unit, inventory, costing, production, tax, invoice, payment, or order rule
  → plain immutable result or explicit DomainError
```

Phase 4 and Phase 5 workflow services own transactions and call these functions. The domain layer never calls Drizzle, Next.js, React, or browser APIs, so the same rules can be tested deterministically without a running application.

## Route map

| Route | Purpose | Status |
| --- | --- | --- |
| `/login` | Standalone sign-in console | Implemented |
| `/session-expired` | Expired/revoked session state | Implemented |
| `/unauthorized` | Role access denied state | Implemented |
| `/api/auth/login` | Credential validation and session cookie issuance | Implemented |
| `/api/auth/logout` | Server-side session revocation and cookie clearing | Implemented |
| `/api/purchases/*` | Supplier, order, status, and receipt writes/reads | Implemented in Phase 4 |
| `/api/inventory/*` | Stock queries, detail, overview, and adjustments | Implemented in Phase 4 |
| `/api/production/*` | Production runs, planning, status, completion, posting, overview, and options | Implemented in Phase 5 |
| `/api/batch-dna/*` | Batch trace index and detail | Implemented in Phase 5 |
| `/api/sales/*` | Customer, sales order, option, and status APIs | Implemented in Phase 6 |
| `/api/sales/sync` | Idempotent offline order submission with server validation and permission checks | Implemented in Phase 8 |
| `/api/dispatch/*` | Fulfilment plan, dispatch, detail, and status APIs | Implemented in Phase 6 |
| `/api/invoices/*` | Invoice, detail, PDF, cancellation, option, and candidate APIs | Implemented in Phase 6 |
| `/api/payments/*` | Receipt, correction, collection, and dashboard APIs | Implemented in Phase 6; corrections in Phase 7 |
| `/api/reports/*` | Report query and CSV/Excel/PDF export APIs | Implemented in Phase 7 |
| `/api/audit/*` | Audit entry search and auditor trail APIs | Implemented in Phase 7 |
| `/` | Protected factory overview | Implemented with preview data |
| `/orders` | Salesman orders, offline queue, and approval tracking | Implemented in Phase 6; offline queue in Phase 8 |
| `/offline` | Public service worker fallback | Implemented in Phase 8 |
| `/purchases` | Purchase orders, receipts, and suppliers | Implemented in Phase 4 |
| `/inventory` | Raw, packaging, and finished-goods stock | Implemented in Phase 4 |
| `/recipes` | Recipe stage | Route shell; workflow planned |
| `/production` | Production stage | Implemented in Phase 5 |
| `/finished-goods` | Finished goods | Route shell; workflow planned |
| `/invoices` | GST invoices, PDFs, and credit notes | Implemented in Phase 6 |
| `/dispatch` | Fulfilment planning and dispatch challans | Implemented in Phase 6 |
| `/collections` | Receipts, corrections, aging, and outstanding invoices | Implemented in Phase 6; corrections in Phase 7 |
| `/reports` | Report catalog, filters, table, summaries, and exports | Implemented in Phase 7 |
| `/audit` | Audit explorer and source-to-transaction trails | Implemented in Phase 7 |
| `/batch-dna` | Signature trace instrument | Implemented in Phase 5 |
| `/offline` | Offline fallback | Implemented |

Overview links preserve real and preview references in query strings (for example `/orders?focus=SO-2481`). The destination route reads and displays the reference, and live modules resolve the reference against repository data when available.

## Database design

The schema grew from thirty-one Phase 2 tables to the Phase 9 commercial, accountability, and offline-sync model with thirty-eight tables. Every transactional and master-data table is scoped by `factory_id`, has timestamp columns, and uses foreign keys for referential integrity. Money is stored as integer paise in `*_paise` columns. Physical quantities are stored as integer base units, primarily grams in `*_grams` columns, with packet counts in `quantity_packets` and packaging counts in `quantity_units`. Phase 7 added signed payment direction, correction links, duplicate-key uniqueness, product category, and richer audit evidence. Phase 8 adds a nullable, factory-scoped unique idempotency key on sales orders without replacing existing records. Phase 9 adds a factory-scoped deterministic `movement_key` on stock ledger rows and extends payment status values to include `partially_corrected`.

Table groups:

| Group | Tables |
| --- | --- |
| Identity | `roles`, `users`, `sessions`, `audit_log` |
| Factory and parties | `factories`, `customers`, `suppliers` |
| Product and recipe masters | `products`, `raw_materials`, `packaging_materials`, `recipes`, `recipe_ingredients`, `recipe_packaging` |
| Sales | `customers`, `sales_orders`, `sales_order_items` |
| Purchasing and receipts | `purchase_orders`, `purchase_order_raw_materials`, `purchase_order_packaging_materials`, `goods_receipts`, `goods_receipt_items` |
| Production and stock | `material_batches`, `production_runs`, `production_run_inputs`, `stock_ledger`, `finished_goods`, `finished_good_packets` |
| Finance and dispatch | `invoices`, `invoice_items`, `credit_notes`, `credit_note_items`, `payments`, `dispatches`, `dispatch_items`, `document_number_sequences` |

Constraints and indexes:

- Unique codes or document numbers are scoped to `factory_id`; payment duplicate keys are also factory-scoped.
- Payment direction and status columns are constrained with SQLite `CHECK` expressions, and correction rows link back to the original receipt.
- Quantity, price, amount, and available-stock columns have non-negative or positive checks.
- `goods_receipt_items` requires exactly one raw-material or packaging-material reference.
- `stock_ledger` requires exactly one material-batch or finished-good reference and a non-zero signed quantity delta.
- Foreign-key indexes and common query indexes are generated for factory, party, document, status, and date columns.
- `stock_ledger` and `audit_log` are append-only. Phase 4 workflow services insert rows and never update or delete them.

Migration and seed workflow:

1. Edit `src/lib/db/schema.ts`.
2. Run `npm run db:generate` to create a SQL migration in `drizzle/`.
3. Run `npm run db:migrate` to apply migrations to `data/graintrace.db`.
4. Run `npm run db:seed` to apply deterministic demo data.
5. Use `npm run db:studio` for local inspection.

`DATABASE_URL` defaults to `./data/graintrace.db`. Local database files are ignored by Git. The seed runs inside a SQLite transaction and is safe to rerun without duplicate codes, emails, or BOM lines.

Phase 3 defines the calculation rules in `src/domain/` rather than in the database: integer-paise money, exact base-unit conversions, weighted average costing, production snapshots, 3% variance tolerance, GST splits, signed payment balances, and fulfilment limits. Phase 4 and Phase 5 workflow services write validated purchase, receipt, production, adjustment, audit, and ledger results to SQLite. Phase 6 workflow services write customer, sales order, dispatch, invoice, credit note, and payment results. Phase 7 adds signed correction records, report derivation, and auditor trails without editing posted source documents. Sales order references remain user-supplied and factory-scoped; invoice, credit note, payment, and dispatch numbers come from transactional sequences. Sequences are configured per factory and document type with a `CONFIG` scope row and allocated per April-March financial year as `PREFIX/YYYY-YY/NNNN`. Defaults are `TN` for invoices, `CN/TN` for credit notes, `PAY` for receipts, and `DSP` for dispatch challans. Workflow state transitions are enforced in the service layer.

## Authentication and authorization

Passwords are hashed with bcrypt at cost 10. Seeded hashes are fixed constants so the seed is deterministic; all interactive password verification uses the same bcrypt verifier. Login failures return one generic message for unknown emails, wrong passwords, and inactive users, and verification always runs against a dummy hash when no user exists to reduce user-enumeration timing signals.

Sessions are stored in the `sessions` table. The random 32-byte token is sent only once in an httpOnly, sameSite lax cookie; the database stores its SHA-256 hash. Sessions expire after twelve hours, are checked against the current time on every request, and are revoked by timestamp on sign-out. Production cookies use the `secure` flag. Authentication route handlers run on the Node.js runtime because SQLite is native.

The server reads the session with `next/headers`, joins the user's role, rebuilds the permission set from the server-side matrix, and passes a serializable profile to the UI. The client never supplies a role, user ID, or permission list. `requireSession` redirects absent sessions to `/login` and invalid sessions to `/session-expired`; `requirePermission` redirects denied access to `/unauthorized`.

### Permission matrix

| Permission | Owner | Admin | Salesman | Production | Accountant | Auditor |
| --- | --- | --- | --- | --- | --- | --- |
| `overview:view` | Yes | Yes | Yes | Yes | Yes | Yes |
| `orders:view` | Yes | Yes | Yes | No | Yes | Yes |
| `orders:manage` | Yes | Yes | Yes | No | No | No |
| `orders:approve` | Yes | Yes | No | No | No | No |
| `purchases:view` | Yes | Yes | No | Yes | No | No |
| `purchases:manage` | Yes | Yes | No | No | No | No |
| `inventory:view` | Yes | Yes | No | Yes | No | No |
| `inventory:manage` | Yes | Yes | No | Yes | No | No |
| `recipes:view` | Yes | Yes | No | Yes | No | No |
| `recipes:manage` | Yes | Yes | No | Yes | No | No |
| `production:view` | Yes | Yes | No | Yes | No | No |
| `production:manage` | Yes | Yes | No | Yes | No | No |
| `finishedGoods:view` | Yes | Yes | No | Yes | No | No |
| `invoices:view` | Yes | Yes | Yes | No | Yes | Yes |
| `invoices:manage` | Yes | Yes | No | No | Yes | No |
| `payments:view` | Yes | Yes | No | No | Yes | Yes |
| `payments:manage` | Yes | Yes | No | No | Yes | No |
| `payments:correct` | Yes | Yes | No | No | Yes | No |
| `dispatch:view` | Yes | Yes | Yes | No | Yes | Yes |
| `dispatch:manage` | Yes | Yes | No | No | No | No |
| `reports:view` | Yes | Yes | No | No | Yes | Yes |
| `reports:export` | Yes | Yes | No | No | Yes | No |
| `audit:view` | Yes | Yes | No | No | Yes | Yes |
| `batchDna:view` | Yes | Yes | Yes | Yes | No | Yes |
| `users:manage` | Yes | Yes | No | No | No | No |

Landing destinations are role-derived: Owner and Admin go to `/`, Salesman to `/orders`, Production to `/production`, Accountant to `/invoices`, and Auditor to `/audit`. Navigation groups are filtered from the same permission set, but filtering is never the security boundary.

## Workflow service architecture

`src/lib/workflows/` is the server-only transaction boundary for live workflow writes and derived queries.

- `context.ts` builds a factory-scoped actor from the validated session and checks permissions.
- `validation.ts` defines Zod contracts for supplier, purchase order, receipt, adjustment, customer, sales order, dispatch, invoice, cancellation, payment, correction, report filter, and audit filter input.
- `api.ts` maps session and permission failures to JSON responses for route handlers.
- `errors.ts` translates domain, Zod, authorization, and workflow errors into stable API responses.
- `db.ts` defines the transaction and stock-target types shared by services.
- `ledger.ts` converts workflow inputs to domain stock movements and writes `stock_ledger` rows.
- `audit.ts` appends audit events with actor, entity, and metadata.
- `purchases.ts` owns supplier, purchase order, status transition, and goods receipt transactions.
- `inventory.ts` derives inventory views from the ledger and owns adjustment transactions.
- `production.ts` owns production runs, variance calculation, posting, and immutable cost snapshots.
- `numbering.ts` allocates factory-scoped, financial-year document sequences inside the caller's transaction.
- `customers.ts`, `sales.ts`, `dispatch.ts`, `invoices.ts`, and `payments.ts` own the Phase 6 order-to-collection transactions; `payments.ts` also owns corrections and collections analytics.
- `batch-dna.ts` builds forward and backward provenance graphs from real source records.
- `reports.ts` builds ten filtered report definitions from live workflow data and the pure domain engine.
- `audit-explorer.ts` builds filtered audit views and invoice/batch auditor trails from real source records.
- `src/lib/exports/` renders the active report to CSV, Excel, and PDF with the active filters applied.

Purchases do not create stock. Goods receipts create batch rows, post ledger movements with unit cost, append audit events, and recalculate order status. Inventory screens derive balances and values from ledger entries, not from cached balance columns. Adjustments require a reason, use domain stock validation, and append a ledger movement with a `STOCK_ADJUSTMENT` source.

## Offline architecture

The implemented Phase 8 caching, IndexedDB, reference-cache, and synchronization design is documented in “Offline-first data flow” below. All non-salesman workflow writes remain live authenticated APIs.

## UI architecture

- `AppShell` owns skip link, header, main landmark, and footer; the root layout owns global service-worker registration and install prompts.
- `SiteHeader` uses `usePathname` for active route state; `MobileNav` uses a Radix Dialog sheet.
- `navigation.ts` is the single source of route labels, indexes, phases, and required permissions.
- `AppShell` receives the server-derived user profile, filters navigation, and renders `UserMenu`.
- `UserMenu` opens a confirmation sheet before posting to `/api/auth/logout`.
- Login and session-expired pages use standalone dark surface compositions outside `AppShell`.
- Overview sections use different structures: split editorial heading, split chart, horizontal flow rail, table, meter list, dark exception ledger, signal action band, timeline, and Batch DNA strand.
- Phase 4, Phase 5, and Phase 6 workspaces use dense document tables, workflow tabs, inline status badges, detail sheets, batch/movement inspectors, and unit-aware financial columns.
- Phase 5 production uses lifecycle-specific action panels with planned versus actual meters and a sealed-cost inspector.
- Phase 5 Batch DNA uses a ten-stage evidence graph with upstream/downstream traversal, edge quantities, node inspector, and provenance-gap reporting.
- Phase 6 adds a touch-first salesman order console with live totals, status-specific order tracking, padded detail sheets, dispatch planning, invoice/candidate inspection, and collection receipt books.
- Phase 7 adds collections aging and exposure panels, a payment correction sheet, a ten-report catalog with shared filters and export actions, and an audit explorer with event inspector and source-to-transaction trail timeline.
- Phase 8 adds a touch-first local queue inspector, sync-state badges, connection and last-sync indicators, automatic reconnect sync, manual retry controls, and cached reference fallbacks in the salesman console.
- `Reveal` wraps major sections with subtle viewport motion; `useReducedMotion` disables transform/opacity animation.
- Recharts is client-only and receives serializable preview data as props.

## Offline-first data flow

- The service worker precaches only `/offline`, the manifest, and icon assets. Static Next.js and icon GETs are added to the cache after use; navigations are network-first and fall back to the public offline page; API and RSC data requests are never cached.
- The salesman console writes orders to IndexedDB v2 before attempting submission. Records carry a unique idempotency key, payload, state, attempts, error, server order ID, and timestamps; a v1 `mutation_queue` is migrated in-place on upgrade.
- Cached reference options contain only non-sensitive order-entry fields such as IDs, codes, names, product grams, HSN, state, and customer type. No addresses, financial balances, authenticated pages, reports, or API responses are cached.
- `syncQueuedOrders` validates local payload shape in the browser, posts to `/api/sales/sync`, and moves each record through `syncing` to `synced` or `failed`. Failed records remain available for editing and retry.
- The server re-parses the payload with Zod, rechecks `orders:manage`, and calls `syncSalesOrder`, which creates a submitted order only once per factory-scoped idempotency key. Replays return the original order; a key reused for a different order number is a conflict.
- Offline sync never approves orders, posts stock, creates invoices, or bypasses dispatch rules. Those remain separate authenticated workflows.

## Accessibility approach

- Semantic landmarks, table headers, lists, and time elements.
- `aria-current` on active navigation links.
- `aria-label` on icon-only controls and meters.
- `aria-busy` on the loading skeleton.
- Focus-visible styles with a distinct lime outline on dark surfaces.
- Reduced-motion media support in both CSS and Framer Motion.
- Color pairings chosen from the specified palette with machine grey used mainly as secondary text on paper.

## Testing strategy

- `format.test.ts`: presentation helpers and class merging.
- `preview.test.ts`: Zod schema contract, preview labeling, and eleven-stage journey integrity.
- `offline-queue.test.ts`: real IndexedDB v2 operations using fake-indexeddb, including persistence, state transitions, summaries, invalid payloads, and legacy migration.
- `offline-sync.test.ts`: queue-to-server payload conversion, replay safety, idempotency conflicts, synced state, and retryable failures.
- `empty-state.test.tsx`: honest empty state and working action link.
- `auth.test.ts`: password hashing/verification, generic failures, role-derived login redirects, absent/malformed/expired/revoked sessions, server permission matrix, and duplicate-user rejection.
- `benchmark.test.ts`: deterministic Phase 3 acceptance values, conversion errors, stock protection, tax rounding, weighted average, cost snapshots, variance tolerance, partial dispatch, payments, outstanding balances, and duplicate posting.
- `purchases-inventory.test.ts`: Phase 4 approval transitions, early/duplicate/over receipts, damaged and rejected quantities, batch creation, ledger source linkage, weighted average cost, negative-stock prevention, adjustment validation, detail history, and role authorization.
- `production-batch-dna.test.ts`: Phase 5 production lifecycle, permission denial, source-batch planning, actual and damaged quantities, ledger references, cost snapshots, posting guards, variance flags, and Batch DNA node/edge evidence.
- `sales-dispatch-invoices.test.ts`: Phase 6 financial-year numbering, customer status, approval separation, partial dispatch, packet ledger decrement, GST invoice posting, over-invoice prevention, receipts, overpayment prevention, credit notes, and delivery guards.
- `finance-phase.test.ts`: signed payment corrections, duplicate reference prevention, invoice recalculation, reason-coded audit entries, report filtering, signed report totals, CSV/Excel/PDF export, audit search, and invoice/batch trails.
- Vitest aliases `server-only` to an empty test module so server-only workflow services can be tested directly in the Node-native test environment.
- Verification commands: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`.

Browser responsive and console-error checks are automated by `scripts/responsive-check.mjs` using Puppeteer Core and an installed Chrome or Edge binary. The script signs in with the seeded Owner and Salesman accounts, checks 375px, 768px, 1024px, and 1440px, verifies the mobile offline console and PWA assets, then checks representative protected routes, the public offline fallback, the unauthorized state, and a not-found route.

## Known architectural limitations

- Authentication and authorization are implemented, but no user-management screen exists; `users:manage` is enforced only at the route layer.
- Recipes and finished goods remain explicitly labeled route shells rather than repository-backed workflow screens; audit is a live repository-backed explorer as of Phase 7.
- All stock postings flow through `src/lib/workflows/ledger.ts`, which derives balances from the append-only ledger and is the sole writer of cached available balances; purchases, production, inventory adjustments, dispatch, and cancellation reversals all use this path.
- Dispatch consumes whole finished-good packets in `pieces`; cancellation appends a compensating ledger row and restores packets, fulfilled quantity, and order status atomically.
- Offline queue support is scoped to salesman order entry; other workflows require a live server.
- The service worker caches static assets only and does not intercept or cache API responses; synchronization is driven by the authenticated application client.
- Report definitions are fixed in code for the supplied Phase 7 catalog; adding arbitrary user-defined reports remains outside scope.
- Sales order and other user-entered references are user-supplied and unique within their factory; invoice, credit note, payment, and dispatch numbers use server-generated financial-year sequences.
- The seed creates master data and numbering configuration only; operational records are created through the live workflow UI or tests.
- `npm audit --omit=dev` reports advisories against the Next.js 14 line whose published fixes require Next.js 15.5+ or 16, plus a transitive `uuid` advisory through ExcelJS. The fixed stack was retained as instructed; these must be reviewed before public deployment.

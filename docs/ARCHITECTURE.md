# GRAINTRACE — Architecture

## System intent

GRAINTRACE is a material-journey accountability system. The architecture must make quantity and transaction provenance easy to trace from salesman order through audit, while the interface presents that provenance as an operational surface rather than a generic dashboard.

Phase 1 established the runtime, design tokens, route topology, data workflow, and honest preview experience. Phase 2 added the normalized database, authentication, expiring sessions, and server-enforced role permissions. Phase 4 added live purchasing and inventory workflows. Phase 5 adds production execution and Batch DNA traceability built on the Phase 3 pure domain engine; other manufacturing workflows remain unimplemented.

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
| Excel export | ExcelJS | Fixed stack; installed for future reports. |
| PDF export | `@react-pdf/renderer` | Fixed stack; installed for future documents. |
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
│   │   ├── offline/             Protected offline fallback page
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
│   ├── globals.css              Tokens and base styles
│   ├── layout.tsx               Fonts, metadata, PWA manifest
│   └── not-found.tsx            Root unknown-route state
├── components/
│   ├── layout/                  App shell, header, footer, navigation, user menu
│   ├── overview/                Overview-specific compositions
│   ├── purchases/               Live purchasing workspace
│   ├── inventory/               Live inventory workspace
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
│   ├── offline/queue.ts         Native IndexedDB mutation queue
│   ├── workflows/               Transactional purchasing and inventory services
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
  → Client form posts JSON to a purchase or inventory API route
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
| `/` | Protected factory overview | Implemented with preview data |
| `/orders` | Salesman orders | Route shell; workflow planned |
| `/purchases` | Purchase orders, receipts, and suppliers | Implemented in Phase 4 |
| `/inventory` | Raw, packaging, and finished-goods stock | Implemented in Phase 4 |
| `/recipes` | Recipe stage | Route shell; workflow planned |
| `/production` | Production stage | Implemented in Phase 5 |
| `/finished-goods` | Finished goods | Route shell; workflow planned |
| `/invoices` | Invoice stage | Route shell; workflow planned |
| `/dispatch` | Dispatch stage | Route shell; workflow planned |
| `/collections` | Collection stage | Route shell; workflow planned |
| `/audit` | Audit stage | Route shell; workflow planned |
| `/batch-dna` | Signature trace instrument | Implemented in Phase 5 |
| `/offline` | Offline fallback | Implemented |

Overview links preserve preview references in query strings (for example `/orders?focus=SO-2481`). The destination route reads and displays the reference. This makes each link functional without pretending the workflow exists.

## Database design

Phase 2 expands the schema to thirty-one tables. Every transactional and master-data table is scoped by `factory_id`, has timestamp columns, and uses foreign keys for referential integrity. Money is stored as integer paise in `*_paise` columns. Physical quantities are stored as integer base units, primarily grams in `*_grams` columns, with packet counts in `quantity_packets` and packaging counts in `quantity_units`.

Table groups:

| Group | Tables |
| --- | --- |
| Identity | `roles`, `users`, `sessions`, `audit_log` |
| Factory and parties | `factories`, `customers`, `suppliers` |
| Product and recipe masters | `products`, `raw_materials`, `packaging_materials`, `recipes`, `recipe_ingredients`, `recipe_packaging` |
| Sales | `sales_orders`, `sales_order_items` |
| Purchasing and receipts | `purchase_orders`, `purchase_order_raw_materials`, `purchase_order_packaging_materials`, `goods_receipts`, `goods_receipt_items` |
| Production and stock | `material_batches`, `production_runs`, `production_run_inputs`, `stock_ledger`, `finished_goods`, `finished_good_packets` |
| Finance and dispatch | `invoices`, `invoice_items`, `payments`, `dispatches`, `dispatch_items` |

Constraints and indexes:

- Unique codes or document numbers are scoped to `factory_id`.
- Status columns are constrained with SQLite `CHECK` expressions.
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

Phase 3 defines the calculation rules in `src/domain/` rather than in the database: integer-paise money, exact base-unit conversions, weighted average costing, production snapshots, 3% variance tolerance, GST splits, payment balances, and fulfilment limits. Phase 4 workflow services write validated purchase, receipt, adjustment, audit, and ledger results to SQLite. Document numbers are user-supplied unique references scoped to the factory; workflow state transitions are enforced in the service layer.

## Authentication and authorization

Passwords are hashed with bcrypt at cost 10. Seeded hashes are fixed constants so the seed is deterministic; all interactive password verification uses the same bcrypt verifier. Login failures return one generic message for unknown emails, wrong passwords, and inactive users, and verification always runs against a dummy hash when no user exists to reduce user-enumeration timing signals.

Sessions are stored in the `sessions` table. The random 32-byte token is sent only once in an httpOnly, sameSite lax cookie; the database stores its SHA-256 hash. Sessions expire after twelve hours, are checked against the current time on every request, and are revoked by timestamp on sign-out. Production cookies use the `secure` flag. Authentication route handlers run on the Node.js runtime because SQLite is native.

The server reads the session with `next/headers`, joins the user's role, rebuilds the permission set from the server-side matrix, and passes a serializable profile to the UI. The client never supplies a role, user ID, or permission list. `requireSession` redirects absent sessions to `/login` and invalid sessions to `/session-expired`; `requirePermission` redirects denied access to `/unauthorized`.

### Permission matrix

| Permission | Owner | Admin | Salesman | Production | Accountant |
| --- | --- | --- | --- | --- | --- |
| `overview:view` | Yes | Yes | Yes | Yes | Yes |
| `orders:view` | Yes | Yes | Yes | No | Yes |
| `orders:manage` | Yes | Yes | Yes | No | No |
| `purchases:view` | Yes | Yes | No | Yes | No |
| `purchases:manage` | Yes | Yes | No | No | No |
| `inventory:view` | Yes | Yes | No | Yes | No |
| `inventory:manage` | Yes | Yes | No | Yes | No |
| `recipes:view` | Yes | Yes | No | Yes | No |
| `recipes:manage` | Yes | Yes | No | Yes | No |
| `production:view` | Yes | Yes | No | Yes | No |
| `production:manage` | Yes | Yes | No | Yes | No |
| `finishedGoods:view` | Yes | Yes | No | Yes | No |
| `invoices:view` | Yes | Yes | Yes | No | Yes |
| `invoices:manage` | Yes | Yes | No | No | Yes |
| `payments:view` | Yes | Yes | No | No | Yes |
| `dispatch:view` | Yes | Yes | Yes | No | Yes |
| `audit:view` | Yes | Yes | No | No | Yes |
| `batchDna:view` | Yes | Yes | Yes | Yes | No |
| `users:manage` | Yes | Yes | No | No | No |

Landing destinations are role-derived: Owner and Admin go to `/`, Salesman to `/orders`, Production to `/production`, and Accountant to `/invoices`. Navigation groups are filtered from the same permission set, but filtering is never the security boundary.

## Workflow service architecture

`src/lib/workflows/` is the server-only transaction boundary for live workflow writes and derived queries.

- `context.ts` builds a factory-scoped actor from the validated session and checks permissions.
- `validation.ts` defines Zod contracts for supplier, purchase order, receipt, and adjustment input.
- `api.ts` maps session and permission failures to JSON responses for route handlers.
- `errors.ts` translates domain, Zod, authorization, and workflow errors into stable API responses.
- `db.ts` defines the transaction and stock-target types shared by services.
- `ledger.ts` converts workflow inputs to domain stock movements and writes `stock_ledger` rows.
- `audit.ts` appends audit events with actor, entity, and metadata.
- `purchases.ts` owns supplier, purchase order, status transition, and goods receipt transactions.
- `inventory.ts` derives inventory views from the ledger and owns adjustment transactions.

Purchases do not create stock. Goods receipts create batch rows, post ledger movements with unit cost, append audit events, and recalculate order status. Inventory screens derive balances and values from ledger entries, not from cached balance columns. Adjustments require a reason, use domain stock validation, and append a ledger movement with a `STOCK_ADJUSTMENT` source.

## Offline architecture

- `public/manifest.webmanifest` provides install metadata.
- `public/sw.js` caches the shell and previously visited same-origin GET responses; navigations are network-first with cached fallback to `/offline`.
- `ServiceWorkerRegistration` registers the worker after load and fails silently if unsupported.
- `src/lib/offline/queue.ts` creates IndexedDB database `graintrace-offline` with store `mutation_queue`.
- Queue records are validated with Zod and expose enqueue, list, count, and remove operations.
- `ConnectionStatus` displays actual `navigator.onLine` state and real queue count.
- Purchases and inventory write through live authenticated APIs; the offline queue does not yet synchronize workflow mutations.

## UI architecture

- `AppShell` owns skip link, header, main landmark, footer, and service-worker registration.
- `SiteHeader` uses `usePathname` for active route state; `MobileNav` uses a Radix Dialog sheet.
- `navigation.ts` is the single source of route labels, indexes, phases, and required permissions.
- `AppShell` receives the server-derived user profile, filters navigation, and renders `UserMenu`.
- `UserMenu` opens a confirmation sheet before posting to `/api/auth/logout`.
- Login and session-expired pages use standalone dark surface compositions outside `AppShell`.
- Overview sections use different structures: split editorial heading, split chart, horizontal flow rail, table, meter list, dark exception ledger, signal action band, timeline, and Batch DNA strand.
- Phase 4 and Phase 5 workspaces use dense document tables, workflow tabs, inline status badges, detail sheets, batch/movement inspectors, and unit-aware financial columns.
- Phase 5 production uses lifecycle-specific action panels with planned versus actual meters and a sealed-cost inspector.
- Phase 5 Batch DNA uses a ten-stage evidence graph with upstream/downstream traversal, edge quantities, node inspector, and provenance-gap reporting.
- `Reveal` wraps major sections with subtle viewport motion; `useReducedMotion` disables transform/opacity animation.
- Recharts is client-only and receives serializable preview data as props.

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
- `offline-queue.test.ts`: real IndexedDB operations using fake-indexeddb, including validation failure.
- `empty-state.test.tsx`: honest empty state and working action link.
- `auth.test.ts`: password hashing/verification, generic failures, role-derived login redirects, absent/malformed/expired/revoked sessions, server permission matrix, and duplicate-user rejection.
- `benchmark.test.ts`: deterministic Phase 3 acceptance values, conversion errors, stock protection, tax rounding, weighted average, cost snapshots, variance tolerance, partial dispatch, payments, outstanding balances, and duplicate posting.
- `purchases-inventory.test.ts`: Phase 4 approval transitions, early/duplicate/over receipts, damaged and rejected quantities, batch creation, ledger source linkage, weighted average cost, negative-stock prevention, adjustment validation, detail history, and role authorization.
- `production-batch-dna.test.ts`: Phase 5 production lifecycle, permission denial, source-batch planning, actual and damaged quantities, ledger references, cost snapshots, posting guards, variance flags, and Batch DNA node/edge evidence.
- Vitest aliases `server-only` to an empty test module so server-only workflow services can be tested directly in the Node-native test environment.
- Verification commands: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`.

Browser responsive and console-error checks are automated by `scripts/responsive-check.mjs` using Puppeteer Core and an installed Chrome or Edge binary. The script signs in with the seeded Owner account, then checks 375px, 768px, 1024px, and 1440px plus representative protected routes, the unauthorized state, and a not-found route.

## Known architectural limitations

- Authentication and authorization are implemented, but no user-management screen exists; `users:manage` is enforced only at the route layer.
- Pages outside purchases and inventory still render explicitly labeled preview data instead of repository-backed workflow data.
- Only purchases and inventory write the stock ledger; production, dispatch, and other consumption workflows remain unimplemented.
- No synchronization backend for the offline queue.
- Service worker caches GET responses only; it does not synchronize writes.
- Business reports and exports remain undefined and unimplemented.
- Document numbers are user-supplied references rather than server-generated sequences.
- The seed creates master data only; purchase and inventory records are created through the live workflow UI or tests.
- `npm audit --omit=dev` reports advisories against the Next.js 14 line whose published fixes require Next.js 15.5+ or 16, plus a transitive `uuid` advisory through ExcelJS. The fixed stack was retained as instructed; these must be reviewed before public deployment.

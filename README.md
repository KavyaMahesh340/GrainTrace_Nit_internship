# GRAINTRACE

Every packet produced. Every gram accounted for.

GRAINTRACE is a manufacturing intelligence system for small food manufacturers, organized around the material journey from salesman order through audit. This repository contains **Phase 1: Foundation & Design System**, the **Phase 2 database, authentication, and role foundation**, the **Phase 3 pure domain engine and benchmark**, **Phase 4: Purchases and Inventory**, **Phase 5: Production and Batch DNA**, **Phase 6: Sales to Collection**, and **Phase 7: Finance, Reporting, and Audit**. Purchases, inventory, production, traceability, sales orders, dispatch, GST invoices, collections, payment corrections, ten reports, CSV/Excel/PDF exports, and the audit explorer are live database-backed workflows; recipes, finished goods, and offline synchronization sections remain explicitly labeled shells or limitations.

## Prerequisites

- Node.js 20 LTS or newer (verified on Node.js 22.19.0)
- npm 10 or newer (verified on npm 11.21.1)
- Git

## Exact setup instructions

From PowerShell, in the folder that contains this repository:

```powershell
cd nit_internship
npm install
Copy-Item .env.example .env
npm run db:migrate
npm run db:seed
npm run dev
```

Then open `http://localhost:3000`.

All Drizzle migrations are committed, so `npm run db:generate` is not required for a fresh setup. `npm run db:seed` creates the demo factory, roles, six demo users, and baseline master data; it is deterministic and safe to rerun. Run generation only after changing `src/lib/db/schema.ts`:

```powershell
npm run db:generate
npm run db:migrate
```

To inspect the local SQLite database:

```powershell
npm run db:studio
```

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the Next.js development server. |
| `npm run build` | Create a production build. |
| `npm run start` | Serve the production build. |
| `npm run lint` | Run Next.js ESLint checks. |
| `npm run typecheck` | Run TypeScript without emitting files. |
| `npm test` | Run the Vitest suite once. |
| `npm run test:watch` | Run Vitest in watch mode. |
| `npm run verify:responsive` | Check required breakpoints and console errors against a running server on port 3100. |
| `npm run db:generate` | Generate a SQL migration from the Drizzle schema. |
| `npm run db:migrate` | Apply committed migrations to SQLite. |
| `npm run db:seed` | Seed deterministic demo users and baseline master data. |
| `npm run db:studio` | Open Drizzle Studio. |
| `npm run verify` | Run typecheck, lint, tests, and production build in sequence. |

## Routes

| Route | Status |
| --- | --- |
| `/login` | Standalone role-aware sign-in console |
| `/session-expired` | Expired or revoked session state |
| `/` | Protected factory overview with preview data |
| `/orders` | Live salesman console, approval control, and order tracking workspace |
| `/purchases` | Live purchase order, goods receipt, and supplier workflow |
| `/inventory` | Live stock, batch, movement, alert, and adjustment workspace |
| `/recipes` | Planned route shell |
| `/production` | Live production planning, consumption, yield, posting, and cost workspace |
| `/finished-goods` | Planned route shell |
| `/invoices` | Live GST invoice, PDF, and credit-note workspace |
| `/dispatch` | Live fulfilment planning and dispatch workspace |
| `/collections` | Live receipt, correction, aging, and outstanding-invoice workspace |
| `/reports` | Live ten-report workspace with CSV, Excel, and PDF exports |
| `/audit` | Live audit explorer and source-to-transaction auditor trail |
| `/batch-dna` | Live source-to-customer traceability instrument |
| `/offline` | Protected service-worker offline fallback |
| `/unauthorized` | Role-based access denied state |
| `/api/auth/login` | Validates credentials and sets the httpOnly session cookie |
| `/api/auth/logout` | Revokes the session on the server and clears the cookie |
| `/api/purchases/*` | Server-authorized supplier, purchase order, status, and goods receipt APIs |
| `/api/inventory/*` | Server-authorized stock query, detail, overview, and adjustment APIs |
| `/api/production/*` | Server-authorized production run, planning, completion, posting, overview, and option APIs |
| `/api/batch-dna/*` | Server-authorized batch trace index and detail APIs |
| `/api/sales/*` | Server-authorized customer, sales order, option, and status APIs |
| `/api/dispatch/*` | Server-authorized fulfilment plan, dispatch, detail, and status APIs |
| `/api/invoices/*` | Server-authorized invoice, PDF, cancellation, option, and candidate APIs |
| `/api/payments/*` | Server-authorized receipt, correction, collection, and dashboard APIs |
| `/api/reports/*` | Server-authorized report query and CSV/Excel/PDF export APIs |
| `/api/audit/*` | Server-authorized audit entry and auditor trail APIs |

All application routes except `/login`, `/session-expired`, the authentication APIs, and the root not-found state require a valid server-validated session. Purchases, inventory, production, Batch DNA, sales orders, dispatch, invoices, collections, reports, and audit read and write through server-side workflow services; the remaining route shells state their status without simulating workflows.

## Demo accounts

Run `npm run db:seed` before signing in. The sign-in console can fill these credentials with one click.

| Role | Email | Password | Landing view |
| --- | --- | --- | --- |
| Owner | `owner@graintrace.local` | `Owner!2026` | `/` |
| Admin | `admin@graintrace.local` | `Admin!2026` | `/` |
| Salesman | `salesman@graintrace.local` | `Sales!2026` | `/orders` |
| Production | `production@graintrace.local` | `Production!2026` | `/production` |
| Accountant | `accountant@graintrace.local` | `Accounts!2026` | `/invoices` |
| Auditor | `auditor@graintrace.local` | `Auditor!2026` | `/audit` |

Passwords are stored as bcrypt hashes. Sessions store only a SHA-256 hash of the random session token, expire after twelve hours, and are revoked on sign-out. The full permission matrix is documented in `docs/ARCHITECTURE.md`.

## Project structure

```text
docs/                   Source brief, requirements, plan, architecture, design system
drizzle/                Generated SQL migrations
public/                 PWA manifest, icon, service worker
scripts/                Seed and responsive verification runners
src/app/                App Router pages, auth APIs, and global styles
src/components/layout/  Application shell, navigation, and user menu
src/components/overview/ Factory overview sections
src/components/purchases/ Live purchasing workspace
src/components/inventory/ Live inventory workspace
src/components/production/ Live production workspace
src/components/sales/    Salesman console and sales workflow workspaces
src/components/reports/  Report catalog, filters, table, and export workspace
src/components/audit/    Audit search, event inspector, and auditor trail workspace
src/components/system/  System-level client components
src/components/ui/      Reusable shadcn-style primitives
src/domain/             Pure money, unit, inventory, costing, production, tax, invoice, payment, and order rules
src/lib/auth/           Password hashing, sessions, permissions, and login service
src/lib/data/           Zod-validated preview snapshot
src/lib/db/             Drizzle schema, connection, migrations, and seed
src/lib/domain/         Preview schema and inferred types
src/lib/offline/        IndexedDB mutation queue
src/lib/workflows/      Transactional purchasing, inventory, production, sales, dispatch, invoice, payment, report, and audit services
src/lib/exports/        CSV, Excel, and PDF report renderers
src/lib/format.ts       Presentation helpers
src/lib/navigation.ts   Route registry
src/tests/              Vitest setup and suites
```

## Phase 1, Phase 2, Phase 3, Phase 4, Phase 5, Phase 6, and Phase 7 scope

Implemented:

- Next.js 14 App Router, TypeScript, Tailwind, shadcn/ui conventions, Framer Motion, Recharts.
- SQLite, Drizzle ORM, Zod, Vitest, ExcelJS, and `@react-pdf/renderer`.
- Design tokens, Geist typography, and monospaced technical data treatment.
- Responsive navigation, application shell, and factory overview.
- Loading, empty, error, not-found, and offline states.
- Explicit route structure for all eleven material-journey stages.
- PWA manifest, service worker shell cache, and native IndexedDB mutation queue.
- Reusable UI primitives and a Zod-validated preview dataset.
- Thirty-table normalized Drizzle schema with foreign keys, indexes, checks, timestamps, integer money, and integer quantities.
- SQLite migrations, deterministic seed, five role-based demo accounts, and bcrypt password hashing.
- Expiring database-backed sessions with hashed tokens, httpOnly cookies, and server-side revocation.
- Role permission matrix, protected layouts and routes, role-filtered navigation, and role-specific landing views.
- Standalone sign-in, unauthorized, session-expired, operating profile, and confirmed sign-out experiences.
- Server-side Zod validation for credentials and route references; no client role or user ID is trusted.
- Pure domain rules for integer money, exact unit conversion, append-only stock, weighted average costing, production variance, GST, invoices, payments, and partial fulfilment.
- Deterministic Phase 3 benchmark fixture, acceptance tests, and report in `docs/BENCHMARK.md`.
- Transactional supplier, purchase order, approval-state, and goods receipt workflows with duplicate and over-receipt guards.
- Batch-linked stock receipts with lot code, expiry, damaged/rejected quantities, unit cost, audit events, and append-only ledger entries.
- Live inventory table, low-stock and expiry alerts, batch detail, movement timeline, adjustment history, and reason-coded adjustments.
- Server-side role authorization on pages and APIs; purchase posting, inventory adjustment, and production posting permissions are separate.
- Production runs with draft, planned, in-progress, completed, and posted states, batch planning, actual consumption, damaged output, yield variance, and atomic cost snapshot posting.
- Ledger-backed production posting that links material consumption, material damage, finished-good receipt, and output damage to one immutable run reference.
- Live production analytics for planned versus actual output, yield variance, exceptions, labour, overhead, and cost per packet.
- Real Batch DNA tracing from purchase sources and material lots through recipe, ledger, production, finished goods, dispatch, invoice, and customer evidence.
- Customer master records with GST, address, credit terms, credit limit, and blocked status.
- Sales orders with draft, submitted, approved, partially fulfilled, fulfilled, rejected, and cancelled states, with approval separated from creation.
- Live salesman mobile console with guided entry, live calculations, order detail, and honest offline draft queuing.
- FEFO packet allocation, partial dispatch, backorders, and append-only finished-goods dispatch postings.
- April-March document numbering for dispatch, invoices, credit notes, and receipts.
- GST invoices from dispatched packets, multi-HSN support, printable PDFs, and full reversal credit notes.
- Numbered receipts, outstanding tracking, payment posting, and overpayment prevention.
- Server-authorized sales, dispatch, invoice, and collection APIs plus live tracking workspaces.
- Signed payment corrections that post reversing receipt rows, mark the original as corrected, recalculate invoice balances, and append a reason-coded audit event.
- Collections dashboard with aging buckets, customer exposure, corrected receipts, and duplicate reference protection.
- Ten live reports covering sales, GST, collections, receivables aging, inventory value, production variance, purchases, customer ledger, product profitability, and stock movements.
- Server-filtered CSV, Excel, and PDF report exports using the same workflows and integer-paise domain calculations as the on-screen reports.
- Filterable audit explorer, event before/after inspector, auditor role, and source-to-transaction trails for invoices and batches.

Not implemented:

- Workflows outside purchases, inventory, production, Batch DNA, sales-to-collection, finance reporting, and audit, such as recipes and finished goods.
- Offline write synchronization; the salesman console queues drafts honestly, but replay and workflow writes require a live server.
- Upstream security advisories affecting the mandated Next.js 14 line and a transitive ExcelJS dependency; fixes require stack changes that were not authorized in Phase 1.

## Verification

```powershell
npm run verify
```

Responsive behavior is checked at 375px, 768px, 1024px, and 1440px with `npm run verify:responsive` while a server is running on port 3100. The script signs in with the seeded Owner account before checking protected routes:

```powershell
$env:BASE_URL = "http://localhost:3100"
npx next start -p 3100
```

In a second terminal:

```powershell
npm run verify:responsive
```

## Documentation

- `docs/PROBLEM.md` — preserved source brief
- `docs/REQUIREMENTS.md` — complete requirement trace
- `docs/IMPLEMENTATION_PLAN.md` — phase plan and exact next phase
- `docs/ARCHITECTURE.md` — technical architecture and decisions
- `docs/BENCHMARK.md` — Phase 3 deterministic calculation report
- `docs/DESIGN_SYSTEM.md` — visual and interaction system

## Git

Phase 1, Phase 2, Phase 3, Phase 4, Phase 5, Phase 6, and Phase 7 are committed checkpoints. Do not commit secrets or local database files. Demo passwords are documentation-only credentials for local evaluation.

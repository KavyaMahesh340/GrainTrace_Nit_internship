# GRAINTRACE

Every packet produced. Every gram accounted for.

GRAINTRACE is a manufacturing intelligence system for small food manufacturers, organized around the material journey from salesman order through audit. This repository contains **Phase 1: Foundation & Design System**, the **Phase 2 database, authentication, and role foundation**, the **Phase 3 pure domain engine and benchmark**, and **Phase 4: Purchases and Inventory**. Purchases and inventory are live database-backed workflows; other operational sections remain explicitly labeled route shells.

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

All Drizzle migrations are committed, so `npm run db:generate` is not required for a fresh setup. `npm run db:seed` creates the demo factory, roles, five demo users, and baseline master data; it is deterministic and safe to rerun. Run generation only after changing `src/lib/db/schema.ts`:

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
| `/orders` | Phase 2 route shell |
| `/purchases` | Live purchase order, goods receipt, and supplier workflow |
| `/inventory` | Live stock, batch, movement, alert, and adjustment workspace |
| `/recipes` | Phase 2 route shell |
| `/production` | Phase 2 route shell |
| `/finished-goods` | Phase 2 route shell |
| `/invoices` | Phase 2 route shell |
| `/dispatch` | Phase 2 route shell |
| `/collections` | Phase 2 route shell |
| `/audit` | Phase 2 route shell |
| `/batch-dna` | Batch DNA concept visualization |
| `/offline` | Protected service-worker offline fallback |
| `/unauthorized` | Role-based access denied state |
| `/api/auth/login` | Validates credentials and sets the httpOnly session cookie |
| `/api/auth/logout` | Revokes the session on the server and clears the cookie |
| `/api/purchases/*` | Server-authorized supplier, purchase order, status, and goods receipt APIs |
| `/api/inventory/*` | Server-authorized stock query, detail, overview, and adjustment APIs |

All application routes except `/login`, `/session-expired`, the authentication APIs, and the root not-found state require a valid server-validated session. Purchases and inventory write through server-side workflow services; the remaining route shells are real destinations that state their status without simulating workflows.

## Demo accounts

Run `npm run db:seed` before signing in. The sign-in console can fill these credentials with one click.

| Role | Email | Password | Landing view |
| --- | --- | --- | --- |
| Owner | `owner@graintrace.local` | `Owner!2026` | `/` |
| Admin | `admin@graintrace.local` | `Admin!2026` | `/` |
| Salesman | `salesman@graintrace.local` | `Sales!2026` | `/orders` |
| Production | `production@graintrace.local` | `Production!2026` | `/production` |
| Accountant | `accountant@graintrace.local` | `Accounts!2026` | `/invoices` |

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
src/components/system/  System-level client components
src/components/ui/      Reusable shadcn-style primitives
src/domain/             Pure money, unit, inventory, costing, production, tax, invoice, payment, and order rules
src/lib/auth/           Password hashing, sessions, permissions, and login service
src/lib/data/           Zod-validated preview snapshot
src/lib/db/             Drizzle schema, connection, migrations, and seed
src/lib/domain/         Preview schema and inferred types
src/lib/offline/        IndexedDB mutation queue
src/lib/workflows/      Transactional purchasing and inventory services
src/lib/format.ts       Presentation helpers
src/lib/navigation.ts   Route registry
src/tests/              Vitest setup and suites
```

## Phase 1, Phase 2, Phase 3, and Phase 4 scope

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
- Server-side role authorization on pages and APIs; purchase posting and inventory adjustment permissions are separate.

Not implemented:

- Workflows outside purchases and inventory, such as recipes, production, finished goods, invoices, payments, dispatch, collections, and audit reporting.
- Report generation despite the report libraries being installed.
- Offline write synchronization; the queue foundation exists, but workflow writes require a live server.
- Business reports and exports; the supplied calculations are implemented in the pure domain layer but no live report or export screen consumes them.
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

Phase 1, Phase 2, Phase 3, and Phase 4 are committed checkpoints. Do not commit secrets or local database files. Demo passwords are documentation-only credentials for local evaluation.

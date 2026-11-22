# GRAINTRACE

Every packet produced. Every gram accounted for.

GRAINTRACE is a manufacturing intelligence system for small food manufacturers, organized around the material journey from salesman order through audit. This repository contains **Phase 1: Foundation & Design System** only. All displayed data is explicitly labeled preview data; no business workflows are active.

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
npm run dev
```

Then open `http://localhost:3000`.

The initial Drizzle migration is committed, so `npm run db:generate` is not required for a fresh setup. Run it only after changing `src/lib/db/schema.ts`:

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
| `npm run db:studio` | Open Drizzle Studio. |
| `npm run verify` | Run typecheck, lint, tests, and production build in sequence. |

## Routes

| Route | Status |
| --- | --- |
| `/` | Factory overview with preview data |
| `/orders` | Phase 2 route shell |
| `/purchases` | Phase 2 route shell |
| `/inventory` | Phase 2 route shell |
| `/recipes` | Phase 2 route shell |
| `/production` | Phase 2 route shell |
| `/finished-goods` | Phase 2 route shell |
| `/invoices` | Phase 2 route shell |
| `/dispatch` | Phase 2 route shell |
| `/collections` | Phase 2 route shell |
| `/audit` | Phase 2 route shell |
| `/batch-dna` | Batch DNA concept visualization |
| `/offline` | Service-worker offline fallback |

Route shells are real destinations that state their status. They do not simulate workflows.

## Project structure

```text
docs/                   Source brief, requirements, plan, architecture, design system
drizzle/                Generated SQL migrations
public/                 PWA manifest, icon, service worker
src/app/                App Router pages and global styles
src/components/layout/  Application shell and navigation
src/components/overview/ Factory overview sections
src/components/system/  System-level client components
src/components/ui/      Reusable shadcn-style primitives
src/lib/data/           Zod-validated preview snapshot
src/lib/db/             Drizzle schema, connection, migration runner
src/lib/domain/         Preview schema and inferred types
src/lib/offline/        IndexedDB mutation queue
src/lib/format.ts       Presentation helpers
src/lib/navigation.ts   Route registry
src/tests/              Vitest setup and suites
```

## Phase 1 scope

Implemented:

- Next.js 14 App Router, TypeScript, Tailwind, shadcn/ui conventions, Framer Motion, Recharts.
- SQLite, Drizzle ORM, Zod, Vitest, ExcelJS, and `@react-pdf/renderer`.
- Design tokens, Geist typography, and monospaced technical data treatment.
- Responsive navigation, application shell, and factory overview.
- Loading, empty, error, not-found, and offline states.
- Explicit route structure for all eleven material-journey stages.
- PWA manifest, service worker shell cache, and native IndexedDB mutation queue.
- Reusable UI primitives and a Zod-validated preview dataset.

Not implemented:

- Any business workflow, approval, transaction, or quantity ledger.
- Authentication and role permissions.
- Report generation despite the report libraries being installed.
- Live database-backed pages.
- Offline write synchronization.
- Business calculations, reports, and benchmarks that were not supplied in the source brief.
- Upstream security advisories affecting the mandated Next.js 14 line and a transitive ExcelJS dependency; fixes require stack changes that were not authorized in Phase 1.

## Verification

```powershell
npm run verify
```

Responsive behavior is checked at 375px, 768px, 1024px, and 1440px with `npm run verify:responsive` while a server is running on port 3100:

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
- `docs/DESIGN_SYSTEM.md` — visual and interaction system

## Git

Phase 1 is committed as a foundation checkpoint. Do not commit secrets or local database files.

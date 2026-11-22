# GRAINTRACE — Architecture

## System intent

GRAINTRACE is a material-journey accountability system. The architecture must make quantity and transaction provenance easy to trace from salesman order through audit, while the interface presents that provenance as an operational surface rather than a generic dashboard.

Phase 1 is intentionally foundation-only. It establishes the runtime, design tokens, route topology, data workflow, and honest preview experience. It does not implement the manufacturing workflows.

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
| Validation | Zod | Fixed stack; validates preview snapshot and offline queue payloads. |
| Tests | Vitest + Testing Library + fake-indexeddb | Fixed stack plus focused test adapters. |
| Excel export | ExcelJS | Fixed stack; installed for future reports. |
| PDF export | `@react-pdf/renderer` | Fixed stack; installed for future documents. |
| PWA | Manifest, custom service worker, native IndexedDB | Fixed stack; avoids a heavyweight framework plugin while keeping behavior explicit. |

No stack changes were made. `geist` font package was removed after scaffold inspection because the Next scaffold already ships local Geist font files.

## Directory structure

```text
src/
├── app/
│   ├── (modules)/               Future journey-stage routes
│   ├── offline/                 Offline fallback page
│   ├── error.tsx                Route-level error boundary
│   ├── globals.css              Tokens and base styles
│   ├── layout.tsx               Root shell, fonts, metadata, PWA manifest
│   ├── loading.tsx              Overview loading skeleton
│   ├── not-found.tsx            Unknown-route state
│   └── page.tsx                 Factory overview
├── components/
│   ├── layout/                  App shell, header, footer, mobile navigation
│   ├── overview/                Overview-specific compositions
│   ├── system/                  Preview badge, reveal, connection status, module page
│   └── ui/                      Reusable shadcn-style primitives
├── lib/
│   ├── data/preview.ts          Zod-validated preview snapshot
│   ├── db/                      Drizzle schema, connection, migration runner
│   ├── domain/preview.ts        Preview schema and inferred types
│   ├── format.ts                Number and currency presentation helpers
│   ├── navigation.ts            Single source of truth for routes
│   ├── offline/queue.ts         Native IndexedDB mutation queue
│   └── utils.ts                 Class merge utility
└── tests/                       Vitest setup and test suites
```

## Request and data flow

```text
Browser request
  → Next.js App Router
  → Root layout + AppShell
  → Route component
  → Zod-validated preview snapshot or module status component
  → Reusable UI primitives
  → Browser

Client-only concerns:
  → ConnectionStatus reads navigator.onLine and IndexedDB queue count
  → ServiceWorkerRegistration registers /sw.js
  → Reveal and BatchDnaPanel apply restrained motion
```

No Phase 1 page imports the database connection. SQLite and Drizzle are configured and migrated but deliberately isolated from rendering so the foundation cannot imply live transactional behavior.

## Route map

| Route | Purpose | Status |
| --- | --- | --- |
| `/` | Factory overview | Implemented with preview data |
| `/orders` | Salesman orders | Route shell; workflow in Phase 2 |
| `/purchases` | Purchase stage | Route shell; workflow in Phase 2 |
| `/inventory` | Raw material inventory | Route shell; workflow in Phase 2 |
| `/recipes` | Recipe stage | Route shell; workflow in Phase 2 |
| `/production` | Production stage | Route shell; workflow in Phase 2 |
| `/finished-goods` | Finished goods | Route shell; workflow in Phase 2 |
| `/invoices` | Invoice stage | Route shell; workflow in Phase 2 |
| `/dispatch` | Dispatch stage | Route shell; workflow in Phase 2 |
| `/collections` | Collection stage | Route shell; workflow in Phase 2 |
| `/audit` | Audit stage | Route shell; workflow in Phase 2 |
| `/batch-dna` | Signature trace concept | Concept visualization only |
| `/offline` | Offline fallback | Implemented |

Overview links preserve preview references in query strings (for example `/orders?focus=SO-2481`). The destination route reads and displays the reference. This makes each link functional without pretending the workflow exists.

## Database design

Phase 1 schema contains one foundational table:

- `factories`: `id`, `code`, `name`, `timezone`, `created_at`.

Migration workflow:

1. Edit `src/lib/db/schema.ts`.
2. Run `npm run db:generate` to create a SQL migration in `drizzle/`.
3. Run `npm run db:migrate` to apply migrations to `data/graintrace.db`.
4. Use `npm run db:studio` for local inspection.

`DATABASE_URL` defaults to `./data/graintrace.db`. Local database files are ignored by Git.

The domain schema for orders, lots, batches, invoices, ledger entries, and audit events is intentionally deferred to Phase 2, after missing business rules are supplied.

## Offline architecture

- `public/manifest.webmanifest` provides install metadata.
- `public/sw.js` caches the shell and previously visited same-origin GET responses; navigations are network-first with cached fallback to `/offline`.
- `ServiceWorkerRegistration` registers the worker after load and fails silently if unsupported.
- `src/lib/offline/queue.ts` creates IndexedDB database `graintrace-offline` with store `mutation_queue`.
- Queue records are validated with Zod and expose enqueue, list, count, and remove operations.
- `ConnectionStatus` displays actual `navigator.onLine` state and real queue count.
- No Phase 1 interaction enqueues a mutation, because no writable workflow exists.

## UI architecture

- `AppShell` owns skip link, header, main landmark, footer, and service-worker registration.
- `SiteHeader` uses `usePathname` for active route state; `MobileNav` uses a Radix Dialog sheet.
- `navigation.ts` is the single source of route labels, indexes, and phases.
- Overview sections use different structures: split editorial heading, split chart, horizontal flow rail, table, meter list, dark exception ledger, signal action band, timeline, and Batch DNA strand.
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
- Verification commands: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`.

Browser responsive and console-error checks are automated by `scripts/responsive-check.mjs` using Puppeteer Core and an installed Chrome or Edge binary. The script checks 375px, 768px, 1024px, and 1440px plus representative routes and a not-found route.

## Known architectural limitations

- No authentication or authorization layer.
- No live repository-backed data on any page.
- No transaction ledger or quantity conservation enforcement yet.
- No synchronization backend for the offline queue.
- Service worker caches GET responses only; it does not synchronize writes.
- Business calculations, reports, and benchmarks are undefined in the source brief.
- The initial migration seeds no factory record; setup instructions describe how to seed one manually if needed.
- `npm audit --omit=dev` reports advisories against the Next.js 14 line whose published fixes require Next.js 15.5+ or 16, plus a transitive `uuid` advisory through ExcelJS. The fixed stack was retained as instructed; these must be reviewed before public deployment.

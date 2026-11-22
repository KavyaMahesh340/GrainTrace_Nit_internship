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

## Following phase

Order-to-purchase workflows and repository-backed overview data remain deferred until their business rules are supplied. No subsequent phase begins automatically.

## Phase 3 — Recipe, production, and finished goods

Planned scope:

- Recipe versions and ingredient ratios.
- Production batches, input weighing, output recording, and exceptions.
- Finished-goods packets and lot linkage.
- Physical Batch DNA trace across raw material, production, and finished goods.
- Manufacturing calculation tests once formulas are supplied.

## Phase 4 — Invoice, dispatch, collection, and audit

Planned scope:

- Invoice generation and collection tracking.
- Dispatch challans and delivery confirmation.
- Append-only audit events across every state change.
- Reconciliation views that prove quantity and transaction accountability.

## Phase 5 — Reports, exports, and offline synchronization

Planned scope:

- ExcelJS-based operational exports.
- `@react-pdf/renderer` document generation.
- Report definitions supplied by the product owner.
- Offline queue synchronization with conflict handling and retry states.
- Accessibility and performance audits against supplied benchmarks.

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

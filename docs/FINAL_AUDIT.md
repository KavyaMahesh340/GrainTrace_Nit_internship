# GRAINTRACE — Final Engineering Audit

## Scope

Phase 9 audited the complete Phase 1–8 implementation against the source brief, requirements, architecture, benchmark, and role/permission rules. The audit covered finance arithmetic, inventory ledger integrity, workflow transitions, authorization, API validation, offline queue recovery, PWA behavior, responsive behavior, setup evidence, and documentation accuracy.

## Method

1. Independent source audits of finance/inventory, workflow/security, offline/PWA/UI, and requirements/evidence.
2. Fixes applied through the existing workflow services and domain rules; no business logic was duplicated in UI routes or API handlers.
3. Regression tests added for each material defect.
4. Clean migration and seed applied to a fresh temporary SQLite database.
5. Full typecheck, lint, test, production build, and responsive/PWA checks executed against the final source.

## Findings and fixes

| Area | Finding | Resolution |
| --- | --- | --- |
| Dispatch cancellation | Cancelling a posted dispatch did not reverse packets, fulfilled quantity, order status, or the stock ledger. `updateDispatchStatus` also accepted invalid transitions. | `src/lib/workflows/dispatch.ts` now enforces an allow-list, clears `deliveredAt`, releases packets, decrements fulfilment, recomputes order status, and posts an append-only `DISPATCH_CANCELLATION` reversal. |
| Invoice cancellation | Cancelling a paid invoice did not return paid cash to `amountPaidPaise` and did not release `invoicedPackets`. | `src/lib/workflows/invoices.ts` posts a debit refund payment, clears invoice `amountPaidPaise`, and decrements `invoicedPackets`. |
| Ledger authority | Stored available balances were written directly by several workflows, allowing drift from the append-only ledger. | `src/lib/workflows/ledger.ts` is now the single writer for stored balances. It derives balances from `postStockMovement`, converts finished-good packets using `products.packetGrams`, and records `quantityDeltaGrams`/`balanceGrams`. |
| Duplicate stock postings | Ledger rows had no database-level movement identity. | Added `stockLedger.movementKey` plus a factory-scoped unique index in `src/lib/db/schema.ts` and migration `drizzle/0007_violet_abomination.sql`, including a deterministic backfill for existing rows. |
| Customer ledger report | Invoice and receipt debit/credit signs were inconsistent. | `src/lib/workflows/reports.ts` maps invoices to debit, positive receipts to credit, and negative corrections to debit. |
| Product profitability report | Revenue included tax and negative margins were clamped to zero. | Revenue now uses `taxablePaise`, tax is reported separately, and margin is calculated without clamping. |
| Production variance report | `productId` filter was ignored. | `productionCostVariance()` resolves the filter through `getReportOptions()` and rejects unknown product IDs with an empty result. |
| Payment corrections | Partial corrections marked the original receipt as fully `corrected`. | Original receipts now use `partially_corrected` unless the full amount has been corrected; audit `afterJson` records the same status. |
| Auditor role | `"auditor"` was omitted from the shared role schema, causing login/session validation failure. | `src/lib/auth/validation.ts` now derives the enum from `ROLES`. |
| API validation | Four POST APIs cast request bodies without Zod parsing; report/audit GET routes did not map `ZodError`; order status API required only view permission. | Request parsing now uses the workflow Zod schemas, errors use `apiErrorResponse`, and order status changes require `orders:manage`. |
| Order list cost | `listSalesOrders()` loaded all records before filtering and limiting. | Status/query filters now run in SQL with a bounded 200-row result. |
| Inventory overview cost | Batch balances caused N+1 ledger loads. | Added `loadStockLedgerGroups()` and grouped loading in `src/lib/workflows/inventory.ts`. |
| Offline stale state | A `syncing` record remained stuck after a crash or hung request. | Queue v2 adds `resetStaleSyncingOrders`, sync calls it before replay, and fetch uses a 15-second abort timeout. |
| Offline edit semantics | Editing a failed record reused its idempotency key and could silently discard the edit. | Only drafts are editable; other records expose Reset or Remove actions. |
| Offline queue migration | Existing v2 stores could miss new indexes. | Queue upgrade now creates the `idempotencyKey` and `state` indexes when the store already exists. |
| Offline fallback | The page had a dead “Return” link, claimed encrypted browser storage, and hid the local queue panel when empty. | `src/components/system/offline-page-content.tsx` gives online-aware actions, accurate IndexedDB wording, cached reference counts, and an always-visible local queue section. |
| Service worker install | One failed asset could abort cache installation. | `public/sw.js` uses `Promise.allSettled` and cache version `graintrace-shell-v9`. |
| Responsive check | Expected 404s were suppressed and offline/PWA assets were not checked per viewport. | `scripts/responsive-check.mjs` now checks the public fallback, local queue panel, PWA assets, and horizontal overflow at every viewport. |
| Documentation | README called `/offline` protected and had stale counts; final audit and benchmark result documents were missing; Docker instructions were absent. | README, architecture, implementation plan, requirements, and final reports were updated; Dockerfile, `.dockerignore`, and `docker-compose.yml` were added. |

## Verification evidence

Executed on 2026-11-22 with Node.js `v22.19.0` and npm `11.21.1`.

| Check | Result |
| --- | --- |
| Clean `npm run db:migrate` | Passed; migration `0007_violet_abomination` included. |
| Clean `npm run db:seed` | Passed. |
| Phase 3 benchmark suite | 9 tests passed. |
| `npm run typecheck` | Passed with no errors. |
| `npm run lint` | Passed with no warnings or errors. |
| `npm test` | 11 files, 49 tests passed. |
| `npm run build` | Passed; 48 pages generated. |
| `npm run verify:responsive` | Passed at 375px, 768px, 1024px, and 1440px; 7 route checks, mobile offline console, PWA assets, and public fallback verified. |
| Docker artifacts | `Dockerfile`, `.dockerignore`, and `docker-compose.yml` added; not built or run because the Docker CLI is not installed in this environment. |

## Honest limitations

- Recipes and finished goods remain explicit route shells by design.
- Offline write support covers salesman order entry only; other workflows remain server-connected.
- The Docker configuration was authored but could not be executed locally; no claim of a successful container build is made.
- Upstream security advisories affecting the mandated Next.js 14 line and a transitive ExcelJS dependency remain documented; no unauthorized stack change was made.

## Conclusion

All discovered implementation defects were fixed or explicitly recorded as environmental/design limitations. The final source passes the mandated verification commands and the benchmark values remain unchanged.

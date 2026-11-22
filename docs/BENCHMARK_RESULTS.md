# GRAINTRACE — Benchmark Results

## Run context

- Date: 2026-11-22
- Node.js: `v22.19.0`
- npm: `11.21.1`
- Workspace: repository root
- Database: fresh temporary SQLite file at `C:\Users\mahes\AppData\Local\Temp\opencode\graintrace-phase9-benchmark.db`
- Vitest environment: `DATABASE_URL=":memory:"` as configured in `vitest.config.ts`; the clean temporary database was used to prove migration and seed from empty storage.

## Commands

```powershell
$db = "C:\Users\mahes\AppData\Local\Temp\opencode\graintrace-phase9-benchmark.db"
if (Test-Path -LiteralPath $db) { Remove-Item -LiteralPath $db -Force }
$env:DATABASE_URL = $db
npm run db:migrate
npm run db:seed
npm test -- src/tests/benchmark.test.ts
```

Observed output:

- `GrainTrace migrations applied to C:\Users\mahes\AppData\Local\Temp\opencode\graintrace-phase9-benchmark.db`
- `GrainTrace demo data seeded.`
- `src/tests/benchmark.test.ts`: 9 tests passed.
- Full suite after final fixes: 11 files and 49 tests passed.

## Closing stock

| Item | Expected | Actual | Status |
| --- | ---: | ---: | --- |
| Flour | 120 kg | 120 kg | Pass |
| Oil | 19.5 L | 19.5 L | Pass |
| Spice | 3.8 kg | 3.8 kg | Pass |
| Pouches | 306 pieces | 306 pieces | Pass |
| Cartons | 21 pieces | 21 pieces | Pass |
| Finished goods after production | 238 packets | 238 packets | Pass |
| Finished goods after Retailer A dispatch | 88 packets | 88 packets | Pass |

## Costing and yield

| Metric | Expected | Actual | Status |
| --- | ---: | ---: | --- |
| Material cost | ₹4,055 | ₹4,055 | Pass |
| Labour | ₹1,200 | ₹1,200 | Pass |
| Gas | ₹600 | ₹600 | Pass |
| Total run cost | ₹5,855 | ₹5,855 | Pass |
| Good output | 188 packets | 188 packets | Pass |
| Cost per good packet | ₹31.14 | ₹31.14 | Pass |
| Gross margin per packet | ₹18.86 | ₹18.86 | Pass |
| Gross margin percentage | 37.72% | 37.72% | Pass |
| Markup on cost | 60.57% | 60.57% | Pass |
| Yield variance | -6% | -6% | Pass |
| Oil variance | +5% | +5% | Pass |

## Retailer A invoice and payment

| Metric | Expected | Actual | Status |
| --- | ---: | ---: | --- |
| Fulfilled quantity | 150 packets | 150 packets | Pass |
| Taxable value | ₹7,500 | ₹7,500 | Pass |
| CGST | ₹187.50 | ₹187.50 | Pass |
| SGST | ₹187.50 | ₹187.50 | Pass |
| Total tax | ₹375 | ₹375 | Pass |
| Invoice total | ₹7,875 | ₹7,875 | Pass |
| Payment recorded | ₹4,000 | ₹4,000 | Pass |
| Outstanding | ₹3,875 | ₹3,875 | Pass |

## Distributor B fulfillment and IGST

| Metric | Expected | Actual | Status |
| --- | ---: | ---: | --- |
| Ordered quantity | 120 packets | 120 packets | Pass |
| Available finished goods | 88 packets | 88 packets | Pass |
| Fulfillable quantity | 88 packets | 88 packets | Pass |
| Shortage / backorder | 32 packets | 32 packets | Pass |
| Benchmark IGST on 120 packets | ₹300 | ₹300 | Pass |
| Actual taxable value on 88 packets | ₹4,400 | ₹4,400 | Pass |
| Actual IGST on 88 packets | ₹220 | ₹220 | Pass |

## Integrity checks

- Integer paise and rational unit costs produced no floating-point financial results.
- Append-only ledger balances matched closing stock.
- Duplicate postings, negative stock, invalid unit conversions, over-dispatch, over-invoice, and overpayment cases were rejected.
- Weighted average cost remained at ₹43.125/kg for the posted benchmark snapshot after a later ₹60/kg flour receipt.
- No expected benchmark value was changed during Phase 9.

## Final verification

```powershell
npm run verify
npm run verify:responsive
```

`npm run verify` passed typecheck, lint, all 49 tests, and the production build. `npm run verify:responsive` passed at 375px, 768px, 1024px, and 1440px with 7 route checks plus PWA and public offline fallback checks.

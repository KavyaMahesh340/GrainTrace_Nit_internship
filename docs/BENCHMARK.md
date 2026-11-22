# GRAINTRACE — Benchmark Report

## Purpose

This report records the deterministic Phase 3 benchmark implemented in `src/domain/benchmark.ts` and verified by `src/tests/benchmark.test.ts`. The fixture reproduces the supplied calculations without React, database access, or UI state. It is an acceptance fixture for the domain engine, not live factory data.

The benchmark distinguishes two different things:

- **Benchmark calculation:** the fixed 120-packet Distributor B example used to prove interstate GST math.
- **Actual posting:** invoices are always based on quantities that can really be fulfilled from available finished goods.

## Numerical policy

- Money is represented as integer paise. formatting to rupees happens only at presentation time.
- Unit costs are rational values (`numerator / denominator`) so ₹43.125/kg remains exact.
- Physical quantities are stored in base units: grams, millilitres, and pieces.
- Stock balances are derived from an append-only ledger. Balances are never overwritten.
- Every stock movement carries a source type and source reference.
- Weighted average cost is calculated from available inventory at the posting moment.
- Production costs are copied into an immutable snapshot at posting. Later receipts cannot rewrite them.
- GST is calculated with integer basis points and paise rounding.

## Deterministic fixture

### Receipts and opening stock

| Item | Receipt | Base quantity | Cost basis | Value |
| --- | --- | ---: | ---: | ---: |
| Flour | 100 kg | 100,000 g | ₹42/kg | ₹4,200 |
| Flour | 60 kg | 60,000 g | ₹45/kg | ₹2,700 |
| Oil | 34.2 L | 34,200 ml | ₹100/L | ₹3,420 |
| Spice | 7.8 kg | 7,800 g | ₹60/kg | ₹468 |
| Pouches | 506 pieces | 506 | ₹2.425/piece | ₹1,227.05 |
| Cartons | 66 pieces | 66 | ₹3/carton | ₹198 |
| Finished goods | Opening stock | 50 packets | Not used in costing | — |

### Production and dispatch

| Event | Source reference | Quantity |
| --- | --- | ---: |
| Planned output | `RUN-BENCH-001` | 200 packets |
| Actual output | `RUN-BENCH-001` | 200 packets |
| Damaged output | `RUN-BENCH-001` | 12 packets |
| Good output | `RUN-BENCH-001` | 188 packets |
| Retailer A dispatch | `DSP-BENCH-RETAILER-A` | 150 packets |

## Closing-stock results

| Target | Result | Status |
| --- | ---: | --- |
| Flour closing stock | 120 kg | Pass |
| Oil closing stock | 19.5 L | Pass |
| Pouches closing stock | 306 | Pass |
| Cartons closing stock | 21 | Pass |
| Spice closing stock | 3.8 kg | Pass |
| Finished goods after production | 238 packets | Pass |
| Finished goods after Retailer A dispatch | 88 packets | Pass |

Opening finished goods of 50 packets plus 188 good packets gives 238 packets before dispatch. Dispatch of 150 packets leaves 88 packets; no negative stock is permitted.

## Costing results

Flour weighted average cost:

```text
(100 kg × ₹42 + 60 kg × ₹45) / 160 kg = ₹43.125/kg
```

| Cost line | Quantity | Unit cost | Cost |
| --- | ---: | ---: | ---: |
| Flour | 40 kg | ₹43.125/kg | ₹1,725 |
| Oil | 14.7 L | ₹100/L | ₹1,470 |
| Spice | 4 kg | ₹60/kg | ₹240 |
| Packaging pouches | 200 | ₹2.425/piece | ₹485 |
| Cartons | 45 | ₹3/carton | ₹135 |
| **Total material cost** |  |  | **₹4,055** |
| Labour |  |  | ₹1,200 |
| Gas |  |  | ₹600 |
| **Total run cost** |  |  | **₹5,855** |

| Metric | Result |
| --- | ---: |
| Good output | 188 packets |
| Cost per good packet | ₹31.14 |
| Selling price | ₹50.00 |
| Gross margin per packet | ₹18.86 |
| Gross margin percentage | 37.72% |
| Markup on cost | 60.57% |

Margin and markup are deliberately separate. Gross margin is profit divided by selling price. Markup is profit divided by cost.

Oil usage is 14.7 L against a planned 14 L, so actual oil cost is ₹1,470. The snapshot captures the weighted average costs at posting; a later ₹60/kg flour receipt changes the current weighted average to ₹45/kg but does not change the recorded ₹43.125/kg flour line.

## Variance results

Default tolerance is 3%. A variance is flagged only when its absolute value exceeds the tolerance.

| Variance | Planned | Actual | Result | Status |
| --- | ---: | ---: | ---: | --- |
| Yield | 200 packets | 188 good packets | -6% | Flagged |
| Oil | 14 L | 14.7 L | +5% | Flagged |
| Flour | 40 kg | 40 kg | 0% | Within tolerance |
| Spice | 4 kg | 4 kg | 0% | Within tolerance |
| Pouches | 200 | 200 | 0% | Within tolerance |
| Cartons | 45 | 45 | 0% | Within tolerance |

## Retailer A invoice and payment

| Item | Result |
| --- | ---: |
| Fulfilled quantity | 150 packets |
| Taxable value | ₹7,500 |
| HSN | 110100 |
| GST rate | 5% |
| Jurisdiction | Intra-state, Maharashtra to Maharashtra |
| CGST | ₹187.50 |
| SGST | ₹187.50 |
| Total tax | ₹375 |
| Invoice total | ₹7,875 |
| Payment recorded | ₹4,000 |
| Outstanding | ₹3,875 |

## Distributor B order

| Item | Result |
| --- | ---: |
| Ordered quantity | 120 packets |
| Available finished goods | 88 packets |
| Fulfillable quantity | 88 packets |
| Backorder / shortage | 32 packets |
| Benchmark interstate IGST on 120 packets | ₹300 |
| Actual taxable value on 88 fulfilled packets | ₹4,400 |
| Actual interstate IGST on 88 fulfilled packets | ₹220 |

The ₹300 IGST figure is the supplied benchmark calculation for the full 120-packet example. A real invoice for this scenario can only be posted for the 88 packets that exist, producing ₹220 IGST. The domain engine does not post an invoice beyond available stock.

## Edge cases verified

- Exact kilogram, gram, litre, millilitre, and piece conversions.
- Rejection of dimension mismatch, non-integral exact conversions, and negative quantities.
- Append-only stock ledger with source references and duplicate-posting rejection.
- Insufficient stock and negative-balance prevention.
- Direct dispatch rejection when requested quantity exceeds available packets.
- Weighted average cost, including fractional paise per base unit.
- Tax split, odd-paise rounding, HSN validation, and state-based jurisdiction resolution.
- Production variance tolerance and flagged exceptions.
- Immutable production cost snapshots after later purchases.
- Payment recording, outstanding balance, duplicate-payment rejection, and overpayment prevention.
- Partial fulfilment and backorder calculation.

## Verification

```powershell
npm test
npm run verify
```

`npm test` runs `src/tests/benchmark.test.ts` with the full Vitest suite. `npm run verify` also runs typecheck, lint, and production build.

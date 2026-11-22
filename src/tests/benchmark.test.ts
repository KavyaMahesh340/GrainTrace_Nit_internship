import { describe, expect, it } from "vitest";
import {
  assertDispatchable,
  assertHsnCode,
  benchmarkActualMaterialUsage,
  benchmarkCostOfUsage,
  benchmarkDistributorActualInvoice,
  benchmarkDistributorBenchmarkTax,
  benchmarkDistributorOrder,
  benchmarkExpectations,
  benchmarkFutureFlourReceipt,
  benchmarkLedger,
  benchmarkLedgerThroughProduction,
  benchmarkMaterialVariances,
  benchmarkMetrics,
  benchmarkPlannedMaterialUsage,
  benchmarkRawMaterialReceipts,
  benchmarkRetailerInvoice,
  benchmarkRetailerPayment,
  benchmarkSnapshot,
  benchmarkUnitCosts,
  calculateAmountPaid,
  calculateMaterialVariances,
  calculateOutstandingBalance,
  calculateStockBalance,
  calculateWeightedAverageCost,
  calculateGst,
  convertQuantity,
  convertQuantityToRational,
  createRational,
  createProductionCostSnapshot,
  deriveInvoicePaymentStatus,
  DuplicatePostingError,
  InsufficientStockError,
  OverpaymentError,
  planMaterialUsage,
  postStockMovement,
  recordPayment,
  resolveGstJurisdiction,
  toBaseQuantity,
  UnitConversionError,
  ValidationError,
  type PostedStockMovement,
} from "@/domain";

describe("phase 3 benchmark", () => {
  it("matches every closing-stock target from the benchmark", () => {
    const closing = benchmarkExpectations.closingBaseQuantity as Record<string, number>;
    for (const [itemId, expected] of Object.entries(closing)) {
      expect(calculateStockBalance(benchmarkLedger, itemId)).toBe(expected);
    }

    expect(calculateStockBalance(benchmarkLedgerThroughProduction, "FINISHED_GOODS")).toBe(238);
    expect(calculateStockBalance(benchmarkLedger, "FINISHED_GOODS")).toBe(88);
  });

  it("converts units exactly and rejects inconsistent conversions", () => {
    expect(convertQuantity(1, "kg", "g")).toBe(1_000);
    expect(convertQuantity(1_000, "g", "kg")).toBe(1);
    expect(convertQuantity(12, "packet", "piece")).toBe(12);
    expect(convertQuantityToRational(19_500, "ml", "l")).toEqual(createRational(39, 2));
    expect(convertQuantityToRational(3_800, "g", "kg")).toEqual(createRational(19, 5));

    expect(() => convertQuantity(1, "g", "ml")).toThrow(UnitConversionError);
    expect(() => convertQuantity(1_500, "g", "kg")).toThrow(UnitConversionError);
    expect(() => toBaseQuantity(-1, "kg")).toThrow(ValidationError);
    expect(() => toBaseQuantity(1.5, "kg")).toThrow(ValidationError);
  });

  it("prevents negative stock, duplicate posting, over-dispatch, and invalid quantities", () => {
    const opening = postStockMovement([], {
      movementId: "TEST-OPENING",
      itemId: "TEST_ITEM",
      baseUnit: "pieces",
      quantityDelta: 10,
      sourceType: "TEST",
      sourceReference: "TEST-SOURCE-1",
      occurredAt: "2026-03-01T00:00:00.000Z",
    });

    expect(calculateStockBalance(opening, "TEST_ITEM")).toBe(10);
    expect(() =>
      postStockMovement(opening, {
        movementId: "TEST-ISSUE",
        itemId: "TEST_ITEM",
        baseUnit: "pieces",
        quantityDelta: -11,
        sourceType: "TEST",
        sourceReference: "TEST-SOURCE-2",
        occurredAt: "2026-03-02T00:00:00.000Z",
      }),
    ).toThrow(InsufficientStockError);
    expect(() => postStockMovement(opening, opening[0])).toThrow(DuplicatePostingError);
    expect(() => assertDispatchable(120, 88)).toThrow(InsufficientStockError);
    expect(() => assertDispatchable(0, 88)).toThrow(ValidationError);
    expect(() => assertDispatchable(150, 238)).not.toThrow();
  });

  it("computes weighted average cost and the benchmark material-cost snapshot", () => {
    expect(benchmarkUnitCosts.FLOUR).toEqual(createRational(69, 16));
    expect(benchmarkUnitCosts.OIL).toEqual(createRational(10, 1));
    expect(benchmarkUnitCosts.SPICE).toEqual(createRational(6, 1));
    expect(benchmarkUnitCosts.POUCH).toEqual(createRational(485, 2));
    expect(benchmarkUnitCosts.CARTON).toEqual(createRational(300, 1));

    const expectedCosts = benchmarkExpectations.materialCostByItemPaise as Record<string, number>;
    for (const [itemId, expected] of Object.entries(expectedCosts)) {
      const quantity = benchmarkActualMaterialUsage.find((usage) => usage.itemId === itemId)?.quantity;
      expect(quantity).toBeDefined();
      expect(benchmarkCostOfUsage(itemId, quantity ?? 0)).toBe(expected);
    }

    expect(benchmarkSnapshot.materialCostPaise).toBe(405_500);
    expect(benchmarkSnapshot.labourPaise).toBe(120_000);
    expect(benchmarkSnapshot.gasPaise).toBe(60_000);
    expect(benchmarkSnapshot.overheadPaise).toBe(180_000);
    expect(benchmarkSnapshot.totalRunCostPaise).toBe(585_500);
  });

  it("calculates planned usage, yield, and material variances with the 3% tolerance", () => {
    expect(benchmarkPlannedMaterialUsage).toEqual([
      { itemId: "FLOUR", quantity: 40_000, baseUnit: "grams" },
      { itemId: "OIL", quantity: 14_000, baseUnit: "millilitres" },
      { itemId: "SPICE", quantity: 4_000, baseUnit: "grams" },
      { itemId: "POUCH", quantity: 200, baseUnit: "pieces" },
      { itemId: "CARTON", quantity: 45, baseUnit: "pieces" },
    ]);

    expect(benchmarkMetrics.goodOutputPackets).toBe(188);
    expect(benchmarkMetrics.damagedOutputPackets).toBe(12);
    expect(benchmarkMetrics.yieldVarianceBasisPoints).toBe(-600);
    expect(benchmarkMetrics.yieldFlagged).toBe(true);

    const oil = benchmarkMaterialVariances.find((variance) => variance.itemId === "OIL");
    expect(oil?.varianceBasisPoints).toBe(500);
    expect(oil?.flagged).toBe(true);

    const nonFlagged = benchmarkMaterialVariances.filter((variance) => variance.itemId !== "OIL");
    expect(nonFlagged.every((variance) => variance.varianceBasisPoints === 0)).toBe(true);
    expect(nonFlagged.every((variance) => variance.flagged === false)).toBe(true);

    expect(() =>
      calculateMaterialVariances(benchmarkPlannedMaterialUsage, [
        { itemId: "UNKNOWN", quantity: 1, baseUnit: "pieces" },
      ]),
    ).toThrow(ValidationError);
  });

  it("snapshots posting cost, margin, and overhead allocation independently of later purchases", () => {
    expect(benchmarkSnapshot.costPerGoodPacketPaise).toBe(3_114);
    expect(
      benchmarkSnapshot.materialCostPerGoodPacketPaise +
        benchmarkSnapshot.overheadCostPerGoodPacketPaise,
    ).toBe(3_114);
    expect(benchmarkSnapshot.grossMarginPerPacketPaise).toBe(1_886);
    expect(benchmarkSnapshot.grossMarginBasisPoints).toBe(3_772);
    expect(benchmarkSnapshot.markupBasisPoints).toBe(6_057);
    expect(benchmarkSnapshot.markupBasisPoints).not.toBe(benchmarkSnapshot.grossMarginBasisPoints);

    const receiptLedger = benchmarkRawMaterialReceipts.reduce<PostedStockMovement[]>(
      (ledger, movement) => postStockMovement(ledger, movement),
      [],
    );
    const afterFutureReceipt = postStockMovement(receiptLedger, benchmarkFutureFlourReceipt);
    expect(calculateWeightedAverageCost(afterFutureReceipt, "FLOUR")).toEqual(createRational(9, 2));

    const flourLine = benchmarkSnapshot.materialLines.find((line) => line.itemId === "FLOUR");
    expect(flourLine?.unitCost).toEqual(benchmarkUnitCosts.FLOUR);
    expect(flourLine?.costPaise).toBe(172_500);

    expect(() =>
      createProductionCostSnapshot({
        snapshotId: "SNAP-INVALID",
        runNumber: "RUN-INVALID",
        postedAt: "2026-03-01T00:00:00.000Z",
        goodOutputPackets: 0,
        materialUsages: benchmarkActualMaterialUsage,
        labourPaise: 0,
        gasPaise: 0,
      }),
    ).toThrow(ValidationError);
  });

  it("calculates GST, invoice totals, HSN validation, and paise rounding", () => {
    expect(benchmarkRetailerInvoice.subtotalPaise).toBe(750_000);
    expect(benchmarkRetailerInvoice.tax.cgstPaise).toBe(18_750);
    expect(benchmarkRetailerInvoice.tax.sgstPaise).toBe(18_750);
    expect(benchmarkRetailerInvoice.tax.igstPaise).toBe(0);
    expect(benchmarkRetailerInvoice.tax.totalTaxPaise).toBe(37_500);
    expect(benchmarkRetailerInvoice.totalPaise).toBe(787_500);

    const rounded = calculateGst({
      hsnCode: "110100",
      taxablePaise: 333,
      rateBasisPoints: 500,
      jurisdiction: "intra_state",
    });
    expect(rounded.totalTaxPaise).toBe(17);
    expect(rounded.cgstPaise + rounded.sgstPaise).toBe(17);

    expect(resolveGstJurisdiction("Maharashtra", "Maharashtra")).toBe("intra_state");
    expect(resolveGstJurisdiction("Maharashtra", "Madhya Pradesh")).toBe("inter_state");
    expect(() => assertHsnCode("123")).toThrow(ValidationError);
  });

  it("records partial payments and prevents duplicate or excessive payments", () => {
    expect(calculateAmountPaid(benchmarkRetailerPayment)).toBe(400_000);
    expect(calculateOutstandingBalance(787_500, benchmarkRetailerPayment)).toBe(387_500);
    expect(deriveInvoicePaymentStatus(787_500, benchmarkRetailerPayment)).toBe("partially_paid");

    expect(() =>
      recordPayment(
        benchmarkRetailerPayment,
        {
          paymentId: "PAY-BENCH-RETAILER-A",
          invoiceNumber: "INV-BENCH-RETAILER-A",
          amountPaise: 1,
          method: "cash",
          paidAt: "2026-02-05T00:00:00.000Z",
        },
        787_500,
      ),
    ).toThrow(ValidationError);

    expect(() =>
      recordPayment(
        [],
        {
          paymentId: "PAY-OVER",
          invoiceNumber: "INV-BENCH-RETAILER-A",
          amountPaise: 787_501,
          method: "cash",
          paidAt: "2026-02-05T00:00:00.000Z",
        },
        787_500,
      ),
    ).toThrow(OverpaymentError);
  });

  it("plans partial fulfilment and separates the benchmark IGST from actual invoicing", () => {
    expect(benchmarkDistributorOrder.requestedPackets).toBe(120);
    expect(benchmarkDistributorOrder.fulfillablePackets).toBe(88);
    expect(benchmarkDistributorOrder.backorderPackets).toBe(32);
    expect(benchmarkDistributorOrder.shortagePackets).toBe(32);
    expect(benchmarkDistributorOrder.isPartial).toBe(true);

    expect(benchmarkDistributorBenchmarkTax.igstPaise).toBe(30_000);
    expect(benchmarkDistributorActualInvoice.subtotalPaise).toBe(440_000);
    expect(benchmarkDistributorActualInvoice.tax.igstPaise).toBe(22_000);

    expect(planMaterialUsage(benchmarkRecipeFixture(), 100)[0].quantity).toBe(20_000);
  });
});

function benchmarkRecipeFixture() {
  return {
    code: "RECIPE-ATTA-500-BENCHMARK",
    expectedOutputPackets: 200,
    lines: benchmarkPlannedMaterialUsage,
  };
}

import { calculateWeightedAverageCost, calculateCostOfUsage } from "./costing";
import { postStockMovement, sumConsumptionBySource } from "./inventory";
import { createRational, type Rational } from "./money";
import { createFulfilmentPlan } from "./orders";
import { createTaxInvoice } from "./invoices";
import { recordPayment } from "./payments";
import {
  calculateMaterialVariances,
  calculateProductionMetrics,
  createProductionCostSnapshot,
  DEFAULT_VARIANCE_TOLERANCE_BASIS_POINTS,
  planMaterialUsage,
} from "./production";
import { calculateGst, GST_RATE_BASIS_POINTS } from "./tax";
import type { MaterialUsage, PostedStockMovement, StockMovementInput } from "./types";
import { ValidationError } from "./validation";

export const BENCHMARK_RUN_NUMBER = "RUN-BENCH-001";
export const BENCHMARK_INVOICE_NUMBER = "INV-BENCH-RETAILER-A";
export const BENCHMARK_PACKET_GRAMS = 500;

const RECEIVED_AT = "2026-02-01T09:00:00.000Z";
const PRODUCTION_AT = "2026-02-02T09:00:00.000Z";
const PRODUCTION_POSTED_AT = "2026-02-02T17:00:00.000Z";
const DISPATCHED_AT = "2026-02-03T09:00:00.000Z";
const FUTURE_RECEIVED_AT = "2026-03-01T09:00:00.000Z";

function receipt(input: {
  movementId: string;
  itemId: string;
  baseUnit: "grams" | "millilitres" | "pieces";
  quantity: number;
  totalValuePaise: number;
  sourceReference: string;
  occurredAt?: string;
}): StockMovementInput {
  return {
    movementId: input.movementId,
    itemId: input.itemId,
    baseUnit: input.baseUnit,
    quantityDelta: input.quantity,
    unitCost: createRational(input.totalValuePaise, input.quantity),
    sourceType: "GOODS_RECEIPT",
    sourceReference: input.sourceReference,
    occurredAt: input.occurredAt ?? RECEIVED_AT,
  };
}

function consume(
  movementId: string,
  itemId: string,
  baseUnit: "grams" | "millilitres" | "pieces",
  quantity: number,
): StockMovementInput {
  return {
    movementId,
    itemId,
    baseUnit,
    quantityDelta: -quantity,
    sourceType: "PRODUCTION_RUN",
    sourceReference: BENCHMARK_RUN_NUMBER,
    occurredAt: PRODUCTION_AT,
  };
}

function buildLedger(movements: readonly StockMovementInput[]): PostedStockMovement[] {
  return movements.reduce<PostedStockMovement[]>(
    (ledger, movement) => postStockMovement(ledger, movement),
    [],
  );
}

export const benchmarkRecipe = {
  code: "RECIPE-ATTA-500-BENCHMARK",
  expectedOutputPackets: 200,
  lines: [
    { itemId: "FLOUR", quantity: 40_000, baseUnit: "grams" as const },
    { itemId: "OIL", quantity: 14_000, baseUnit: "millilitres" as const },
    { itemId: "SPICE", quantity: 4_000, baseUnit: "grams" as const },
    { itemId: "POUCH", quantity: 200, baseUnit: "pieces" as const },
    { itemId: "CARTON", quantity: 45, baseUnit: "pieces" as const },
  ],
};

export const benchmarkRawMaterialReceipts: readonly StockMovementInput[] = [
  receipt({
    movementId: "GR-BENCH-FLOUR-01",
    itemId: "FLOUR",
    baseUnit: "grams",
    quantity: 100_000,
    totalValuePaise: 420_000,
    sourceReference: "GR-BENCH-FLOUR-01",
  }),
  receipt({
    movementId: "GR-BENCH-FLOUR-02",
    itemId: "FLOUR",
    baseUnit: "grams",
    quantity: 60_000,
    totalValuePaise: 270_000,
    sourceReference: "GR-BENCH-FLOUR-02",
  }),
  receipt({
    movementId: "GR-BENCH-OIL-01",
    itemId: "OIL",
    baseUnit: "millilitres",
    quantity: 34_200,
    totalValuePaise: 342_000,
    sourceReference: "GR-BENCH-OIL-01",
  }),
  receipt({
    movementId: "GR-BENCH-SPICE-01",
    itemId: "SPICE",
    baseUnit: "grams",
    quantity: 7_800,
    totalValuePaise: 46_800,
    sourceReference: "GR-BENCH-SPICE-01",
  }),
  receipt({
    movementId: "GR-BENCH-POUCH-01",
    itemId: "POUCH",
    baseUnit: "pieces",
    quantity: 506,
    totalValuePaise: 122_705,
    sourceReference: "GR-BENCH-POUCH-01",
  }),
  receipt({
    movementId: "GR-BENCH-CARTON-01",
    itemId: "CARTON",
    baseUnit: "pieces",
    quantity: 66,
    totalValuePaise: 19_800,
    sourceReference: "GR-BENCH-CARTON-01",
  }),
];

export const benchmarkOpeningFinishedGoods: StockMovementInput = {
  movementId: "FG-BENCH-OPENING",
  itemId: "FINISHED_GOODS",
  baseUnit: "pieces",
  quantityDelta: 50,
  sourceType: "OPENING_STOCK",
  sourceReference: "FG-BENCH-OPENING",
  occurredAt: RECEIVED_AT,
};

export const benchmarkProductionConsumptions: readonly StockMovementInput[] = [
  consume("RUN-BENCH-INPUT-FLOUR", "FLOUR", "grams", 40_000),
  consume("RUN-BENCH-INPUT-OIL", "OIL", "millilitres", 14_700),
  consume("RUN-BENCH-INPUT-SPICE", "SPICE", "grams", 4_000),
  consume("RUN-BENCH-INPUT-POUCH", "POUCH", "pieces", 200),
  consume("RUN-BENCH-INPUT-CARTON", "CARTON", "pieces", 45),
];

export const benchmarkProductionOutput: StockMovementInput = {
  movementId: "RUN-BENCH-OUTPUT",
  itemId: "FINISHED_GOODS",
  baseUnit: "pieces",
  quantityDelta: 188,
  sourceType: "PRODUCTION_RUN",
  sourceReference: BENCHMARK_RUN_NUMBER,
  occurredAt: PRODUCTION_AT,
};

export const benchmarkDispatch: StockMovementInput = {
  movementId: "DSP-BENCH-RETAILER-A",
  itemId: "FINISHED_GOODS",
  baseUnit: "pieces",
  quantityDelta: -150,
  sourceType: "DISPATCH",
  sourceReference: "DSP-BENCH-RETAILER-A",
  occurredAt: DISPATCHED_AT,
};

const ledgerInputsThroughProduction: readonly StockMovementInput[] = [
  ...benchmarkRawMaterialReceipts,
  benchmarkOpeningFinishedGoods,
  ...benchmarkProductionConsumptions,
  benchmarkProductionOutput,
];

export const benchmarkLedgerThroughProduction = buildLedger(ledgerInputsThroughProduction);
export const benchmarkLedger = buildLedger([...ledgerInputsThroughProduction, benchmarkDispatch]);
const benchmarkReceiptLedger = buildLedger(benchmarkRawMaterialReceipts);

export const benchmarkUnitCosts: Record<string, Rational> = {
  FLOUR: calculateWeightedAverageCost(benchmarkReceiptLedger, "FLOUR"),
  OIL: calculateWeightedAverageCost(benchmarkReceiptLedger, "OIL"),
  SPICE: calculateWeightedAverageCost(benchmarkReceiptLedger, "SPICE"),
  POUCH: calculateWeightedAverageCost(benchmarkReceiptLedger, "POUCH"),
  CARTON: calculateWeightedAverageCost(benchmarkReceiptLedger, "CARTON"),
};

export const benchmarkPlannedMaterialUsage = planMaterialUsage(benchmarkRecipe, 200);

const benchmarkConsumptionByItem = sumConsumptionBySource(benchmarkLedger, BENCHMARK_RUN_NUMBER);

export const benchmarkActualMaterialUsage: MaterialUsage[] = benchmarkPlannedMaterialUsage.map((line) => {
  const quantity = benchmarkConsumptionByItem.get(line.itemId);
  const unitCost = benchmarkUnitCosts[line.itemId];
  if (quantity === undefined || unitCost === undefined) {
    throw new ValidationError(`Benchmark fixture is missing usage data for ${line.itemId}.`);
  }
  return { ...line, quantity, unitCost };
});

export const benchmarkMetrics = calculateProductionMetrics(200, 200, 12);
export const benchmarkMaterialVariances = calculateMaterialVariances(
  benchmarkPlannedMaterialUsage,
  benchmarkActualMaterialUsage,
);

export const benchmarkSnapshot = createProductionCostSnapshot({
  snapshotId: "SNAP-BENCH-RUN-001",
  runNumber: BENCHMARK_RUN_NUMBER,
  postedAt: PRODUCTION_POSTED_AT,
  goodOutputPackets: benchmarkMetrics.goodOutputPackets,
  materialUsages: benchmarkActualMaterialUsage,
  labourPaise: 120_000,
  gasPaise: 60_000,
  sellingPricePaise: 5_000,
});

export const benchmarkRetailerInvoice = createTaxInvoice({
  invoiceNumber: BENCHMARK_INVOICE_NUMBER,
  fromState: "Maharashtra",
  toState: "Maharashtra",
  lines: [
    {
      productCode: "PROD-500",
      hsnCode: "110100",
      quantityPackets: 150,
      unitPricePaise: 5_000,
    },
  ],
});

export const benchmarkRetailerPayment = recordPayment(
  [],
  {
    paymentId: "PAY-BENCH-RETAILER-A",
    invoiceNumber: BENCHMARK_INVOICE_NUMBER,
    amountPaise: 400_000,
    method: "upi",
    paidAt: "2026-02-04T09:00:00.000Z",
  },
  benchmarkRetailerInvoice.totalPaise,
);

export const benchmarkDistributorOrder = createFulfilmentPlan({
  orderNumber: "SO-BENCH-DISTRIBUTOR-B",
  orderedPackets: 120,
  availablePackets: 88,
});

export const benchmarkDistributorBenchmarkTax = calculateGst({
  hsnCode: "110100",
  taxablePaise: 120 * 5_000,
  rateBasisPoints: GST_RATE_BASIS_POINTS,
  jurisdiction: "inter_state",
});

export const benchmarkDistributorActualInvoice = createTaxInvoice({
  invoiceNumber: "INV-BENCH-DISTRIBUTOR-B-ACTUAL",
  fromState: "Maharashtra",
  toState: "Madhya Pradesh",
  lines: [
    {
      productCode: "PROD-500",
      hsnCode: "110100",
      quantityPackets: benchmarkDistributorOrder.fulfillablePackets,
      unitPricePaise: 5_000,
    },
  ],
});

export const benchmarkFutureFlourReceipt: StockMovementInput = receipt({
  movementId: "GR-BENCH-FLOUR-FUTURE",
  itemId: "FLOUR",
  baseUnit: "grams",
  quantity: 20_000,
  totalValuePaise: 120_000,
  sourceReference: "GR-BENCH-FLOUR-FUTURE",
  occurredAt: FUTURE_RECEIVED_AT,
});

export const benchmarkExpectations = {
  closingBaseQuantity: {
    FLOUR: 120_000,
    OIL: 19_500,
    SPICE: 3_800,
    POUCH: 306,
    CARTON: 21,
    FINISHED_GOODS: 88,
  },
  finishedGoodsAfterProductionPackets: 238,
  finishedGoodsAfterDispatchPackets: 88,
  yieldVarianceBasisPoints: -600,
  oilVarianceBasisPoints: 500,
  toleranceBasisPoints: DEFAULT_VARIANCE_TOLERANCE_BASIS_POINTS,
  flourWeightedAverageCost: createRational(690_000, 160_000),
  materialCostByItemPaise: {
    FLOUR: 172_500,
    OIL: 147_000,
    SPICE: 24_000,
    POUCH: 48_500,
    CARTON: 13_500,
  },
  materialCostPaise: 405_500,
  labourPaise: 120_000,
  gasPaise: 60_000,
  totalRunCostPaise: 585_500,
  costPerGoodPacketPaise: 3_114,
  sellingPricePaise: 5_000,
  grossMarginPerPacketPaise: 1_886,
  grossMarginBasisPoints: 3_772,
  retailerTaxablePaise: 750_000,
  cgstPaise: 18_750,
  sgstPaise: 18_750,
  invoiceTotalPaise: 787_500,
  paymentPaise: 400_000,
  outstandingPaise: 387_500,
  distributorOrderPackets: 120,
  availablePackets: 88,
  shortagePackets: 32,
  distributorBenchmarkIgstPaise: 30_000,
  distributorActualIgstPaise: 22_000,
} as const;

export function benchmarkCostOfUsage(itemId: string, quantity: number): number {
  const unitCost = benchmarkUnitCosts[itemId];
  if (!unitCost) {
    throw new ValidationError(`Unknown benchmark item ${itemId}.`);
  }
  return calculateCostOfUsage(unitCost, quantity);
}

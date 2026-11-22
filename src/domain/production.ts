import { calculateCostOfUsage } from "./costing";
import {
  addPaise,
  calculateMarginBasisPoints,
  calculateMarkupBasisPoints,
  calculateVarianceBasisPoints,
  createRational,
  rationalDivide,
  rationalFromInteger,
  rationalToPaise,
  roundRationalToInteger,
  type Paise,
} from "./money";
import type {
  MaterialUsage,
  MaterialVariance,
  PlannedMaterialUsage,
  ProductionCostSnapshot,
  ProductionMetrics,
  RecipeDefinition,
} from "./types";
import { assertMatchingBaseUnits } from "./units";
import {
  assertNonEmptyString,
  assertNonNegativeInteger,
  assertPositiveInteger,
  assertUniqueIds,
  ValidationError,
} from "./validation";

export const DEFAULT_VARIANCE_TOLERANCE_BASIS_POINTS = 300;

export type ProductionCostSnapshotInput = {
  snapshotId: string;
  runNumber: string;
  postedAt: string;
  goodOutputPackets: number;
  materialUsages: readonly MaterialUsage[];
  labourPaise: Paise;
  gasPaise: Paise;
  sellingPricePaise?: Paise;
};

function assertTolerance(toleranceBasisPoints: number): number {
  const tolerance = assertNonNegativeInteger(toleranceBasisPoints, "variance tolerance");
  if (tolerance > 10_000) {
    throw new ValidationError("Variance tolerance cannot exceed 100%.");
  }
  return tolerance;
}

export function planMaterialUsage(
  recipe: RecipeDefinition,
  plannedOutputPackets: number,
): PlannedMaterialUsage[] {
  assertNonEmptyString(recipe.code, "recipe code");
  assertPositiveInteger(recipe.expectedOutputPackets, "recipe expected output");
  assertPositiveInteger(plannedOutputPackets, "planned output packets");
  if (recipe.lines.length === 0) {
    throw new ValidationError("A recipe must contain at least one material line.");
  }
  assertUniqueIds(recipe.lines, (line) => line.itemId, "recipe line");

  return recipe.lines.map((line) => {
    assertPositiveInteger(line.quantity, `quantity for ${line.itemId}`);
    const quantity = roundRationalToInteger(
      createRational(line.quantity * plannedOutputPackets, recipe.expectedOutputPackets),
    );
    return {
      itemId: line.itemId,
      quantity: assertPositiveInteger(quantity, `planned quantity for ${line.itemId}`),
      baseUnit: line.baseUnit,
    };
  });
}

export function calculateProductionMetrics(
  plannedOutputPackets: number,
  actualOutputPackets: number,
  damagedOutputPackets: number,
  toleranceBasisPoints: number = DEFAULT_VARIANCE_TOLERANCE_BASIS_POINTS,
): ProductionMetrics {
  const planned = assertPositiveInteger(plannedOutputPackets, "planned output packets");
  const actual = assertNonNegativeInteger(actualOutputPackets, "actual output packets");
  const damaged = assertNonNegativeInteger(damagedOutputPackets, "damaged output packets");
  const tolerance = assertTolerance(toleranceBasisPoints);

  if (damaged > actual) {
    throw new ValidationError("Damaged output cannot exceed actual output.");
  }

  const good = actual - damaged;
  const yieldVarianceBasisPoints = calculateVarianceBasisPoints(good, planned);

  return {
    plannedOutputPackets: planned,
    actualOutputPackets: actual,
    damagedOutputPackets: damaged,
    goodOutputPackets: good,
    yieldVarianceBasisPoints,
    yieldFlagged: Math.abs(yieldVarianceBasisPoints) > tolerance,
  };
}

export function calculateMaterialVariances(
  planned: readonly PlannedMaterialUsage[],
  actual: readonly PlannedMaterialUsage[],
  toleranceBasisPoints: number = DEFAULT_VARIANCE_TOLERANCE_BASIS_POINTS,
): MaterialVariance[] {
  const tolerance = assertTolerance(toleranceBasisPoints);
  assertUniqueIds(planned, (line) => line.itemId, "planned material");
  assertUniqueIds(actual, (line) => line.itemId, "actual material");

  const actualByItem = new Map(actual.map((line) => [line.itemId, line]));
  const plannedIds = new Set(planned.map((line) => line.itemId));
  for (const line of actual) {
    if (!plannedIds.has(line.itemId)) {
      throw new ValidationError(`Actual usage contains unplanned item ${line.itemId}.`);
    }
  }

  return planned.map((line) => {
    const actualLine = actualByItem.get(line.itemId);
    if (!actualLine) {
      throw new ValidationError(`Actual usage is missing item ${line.itemId}.`);
    }
    assertMatchingBaseUnits(actualLine.baseUnit, line.baseUnit);
    const actualQuantity = assertPositiveInteger(actualLine.quantity, `actual quantity for ${line.itemId}`);
    const varianceBasisPoints = calculateVarianceBasisPoints(actualQuantity, line.quantity);
    return {
      itemId: line.itemId,
      plannedQuantity: line.quantity,
      actualQuantity,
      varianceBasisPoints,
      flagged: Math.abs(varianceBasisPoints) > tolerance,
    };
  });
}

export function createProductionCostSnapshot(input: ProductionCostSnapshotInput): ProductionCostSnapshot {
  assertNonEmptyString(input.snapshotId, "snapshot id");
  assertNonEmptyString(input.runNumber, "run number");
  assertNonEmptyString(input.postedAt, "posted at");
  const goodOutputPackets = assertPositiveInteger(input.goodOutputPackets, "good output packets");
  const labourPaise = assertNonNegativeInteger(input.labourPaise, "labour paise");
  const gasPaise = assertNonNegativeInteger(input.gasPaise, "gas paise");

  if (input.materialUsages.length === 0) {
    throw new ValidationError("A cost snapshot must contain at least one material usage.");
  }
  assertUniqueIds(input.materialUsages, (usage) => usage.itemId, "material usage");

  const materialLines = input.materialUsages.map((usage) => ({
    ...usage,
    quantity: assertPositiveInteger(usage.quantity, `quantity for ${usage.itemId}`),
    costPaise: calculateCostOfUsage(usage.unitCost, usage.quantity),
  }));

  const materialCostPaise = addPaise(...materialLines.map((line) => line.costPaise));
  const overheadPaise = addPaise(labourPaise, gasPaise);
  const totalRunCostPaise = addPaise(materialCostPaise, overheadPaise);
  const costPerGoodPacketPaise = rationalToPaise(createRational(totalRunCostPaise, goodOutputPackets));
  const overheadPerGoodPacket = rationalDivide(
    rationalFromInteger(overheadPaise),
    rationalFromInteger(goodOutputPackets),
  );
  const overheadCostPerGoodPacketPaise = rationalToPaise(overheadPerGoodPacket);
  const materialCostPerGoodPacketPaise =
    costPerGoodPacketPaise - overheadCostPerGoodPacketPaise;
  assertNonNegativeInteger(materialCostPerGoodPacketPaise, "material cost per packet");

  const snapshot: ProductionCostSnapshot = {
    snapshotId: input.snapshotId,
    runNumber: input.runNumber,
    postedAt: input.postedAt,
    goodOutputPackets,
    materialLines,
    materialCostPaise,
    labourPaise,
    gasPaise,
    overheadPaise,
    totalRunCostPaise,
    materialCostPerGoodPacketPaise,
    overheadPerGoodPacket,
    overheadCostPerGoodPacketPaise,
    costPerGoodPacketPaise,
  };

  if (input.sellingPricePaise !== undefined) {
    assertPositiveInteger(input.sellingPricePaise, "selling price paise");
    assertPositiveInteger(costPerGoodPacketPaise, "cost per good packet");
    snapshot.sellingPricePaise = input.sellingPricePaise;
    snapshot.grossMarginPerPacketPaise = input.sellingPricePaise - costPerGoodPacketPaise;
    snapshot.grossMarginBasisPoints = calculateMarginBasisPoints(
      input.sellingPricePaise,
      costPerGoodPacketPaise,
    );
    snapshot.markupBasisPoints = calculateMarkupBasisPoints(input.sellingPricePaise, costPerGoodPacketPaise);
  }

  return snapshot;
}

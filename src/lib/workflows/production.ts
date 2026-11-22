import "server-only";

import { and, asc, eq } from "drizzle-orm";
import {
  DEFAULT_VARIANCE_TOLERANCE_BASIS_POINTS,
  assertSafeInteger,
  calculateMaterialVariances,
  calculateProductionMetrics,
  calculateStockBalance,
  calculateVarianceBasisPoints,
  calculateWeightedAverageCost,
  createProductionCostSnapshot,
  createRational,
  planMaterialUsage,
  type BaseUnit,
  type MaterialUsage,
  type PlannedMaterialUsage,
  type ProductionCostSnapshot,
  type ProductionMetrics,
  type RecipeDefinition,
} from "@/domain";
import { getDb } from "@/lib/db";
import {
  auditLog,
  finishedGoodPackets,
  finishedGoods,
  materialBatches,
  packagingBatches,
  packagingMaterials,
  products,
  productionCostSnapshots,
  productionRunMaterials,
  productionRuns,
  rawMaterials,
  recipeIngredients,
  recipePackaging,
  recipes,
} from "@/lib/db/schema";
import { requireActorPermission, type WorkflowActor } from "./context";
import { stockItemKey, type WorkflowDb, type WorkflowTransaction } from "./db";
import { loadStockLedger, postLedgerEntry } from "./ledger";
import { WorkflowError } from "./errors";
import { recordAudit } from "./audit";
import {
  productionCompletionInputSchema,
  productionPlanInputSchema,
  productionPostingInputSchema,
  productionRunInputSchema,
  productionStatusSchema,
  type ProductionCompletionInput,
  type ProductionPlanInput,
  type ProductionPostingInput,
  type ProductionRunInput,
  type ProductionStatusInput,
} from "./validation";

export type ProductionStatus = "draft" | "planned" | "in_progress" | "completed" | "posted";

export type ProductionMaterialLine = {
  itemId: string;
  targetType: "raw" | "packaging";
  baseUnit: BaseUnit;
  materialId: number;
  materialCode: string;
  materialName: string;
  batchId: number | null;
  batchCode: string | null;
  plannedQuantity: number;
  actualQuantity: number;
  damagedQuantity: number;
  varianceBasisPoints: number | null;
  flagged: boolean;
};

export type ProductionRunSummary = {
  id: number;
  runNumber: string;
  productCode: string;
  productName: string;
  recipeCode: string;
  recipeVersion: number;
  status: ProductionStatus;
  batchCode: string | null;
  plannedOutputPackets: number;
  actualOutputPackets: number;
  damagedOutputPackets: number;
  goodOutputPackets: number;
  yieldVarianceBasisPoints: number | null;
  yieldFlagged: boolean;
  exceptionCount: number;
  costPerPacketPaise: number | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  postedAt: string | null;
};

export type ProductionAuditEvent = {
  id: number;
  action: string;
  actorEmail: string | null;
  createdAt: string;
  metadataJson: string;
};

export type ProductionRunDetail = ProductionRunSummary & {
  packetGrams: number;
  labourPaise: number;
  gasPaise: number;
  sellingPricePaise: number | null;
  notes: string;
  lines: ProductionMaterialLine[];
  metrics: ProductionMetrics | null;
  snapshot: ProductionCostSnapshot | null;
  audit: ProductionAuditEvent[];
};

export type ProductionOverview = {
  draft: number;
  planned: number;
  inProgress: number;
  completed: number;
  posted: number;
  exceptions: number;
  postedPackets: number;
  averageYieldBasisPoints: number | null;
};

export type ProductionBatchOption = {
  id: number;
  batchCode: string;
  availableQuantity: number;
  expiresAt: string | null;
};

export type ProductionMaterialOption = {
  itemId: string;
  targetType: "raw" | "packaging";
  baseUnit: BaseUnit;
  code: string;
  name: string;
  batches: ProductionBatchOption[];
};

export type ProductionOptions = {
  products: { id: number; code: string; name: string; packetGrams: number }[];
  recipes: {
    id: number;
    code: string;
    name: string;
    version: number;
    productId: number;
    expectedOutputPackets: number;
    lineCount: number;
  }[];
  materials: ProductionMaterialOption[];
};

type ItemKey = { targetType: "raw" | "packaging"; id: number };

type MaterialMeta = {
  itemId: string;
  targetType: "raw" | "packaging";
  materialId: number;
  baseUnit: BaseUnit;
  code: string;
  name: string;
};

type RecipeBundle = {
  recipeId: number;
  recipeCode: string;
  recipeVersion: number;
  productId: number;
  productCode: string;
  productName: string;
  packetGrams: number;
  expectedOutputPackets: number;
  definition: RecipeDefinition;
  materials: Map<string, MaterialMeta>;
};

type RunRow = typeof productionRuns.$inferSelect;

const now = () => new Date().toISOString();

function parseItemId(itemId: string): ItemKey {
  const match = /^(raw|packaging):([1-9]\d*)$/.exec(itemId);
  if (!match) {
    throw new WorkflowError("Use a valid material item key.", "invalid_item");
  }
  return { targetType: match[1] as ItemKey["targetType"], id: Number(match[2]) };
}

function assertUniqueItemIds(itemIds: string[]) {
  if (new Set(itemIds).size !== itemIds.length) {
    throw new WorkflowError("A material item may only appear once.", "duplicate_material");
  }
}

function assertExpectedItemIds(expected: readonly string[], received: readonly string[]) {
  assertUniqueItemIds([...received]);
  const expectedSet = new Set(expected);
  for (const itemId of received) {
    if (!expectedSet.has(itemId)) {
      throw new WorkflowError(`Unexpected material item ${itemId}.`, "invalid_material");
    }
  }
  for (const itemId of expected) {
    if (!received.includes(itemId)) {
      throw new WorkflowError(`Missing material item ${itemId}.`, "missing_material");
    }
  }
}

function assertEditable(run: RunRow) {
  if (run.status === "posted") {
    throw new WorkflowError(
      "Posted production is immutable. Use inventory adjustments for corrections.",
      "posted_immutable",
      409,
    );
  }
}

function requireStatus(run: RunRow, status: ProductionStatus) {
  if (run.status !== status) {
    throw new WorkflowError(
      `This run is ${run.status.replace("_", " ")}; expected ${status.replace("_", " ")}.`,
      "invalid_run_status",
    );
  }
}

function loadRun(db: WorkflowDb | WorkflowTransaction, factoryId: number, runNumber: string) {
  const run = db
    .select()
    .from(productionRuns)
    .where(and(eq(productionRuns.factoryId, factoryId), eq(productionRuns.runNumber, runNumber)))
    .get();
  if (!run) {
    throw new WorkflowError("Production run not found.", "production_run_not_found", 404);
  }
  return run;
}

function loadRecipeBundle(
  db: WorkflowDb | WorkflowTransaction,
  factoryId: number,
  recipeId: number,
): RecipeBundle {
  const recipe = db
    .select()
    .from(recipes)
    .where(and(eq(recipes.factoryId, factoryId), eq(recipes.id, recipeId), eq(recipes.status, "active")))
    .get();
  if (!recipe) {
    throw new WorkflowError("An active recipe is required.", "recipe_not_found", 404);
  }

  const product = db
    .select()
    .from(products)
    .where(and(eq(products.factoryId, factoryId), eq(products.id, recipe.productId)))
    .get();
  if (!product) {
    throw new WorkflowError("The recipe product was not found.", "product_not_found", 404);
  }
  if (recipe.expectedYieldGrams % product.packetGrams !== 0) {
    throw new WorkflowError(
      "The recipe yield must be a whole number of packets.",
      "invalid_recipe_yield",
    );
  }

  const ingredientRows = db
    .select()
    .from(recipeIngredients)
    .where(eq(recipeIngredients.recipeId, recipe.id))
    .orderBy(asc(recipeIngredients.id))
    .all();
  const packagingRows = db
    .select()
    .from(recipePackaging)
    .where(eq(recipePackaging.recipeId, recipe.id))
    .orderBy(asc(recipePackaging.id))
    .all();

  const lines: PlannedMaterialUsage[] = [];
  const materials = new Map<string, MaterialMeta>();
  for (const row of ingredientRows) {
    const material = db
      .select()
      .from(rawMaterials)
      .where(and(eq(rawMaterials.factoryId, factoryId), eq(rawMaterials.id, row.rawMaterialId)))
      .get();
    if (!material) continue;
    const itemId = `raw:${material.id}`;
    lines.push({ itemId, quantity: row.quantityGrams, baseUnit: "grams" });
    materials.set(itemId, {
      itemId,
      targetType: "raw",
      materialId: material.id,
      baseUnit: "grams",
      code: material.code,
      name: material.name,
    });
  }
  for (const row of packagingRows) {
    const material = db
      .select()
      .from(packagingMaterials)
      .where(and(eq(packagingMaterials.factoryId, factoryId), eq(packagingMaterials.id, row.packagingMaterialId)))
      .get();
    if (!material) continue;
    const itemId = `packaging:${material.id}`;
    lines.push({ itemId, quantity: row.quantityUnits, baseUnit: "pieces" });
    materials.set(itemId, {
      itemId,
      targetType: "packaging",
      materialId: material.id,
      baseUnit: "pieces",
      code: material.code,
      name: material.name,
    });
  }

  if (lines.length === 0) {
    throw new WorkflowError("The recipe has no usable material lines.", "invalid_recipe");
  }

  return {
    recipeId: recipe.id,
    recipeCode: recipe.code,
    recipeVersion: recipe.version,
    productId: product.id,
    productCode: product.code,
    productName: product.name,
    packetGrams: product.packetGrams,
    expectedOutputPackets: recipe.expectedYieldGrams / product.packetGrams,
    definition: {
      code: recipe.code,
      expectedOutputPackets: recipe.expectedYieldGrams / product.packetGrams,
      lines,
    },
    materials,
  };
}

function batchTarget(itemId: string, batchId: number) {
  const parsed = parseItemId(itemId);
  return parsed.targetType === "raw"
    ? ({ type: "raw", id: batchId } as const)
    : ({ type: "packaging", id: batchId } as const);
}

function availableQuantity(
  db: WorkflowDb | WorkflowTransaction,
  factoryId: number,
  itemId: string,
  batchId: number,
) {
  const target = batchTarget(itemId, batchId);
  const ledger = loadStockLedger(db, factoryId, target);
  return calculateStockBalance(ledger, stockItemKey(target));
}

function resolveBatch(
  db: WorkflowDb | WorkflowTransaction,
  factoryId: number,
  itemId: string,
  batchId: number,
  requiredQuantity: number,
) {
  const parsed = parseItemId(itemId);
  let batchCode: string | null = null;
  if (parsed.targetType === "raw") {
    const row = db
      .select({ id: materialBatches.id, batchCode: materialBatches.batchCode, materialId: materialBatches.rawMaterialId })
      .from(materialBatches)
      .where(and(eq(materialBatches.factoryId, factoryId), eq(materialBatches.id, batchId)))
      .get();
    if (!row || row.materialId !== parsed.id) {
      throw new WorkflowError("The selected batch does not match this material.", "invalid_batch");
    }
    batchCode = row.batchCode;
  } else {
    const row = db
      .select({
        id: packagingBatches.id,
        batchCode: packagingBatches.batchCode,
        materialId: packagingBatches.packagingMaterialId,
      })
      .from(packagingBatches)
      .where(and(eq(packagingBatches.factoryId, factoryId), eq(packagingBatches.id, batchId)))
      .get();
    if (!row || row.materialId !== parsed.id) {
      throw new WorkflowError("The selected batch does not match this material.", "invalid_batch");
    }
    batchCode = row.batchCode;
  }

  const available = availableQuantity(db, factoryId, itemId, batchId);
  if (available < requiredQuantity) {
    throw new WorkflowError(
      `${batchCode ?? "Selected batch"} has ${available} available; ${requiredQuantity} required.`,
      "insufficient_material",
    );
  }
  return { batchCode, available };
}

function loadMaterialLines(db: WorkflowDb | WorkflowTransaction, factoryId: number, runId: number) {
  return db
    .select()
    .from(productionRunMaterials)
    .where(and(eq(productionRunMaterials.factoryId, factoryId), eq(productionRunMaterials.productionRunId, runId)))
    .orderBy(asc(productionRunMaterials.id))
    .all();
}

function batchCodeForLine(
  db: WorkflowDb | WorkflowTransaction,
  factoryId: number,
  row: typeof productionRunMaterials.$inferSelect,
) {
  if (row.materialBatchId !== null) {
    return (
      db
        .select({ batchCode: materialBatches.batchCode })
        .from(materialBatches)
        .where(and(eq(materialBatches.factoryId, factoryId), eq(materialBatches.id, row.materialBatchId)))
        .get()?.batchCode ?? null
    );
  }
  if (row.packagingBatchId !== null) {
    return (
      db
        .select({ batchCode: packagingBatches.batchCode })
        .from(packagingBatches)
        .where(and(eq(packagingBatches.factoryId, factoryId), eq(packagingBatches.id, row.packagingBatchId)))
        .get()?.batchCode ?? null
    );
  }
  return null;
}

function lineView(
  row: typeof productionRunMaterials.$inferSelect,
  batchCode: string | null,
  plannedQuantity: number,
): ProductionMaterialLine {
  const parsed = parseItemId(row.itemId);
  const actualTotal = row.actualQuantity + row.damagedQuantity;
  const varianceBasisPoints =
    row.actualQuantity > 0
      ? calculateVarianceBasisPoints(actualTotal, plannedQuantity)
      : null;
  return {
    itemId: row.itemId,
    targetType: parsed.targetType,
    baseUnit: row.baseUnit as BaseUnit,
    materialId: parsed.id,
    materialCode: "",
    materialName: "",
    batchId: row.materialBatchId ?? row.packagingBatchId,
    batchCode,
    plannedQuantity,
    actualQuantity: row.actualQuantity,
    damagedQuantity: row.damagedQuantity,
    varianceBasisPoints,
    flagged: varianceBasisPoints !== null && Math.abs(varianceBasisPoints) > DEFAULT_VARIANCE_TOLERANCE_BASIS_POINTS,
  };
}

export function getProductionRunDetail(
  factoryId: number,
  runNumber: string,
  db: WorkflowDb | WorkflowTransaction = getDb(),
): ProductionRunDetail | null {
  const run = db
    .select()
    .from(productionRuns)
    .where(and(eq(productionRuns.factoryId, factoryId), eq(productionRuns.runNumber, runNumber)))
    .get();
  if (!run) return null;

  const bundle = loadRecipeBundle(db, factoryId, run.recipeId);
  const rows = loadMaterialLines(db, factoryId, run.id);
  const lineViews = rows.map((row) => {
    const view = lineView(row, batchCodeForLine(db, factoryId, row), row.plannedQuantity);
    const meta = bundle.materials.get(row.itemId);
    return {
      ...view,
      materialCode: meta?.code ?? "",
      materialName: meta?.name ?? "",
    };
  });

  let batchCode: string | null = null;
  const finished = db
    .select({ batchCode: finishedGoods.batchCode })
    .from(finishedGoods)
    .where(and(eq(finishedGoods.factoryId, factoryId), eq(finishedGoods.productionRunId, run.id)))
    .get();
  if (finished) batchCode = finished.batchCode;

  const snapshotRow = db
    .select({ snapshotJson: productionCostSnapshots.snapshotJson })
    .from(productionCostSnapshots)
    .where(
      and(
        eq(productionCostSnapshots.factoryId, factoryId),
        eq(productionCostSnapshots.productionRunId, run.id),
      ),
    )
    .get();
  const snapshot = snapshotRow ? (JSON.parse(snapshotRow.snapshotJson) as ProductionCostSnapshot) : null;

  const metrics =
    run.actualOutputPackets > 0
      ? calculateProductionMetrics(
          run.plannedOutputGrams / bundle.packetGrams,
          run.actualOutputPackets,
          run.damagedOutputPackets,
          DEFAULT_VARIANCE_TOLERANCE_BASIS_POINTS,
        )
      : null;

  const audit = db
    .select({
      id: auditLog.id,
      action: auditLog.action,
      actorEmail: auditLog.actorEmail,
      createdAt: auditLog.createdAt,
      metadataJson: auditLog.metadataJson,
    })
    .from(auditLog)
    .where(and(eq(auditLog.factoryId, factoryId), eq(auditLog.entityType, "production_run"), eq(auditLog.entityId, run.id)))
    .orderBy(asc(auditLog.id))
    .all();

  const yieldVarianceBasisPoints = metrics?.yieldVarianceBasisPoints ?? null;
  const materialFlags = lineViews.filter((line) => line.flagged).length;

  return {
    id: run.id,
    runNumber: run.runNumber,
    productCode: bundle.productCode,
    productName: bundle.productName,
    recipeCode: bundle.recipeCode,
    recipeVersion: bundle.recipeVersion,
    status: run.status as ProductionStatus,
    batchCode,
    plannedOutputPackets: run.plannedOutputGrams / bundle.packetGrams,
    actualOutputPackets: run.actualOutputPackets,
    damagedOutputPackets: run.damagedOutputPackets,
    goodOutputPackets: metrics?.goodOutputPackets ?? 0,
    yieldVarianceBasisPoints,
    yieldFlagged: metrics?.yieldFlagged ?? false,
    exceptionCount: materialFlags + (metrics?.yieldFlagged ? 1 : 0),
    costPerPacketPaise: snapshot?.costPerGoodPacketPaise ?? null,
    createdAt: run.createdAt,
    startedAt: run.startedAt,
    completedAt: run.completedAt,
    postedAt: run.postedAt,
    packetGrams: bundle.packetGrams,
    labourPaise: run.labourPaise,
    gasPaise: run.gasPaise,
    sellingPricePaise: run.sellingPricePaise,
    notes: run.notes,
    lines: lineViews,
    metrics,
    snapshot,
    audit,
  };
}

export function listProductionRuns(
  factoryId: number,
  filters: { status?: string; query?: string } = {},
): ProductionRunSummary[] {
  const db = getDb();
  const runs = db
    .select()
    .from(productionRuns)
    .where(eq(productionRuns.factoryId, factoryId))
    .orderBy(asc(productionRuns.id))
    .all();
  const summaries = runs.map((run) => getProductionRunDetail(factoryId, run.runNumber, db)!);
  const query = filters.query?.trim().toLowerCase();
  return summaries.filter((summary) => {
    if (filters.status && filters.status !== "all" && summary.status !== filters.status) return false;
    if (!query) return true;
    return [summary.runNumber, summary.productName, summary.recipeCode, summary.batchCode ?? ""]
      .join(" ")
      .toLowerCase()
      .includes(query);
  });
}

export function getProductionOverview(factoryId: number): ProductionOverview {
  const runs = listProductionRuns(factoryId);
  const posted = runs.filter((run) => run.status === "posted");
  const yields = runs
    .filter((run) => run.yieldVarianceBasisPoints !== null)
    .map((run) => run.yieldVarianceBasisPoints!);
  return {
    draft: runs.filter((run) => run.status === "draft").length,
    planned: runs.filter((run) => run.status === "planned").length,
    inProgress: runs.filter((run) => run.status === "in_progress").length,
    completed: runs.filter((run) => run.status === "completed").length,
    posted: posted.length,
    exceptions: runs.filter((run) => run.exceptionCount > 0).length,
    postedPackets: posted.reduce((total, run) => total + run.goodOutputPackets, 0),
    averageYieldBasisPoints:
      yields.length === 0
        ? null
        : Math.round(yields.reduce((total, value) => total + value, 0) / yields.length),
  };
}

export function getProductionOptions(factoryId: number): ProductionOptions {
  const db = getDb();
  const productRows = db
    .select({ id: products.id, code: products.code, name: products.name, packetGrams: products.packetGrams })
    .from(products)
    .where(eq(products.factoryId, factoryId))
    .orderBy(asc(products.code))
    .all();

  const recipeRows = db
    .select()
    .from(recipes)
    .where(and(eq(recipes.factoryId, factoryId), eq(recipes.status, "active")))
    .orderBy(asc(recipes.code), asc(recipes.version))
    .all();

  const recipesView = recipeRows.map((recipe) => {
    const bundle = loadRecipeBundle(db, factoryId, recipe.id);
    return {
      id: recipe.id,
      code: recipe.code,
      name: recipe.name,
      version: recipe.version,
      productId: recipe.productId,
      expectedOutputPackets: bundle.expectedOutputPackets,
      lineCount: bundle.definition.lines.length,
    };
  });

  const materials: ProductionMaterialOption[] = [];
  const rawRows = db
    .select()
    .from(rawMaterials)
    .where(eq(rawMaterials.factoryId, factoryId))
    .orderBy(asc(rawMaterials.code))
    .all();
  for (const material of rawRows) {
    const batches = db
      .select()
      .from(materialBatches)
      .where(and(eq(materialBatches.factoryId, factoryId), eq(materialBatches.rawMaterialId, material.id)))
      .orderBy(asc(materialBatches.id))
      .all()
      .map((batch) => ({
        id: batch.id,
        batchCode: batch.batchCode,
        availableQuantity: availableQuantity(db, factoryId, `raw:${material.id}`, batch.id),
        expiresAt: batch.expiresAt,
      }))
      .filter((batch) => batch.availableQuantity > 0);
    materials.push({
      itemId: `raw:${material.id}`,
      targetType: "raw",
      baseUnit: "grams",
      code: material.code,
      name: material.name,
      batches,
    });
  }

  const packagingRows = db
    .select()
    .from(packagingMaterials)
    .where(eq(packagingMaterials.factoryId, factoryId))
    .orderBy(asc(packagingMaterials.code))
    .all();
  for (const material of packagingRows) {
    const batches = db
      .select()
      .from(packagingBatches)
      .where(and(eq(packagingBatches.factoryId, factoryId), eq(packagingBatches.packagingMaterialId, material.id)))
      .orderBy(asc(packagingBatches.id))
      .all()
      .map((batch) => ({
        id: batch.id,
        batchCode: batch.batchCode,
        availableQuantity: availableQuantity(db, factoryId, `packaging:${material.id}`, batch.id),
        expiresAt: batch.expiresAt,
      }))
      .filter((batch) => batch.availableQuantity > 0);
    materials.push({
      itemId: `packaging:${material.id}`,
      targetType: "packaging",
      baseUnit: "pieces",
      code: material.code,
      name: material.name,
      batches,
    });
  }

  return { products: productRows, recipes: recipesView, materials };
}

export function createProductionRun(actor: WorkflowActor, input: ProductionRunInput) {
  requireActorPermission(actor, "production:manage");
  const data = productionRunInputSchema.parse(input);

  return getDb().transaction((tx: WorkflowTransaction) => {
    const bundle = loadRecipeBundle(tx, actor.factoryId, data.recipeId);
    const plannedOutputGrams = assertSafeInteger(
      data.plannedOutputPackets * bundle.packetGrams,
      "planned output grams",
    );

    const existing = tx
      .select({ id: productionRuns.id })
      .from(productionRuns)
      .where(and(eq(productionRuns.factoryId, actor.factoryId), eq(productionRuns.runNumber, data.runNumber)))
      .get();
    if (existing) {
      throw new WorkflowError("A production run with this number already exists.", "duplicate_run", 409);
    }

    const planned = planMaterialUsage(bundle.definition, data.plannedOutputPackets);
    const inserted = tx
      .insert(productionRuns)
      .values({
        factoryId: actor.factoryId,
        recipeId: bundle.recipeId,
        runNumber: data.runNumber,
        plannedOutputGrams,
        sellingPricePaise: data.sellingPricePaise ?? null,
        status: "draft",
        notes: data.notes,
        createdByUserId: actor.userId,
        createdAt: now(),
        updatedAt: now(),
      })
      .run();
    const runId = Number(inserted.lastInsertRowid);

    for (const line of planned) {
      const meta = bundle.materials.get(line.itemId)!;
      tx.insert(productionRunMaterials)
        .values({
          factoryId: actor.factoryId,
          productionRunId: runId,
          targetType: meta.targetType,
          itemId: line.itemId,
          baseUnit: line.baseUnit,
          rawMaterialId: meta.targetType === "raw" ? meta.materialId : null,
          packagingMaterialId: meta.targetType === "packaging" ? meta.materialId : null,
          materialBatchId: null,
          packagingBatchId: null,
          plannedQuantity: line.quantity,
          actualQuantity: 0,
          damagedQuantity: 0,
          createdAt: now(),
          updatedAt: now(),
        })
        .run();
    }

    recordAudit(tx, actor, "production_run.created", "production_run", runId, {
      runNumber: data.runNumber,
      plannedOutputPackets: data.plannedOutputPackets,
    });

    return { id: runId, runNumber: data.runNumber, status: "draft" as const, lineCount: planned.length };
  });
}

export function planProductionRun(actor: WorkflowActor, runNumber: string, input: ProductionPlanInput) {
  requireActorPermission(actor, "production:manage");
  const data = productionPlanInputSchema.parse(input);

  return getDb().transaction((tx: WorkflowTransaction) => {
    const run = loadRun(tx, actor.factoryId, runNumber);
    assertEditable(run);
    requireStatus(run, "draft");
    const lines = loadMaterialLines(tx, actor.factoryId, run.id);
    assertExpectedItemIds(
      lines.map((line) => line.itemId),
      data.lines.map((line) => line.itemId),
    );

    for (const selected of data.lines) {
      const line = lines.find((candidate) => candidate.itemId === selected.itemId)!;
      resolveBatch(tx, actor.factoryId, selected.itemId, selected.batchId, line.plannedQuantity);
      tx.update(productionRunMaterials)
        .set({
          materialBatchId: parseItemId(selected.itemId).targetType === "raw" ? selected.batchId : null,
          packagingBatchId: parseItemId(selected.itemId).targetType === "packaging" ? selected.batchId : null,
          updatedAt: now(),
        })
        .where(eq(productionRunMaterials.id, line.id))
        .run();
    }

    tx.update(productionRuns)
      .set({ status: "planned", updatedAt: now() })
      .where(eq(productionRuns.id, run.id))
      .run();
    recordAudit(tx, actor, "production_run.planned", "production_run", run.id, {
      runNumber,
      lineCount: data.lines.length,
    });
    return { id: run.id, runNumber, status: "planned" as const };
  });
}

export function updateProductionRunStatus(actor: WorkflowActor, runNumber: string, input: ProductionStatusInput) {
  requireActorPermission(actor, "production:manage");
  const status = productionStatusSchema.parse(input);

  return getDb().transaction((tx: WorkflowTransaction) => {
    const run = loadRun(tx, actor.factoryId, runNumber);
    assertEditable(run);
    if (status !== "in_progress" || run.status !== "planned") {
      throw new WorkflowError("Only a planned run can be started.", "invalid_transition");
    }
    tx.update(productionRuns)
      .set({ status: "in_progress", startedAt: now(), updatedAt: now() })
      .where(eq(productionRuns.id, run.id))
      .run();
    recordAudit(tx, actor, "production_run.started", "production_run", run.id, {
      runNumber,
      from: run.status,
      to: status,
    });
    return { id: run.id, runNumber, status: "in_progress" as const };
  });
}

export function completeProductionRun(actor: WorkflowActor, runNumber: string, input: ProductionCompletionInput) {
  requireActorPermission(actor, "production:manage");
  const data = productionCompletionInputSchema.parse(input);

  return getDb().transaction((tx: WorkflowTransaction) => {
    const run = loadRun(tx, actor.factoryId, runNumber);
    assertEditable(run);
    requireStatus(run, "in_progress");
    const bundle = loadRecipeBundle(tx, actor.factoryId, run.recipeId);
    const rows = loadMaterialLines(tx, actor.factoryId, run.id);
    assertExpectedItemIds(
      rows.map((line) => line.itemId),
      data.lines.map((line) => line.itemId),
    );

    const planned: PlannedMaterialUsage[] = rows.map((line) => ({
      itemId: line.itemId,
      quantity: line.plannedQuantity,
      baseUnit: line.baseUnit as BaseUnit,
    }));
    const actual: PlannedMaterialUsage[] = data.lines.map((line) => {
      const row = rows.find((candidate) => candidate.itemId === line.itemId)!;
      return {
        itemId: line.itemId,
        quantity: line.actualQuantity + line.damagedQuantity,
        baseUnit: row.baseUnit as BaseUnit,
      };
    });
    const variances = calculateMaterialVariances(
      planned,
      actual,
      DEFAULT_VARIANCE_TOLERANCE_BASIS_POINTS,
    );

    for (const row of rows) {
      const entered = data.lines.find((line) => line.itemId === row.itemId)!;
      const batchId = row.materialBatchId ?? row.packagingBatchId;
      if (batchId === null) {
        throw new WorkflowError("Every material requires a source batch before recording output.", "missing_batch");
      }
      resolveBatch(tx, actor.factoryId, row.itemId, batchId, entered.actualQuantity + entered.damagedQuantity);
      tx.update(productionRunMaterials)
        .set({
          actualQuantity: entered.actualQuantity,
          damagedQuantity: entered.damagedQuantity,
          recordedAt: now(),
          updatedAt: now(),
        })
        .where(eq(productionRunMaterials.id, row.id))
        .run();
    }

    const plannedPackets = run.plannedOutputGrams / bundle.packetGrams;
    const metrics = calculateProductionMetrics(
      plannedPackets,
      data.goodOutputPackets + data.damagedOutputPackets,
      data.damagedOutputPackets,
      DEFAULT_VARIANCE_TOLERANCE_BASIS_POINTS,
    );
    tx.update(productionRuns)
      .set({
        actualOutputPackets: metrics.actualOutputPackets,
        damagedOutputPackets: metrics.damagedOutputPackets,
        actualOutputGrams: assertSafeInteger(
          metrics.actualOutputPackets * bundle.packetGrams,
          "actual output grams",
        ),
        labourPaise: data.labourPaise,
        gasPaise: data.gasPaise,
        notes: data.notes || run.notes,
        completedAt: now(),
        status: "completed",
        updatedAt: now(),
      })
      .where(eq(productionRuns.id, run.id))
      .run();

    recordAudit(tx, actor, "production_run.completed", "production_run", run.id, {
      runNumber,
      goodOutputPackets: metrics.goodOutputPackets,
      damagedOutputPackets: metrics.damagedOutputPackets,
      flaggedMaterials: variances.filter((variance) => variance.flagged).length,
    });
    return {
      id: run.id,
      runNumber,
      status: "completed" as const,
      metrics,
      variances,
    };
  });
}

export function postProductionRun(actor: WorkflowActor, runNumber: string, input: ProductionPostingInput) {
  requireActorPermission(actor, "production:manage");
  const data = productionPostingInputSchema.parse(input);

  return getDb().transaction((tx: WorkflowTransaction) => {
    const run = loadRun(tx, actor.factoryId, runNumber);
    requireStatus(run, "completed");

    const existingSnapshot = tx
      .select({ id: productionCostSnapshots.id })
      .from(productionCostSnapshots)
      .where(
        and(
          eq(productionCostSnapshots.factoryId, actor.factoryId),
          eq(productionCostSnapshots.productionRunId, run.id),
        ),
      )
      .get();
    if (existingSnapshot) {
      throw new WorkflowError("This production run has already been posted.", "duplicate_posting", 409);
    }

    const bundle = loadRecipeBundle(tx, actor.factoryId, run.recipeId);
    const rows = loadMaterialLines(tx, actor.factoryId, run.id);
    const usages: MaterialUsage[] = [];
    for (const row of rows) {
      const batchId = row.materialBatchId ?? row.packagingBatchId;
      if (batchId === null) {
        throw new WorkflowError("Every material requires a source batch before posting.", "missing_batch");
      }
      const totalQuantity = row.actualQuantity + row.damagedQuantity;
      if (totalQuantity <= 0) {
        throw new WorkflowError("Actual consumption must be recorded before posting.", "missing_consumption");
      }
      resolveBatch(tx, actor.factoryId, row.itemId, batchId, totalQuantity);
      const ledger = loadStockLedger(tx, actor.factoryId, batchTarget(row.itemId, batchId));
      const unitCost = calculateWeightedAverageCost(ledger, stockItemKey(batchTarget(row.itemId, batchId)));
      usages.push({
        itemId: row.itemId,
        quantity: totalQuantity,
        baseUnit: row.baseUnit as BaseUnit,
        unitCost,
      });
    }

    const goodOutputPackets = run.actualOutputPackets - run.damagedOutputPackets;
    const snapshot = createProductionCostSnapshot({
      snapshotId: `COST-${run.runNumber}`,
      runNumber: run.runNumber,
      postedAt: data.packedOn,
      goodOutputPackets,
      materialUsages: usages,
      labourPaise: run.labourPaise,
      gasPaise: run.gasPaise,
      sellingPricePaise: run.sellingPricePaise ?? undefined,
    });

    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index];
      const batchId = row.materialBatchId ?? row.packagingBatchId;
      if (batchId === null) continue;
      const usage = usages[index];
      const target = batchTarget(row.itemId, batchId);
      if (row.actualQuantity > 0) {
        postLedgerEntry(tx, {
          factoryId: actor.factoryId,
          target,
          transactionType: "issue",
          referenceType: "PRODUCTION_CONSUMPTION",
          referenceId: run.id,
          referenceNumber: run.runNumber,
          baseUnit: usage.baseUnit,
          quantityDelta: -row.actualQuantity,
          occurredAt: data.packedOn,
          createdByUserId: actor.userId,
        });
      }
      if (row.damagedQuantity > 0) {
        postLedgerEntry(tx, {
          factoryId: actor.factoryId,
          target,
          transactionType: "damage",
          referenceType: "PRODUCTION_MATERIAL_DAMAGE",
          referenceId: run.id,
          referenceNumber: run.runNumber,
          baseUnit: usage.baseUnit,
          quantityDelta: -row.damagedQuantity,
          occurredAt: data.packedOn,
          createdByUserId: actor.userId,
        });
      }
      tx.update(productionRunMaterials)
        .set({
          unitCostNumerator: usage.unitCost.numerator,
          unitCostDenominator: usage.unitCost.denominator,
          updatedAt: now(),
        })
        .where(eq(productionRunMaterials.id, row.id))
        .run();
    }

    const existingFinished = tx
      .select({ id: finishedGoods.id })
      .from(finishedGoods)
      .where(
        and(eq(finishedGoods.factoryId, actor.factoryId), eq(finishedGoods.batchCode, data.finishedBatchCode)),
      )
      .get();
    if (existingFinished) {
      throw new WorkflowError("A finished-good batch with this code already exists.", "duplicate_batch", 409);
    }

    const totalOutputPackets = run.actualOutputPackets;
    const finishedQuantityGrams = assertSafeInteger(
      totalOutputPackets * bundle.packetGrams,
      "finished output grams",
    );
    const insertedFinished = tx
      .insert(finishedGoods)
      .values({
        factoryId: actor.factoryId,
        productId: bundle.productId,
        productionRunId: run.id,
        batchCode: data.finishedBatchCode,
        quantityGrams: finishedQuantityGrams,
        availableGrams: assertSafeInteger(goodOutputPackets * bundle.packetGrams, "good output grams"),
        packedOn: data.packedOn,
        expiresOn: data.expiresAt || null,
        createdAt: now(),
        updatedAt: now(),
      })
      .run();
    const finishedGoodId = Number(insertedFinished.lastInsertRowid);
    const outputCost = createRational(snapshot.totalRunCostPaise, goodOutputPackets);

    postLedgerEntry(tx, {
      factoryId: actor.factoryId,
      target: { type: "finished_good", id: finishedGoodId },
      transactionType: "receipt",
      referenceType: "PRODUCTION_OUTPUT",
      referenceId: run.id,
      referenceNumber: run.runNumber,
      baseUnit: "pieces",
      quantityDelta: totalOutputPackets,
      occurredAt: data.packedOn,
      createdByUserId: actor.userId,
      unitCost: outputCost,
    });
    if (run.damagedOutputPackets > 0) {
      postLedgerEntry(tx, {
        factoryId: actor.factoryId,
        target: { type: "finished_good", id: finishedGoodId },
        transactionType: "damage",
        referenceType: "PRODUCTION_OUTPUT_DAMAGE",
        referenceId: run.id,
        referenceNumber: run.runNumber,
        baseUnit: "pieces",
        quantityDelta: -run.damagedOutputPackets,
        occurredAt: data.packedOn,
        createdByUserId: actor.userId,
      });
    }

    for (let packet = 1; packet <= goodOutputPackets; packet += 1) {
      tx.insert(finishedGoodPackets)
        .values({
          factoryId: actor.factoryId,
          finishedGoodId,
          packetCode: `${data.finishedBatchCode.slice(0, 48)}-P${String(packet).padStart(5, "0")}`,
          quantityGrams: bundle.packetGrams,
          status: "available",
          createdAt: now(),
          updatedAt: now(),
        })
        .run();
    }

    tx.insert(productionCostSnapshots)
      .values({
        factoryId: actor.factoryId,
        productionRunId: run.id,
        snapshotId: snapshot.snapshotId,
        runNumber: run.runNumber,
        postedAt: snapshot.postedAt,
        goodOutputPackets: snapshot.goodOutputPackets,
        materialCostPaise: snapshot.materialCostPaise,
        labourPaise: snapshot.labourPaise,
        gasPaise: snapshot.gasPaise,
        overheadPaise: snapshot.overheadPaise,
        totalRunCostPaise: snapshot.totalRunCostPaise,
        costPerGoodPacketPaise: snapshot.costPerGoodPacketPaise,
        snapshotJson: JSON.stringify(snapshot),
        createdAt: now(),
        updatedAt: now(),
      })
      .run();

    tx.update(productionRuns)
      .set({
        status: "posted",
        postedAt: data.packedOn,
        notes: data.notes || run.notes,
        updatedAt: now(),
      })
      .where(eq(productionRuns.id, run.id))
      .run();

    recordAudit(tx, actor, "production_run.posted", "production_run", run.id, {
      runNumber: run.runNumber,
      snapshotId: snapshot.snapshotId,
      finishedBatchCode: data.finishedBatchCode,
      goodOutputPackets,
    });

    return {
      id: run.id,
      runNumber: run.runNumber,
      status: "posted" as const,
      snapshot,
      finishedGoodId,
      finishedBatchCode: data.finishedBatchCode,
    };
  });
}

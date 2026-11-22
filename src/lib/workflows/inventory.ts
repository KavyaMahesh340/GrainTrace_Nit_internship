import "server-only";
import { and, asc, desc, eq } from "drizzle-orm";
import {
  calculateInventoryValue,
  calculateStockBalance,
  createRational,
  formatPaise,
  rationalAdd,
  rationalDivide,
  rationalFromInteger,
  rationalToPaise,
  type Rational,
} from "@/domain";
import { getDb } from "@/lib/db";
import {
  finishedGoods,
  inventoryAdjustments,
  materialBatches,
  packagingBatches,
  packagingMaterials,
  products,
  rawMaterials,
  stockLedger,
  suppliers,
  users,
} from "@/lib/db/schema";
import { requireActorPermission, type WorkflowActor } from "./context";
import type { WorkflowDb, WorkflowTransaction } from "./db";
import { stockItemKey } from "./db";
import { loadStockLedger, loadStockLedgerGroups, postLedgerEntry } from "./ledger";
import { recordAudit } from "./audit";
import { WorkflowError } from "./errors";
import { inventoryAdjustmentInputSchema, type InventoryAdjustmentInput } from "./validation";

export type InventoryCategory = "raw" | "packaging" | "finished_good";
export type InventoryStatus = "healthy" | "low" | "out" | "expiring";

export type InventoryRow = {
  key: string;
  category: InventoryCategory;
  itemId: number;
  code: string;
  name: string;
  unit: string;
  baseUnit: "grams" | "millilitres" | "pieces";
  currentStock: number;
  averageCostPaise: number;
  stockValuePaise: number;
  minimumStock: number;
  status: InventoryStatus;
  alerts: string[];
  batchCount: number;
  expiringBatchCount: number;
  lastMovementAt: string | null;
  lastMovementSource: string | null;
};

export type InventoryFilter = {
  category?: string;
  query?: string;
  status?: string;
  sort?: string;
};

export type InventoryBatchView = {
  id: number;
  batchCode: string;
  receivedAt: string;
  expiresAt: string | null;
  supplierName: string | null;
  quantity: number;
  balance: number;
  unitCostPaise: number | null;
  alert: string | null;
};

export type MovementView = {
  id: number;
  transactionType: string;
  sourceType: string;
  sourceNumber: string;
  quantityDelta: number;
  balance: number;
  occurredAt: string;
};

export type InventoryDetail = InventoryRow & {
  batches: InventoryBatchView[];
  movements: MovementView[];
};

export type InventoryAdjustmentView = {
  id: number;
  adjustmentNumber: string;
  targetType: "raw" | "packaging" | "finished_good";
  targetId: number;
  direction: "increment" | "decrement";
  quantity: number;
  baseUnit: "grams" | "millilitres" | "pieces";
  reason: string;
  occurredAt: string;
  createdBy: string | null;
};

const EXPIRY_WINDOW_DAYS = 30;

export function listInventory(factoryId: number, filters: InventoryFilter = {}): InventoryRow[] {
  const category = parseCategory(filters.category);
  const query = filters.query?.trim().toLowerCase() ?? "";
  const rows =
    category === "raw"
      ? rawInventory(factoryId)
      : category === "packaging"
        ? packagingInventory(factoryId)
        : finishedInventory(factoryId);

  const filtered = rows.filter((row) => {
    const matchesQuery =
      query.length === 0 || row.code.toLowerCase().includes(query) || row.name.toLowerCase().includes(query);
    const matchesStatus = !filters.status || filters.status === "all" || row.status === filters.status;
    return matchesQuery && matchesStatus;
  });

  return sortInventory(filtered, filters.sort);
}

export function getInventoryOverview(factoryId: number) {
  const all = [...rawInventory(factoryId), ...packagingInventory(factoryId), ...finishedInventory(factoryId)];
  return {
    lowStock: all.filter((row) => row.status === "low" || row.status === "out").sort((a, b) => a.code.localeCompare(b.code)),
    expiring: all
      .filter((row) => row.expiringBatchCount > 0)
      .sort((a, b) => b.expiringBatchCount - a.expiringBatchCount),
  };
}

export function listInventoryAdjustments(factoryId: number): InventoryAdjustmentView[] {
  return getDb()
    .select({ adjustment: inventoryAdjustments, createdBy: users.fullName })
    .from(inventoryAdjustments)
    .leftJoin(users, eq(inventoryAdjustments.createdByUserId, users.id))
    .where(eq(inventoryAdjustments.factoryId, factoryId))
    .orderBy(desc(inventoryAdjustments.occurredAt), desc(inventoryAdjustments.id))
    .all()
    .map(({ adjustment, createdBy }) => ({
      id: adjustment.id,
      adjustmentNumber: adjustment.adjustmentNumber,
      targetType: (adjustment.rawMaterialBatchId !== null
        ? "raw"
        : adjustment.packagingBatchId !== null
          ? "packaging"
          : "finished_good") as InventoryAdjustmentView["targetType"],
      targetId: adjustment.rawMaterialBatchId ?? adjustment.packagingBatchId ?? adjustment.finishedGoodId ?? 0,
      direction: adjustment.direction as InventoryAdjustmentView["direction"],
      quantity: adjustment.quantityBase,
      baseUnit: adjustment.baseUnit as InventoryAdjustmentView["baseUnit"],
      reason: adjustment.reason,
      occurredAt: adjustment.occurredAt,
      createdBy,
    }));
}

export function getInventoryDetail(factoryId: number, key: string): InventoryDetail | null {
  const parsedKey = parseStockKey(key);
  if (!parsedKey) {
    return null;
  }

  const row =
    parsedKey.category === "raw"
      ? rawInventory(factoryId).find((candidate) => candidate.itemId === parsedKey.itemId && candidate.category === "raw")
      : parsedKey.category === "packaging"
        ? packagingInventory(factoryId).find(
            (candidate) => candidate.itemId === parsedKey.itemId && candidate.category === "packaging",
          )
        : finishedInventory(factoryId).find(
            (candidate) => candidate.itemId === parsedKey.itemId && candidate.category === "finished_good",
          );

  if (!row) {
    return null;
  }

  const batches =
    parsedKey.category === "raw"
      ? rawBatches(factoryId, parsedKey.itemId)
      : parsedKey.category === "packaging"
        ? packagingBatchesView(factoryId, parsedKey.itemId)
        : [];
  const targetIds = parsedKey.category === "finished_good" ? [parsedKey.itemId] : batches.map((batch) => batch.id);

  const movementRows = getDb()
    .select()
    .from(stockLedger)
    .where(eq(stockLedger.factoryId, factoryId))
    .orderBy(desc(stockLedger.id))
    .all()
    .filter((movement) => {
      if (parsedKey.category === "raw") {
        return movement.materialBatchId !== null && targetIds.includes(movement.materialBatchId);
      }
      if (parsedKey.category === "packaging") {
        return movement.packagingBatchId !== null && targetIds.includes(movement.packagingBatchId);
      }
      return movement.finishedGoodId === parsedKey.itemId;
    });

  return {
    ...row,
    batches,
    movements: movementRows.map((movement) => ({
      id: movement.id,
      transactionType: movement.transactionType,
      sourceType: movement.referenceType,
      sourceNumber: movement.referenceNumber,
      quantityDelta: movement.quantityDelta,
      balance: movement.balance,
      occurredAt: movement.occurredAt,
    })),
  };
}

export function createInventoryAdjustment(actor: WorkflowActor, input: InventoryAdjustmentInput) {
  requireActorPermission(actor, "inventory:manage");
  const data = inventoryAdjustmentInputSchema.parse(input);

  return getDb().transaction((tx) => {
    const existing = tx
      .select({ id: inventoryAdjustments.id })
      .from(inventoryAdjustments)
      .where(
        and(eq(inventoryAdjustments.factoryId, actor.factoryId), eq(inventoryAdjustments.adjustmentNumber, data.adjustmentNumber)),
      )
      .get();
    if (existing) {
      throw new WorkflowError("An adjustment with this number already exists.", "duplicate_adjustment", 409);
    }

    const target = resolveAdjustmentTarget(tx, actor.factoryId, data.targetType, data.targetId);
    const expectedUnit = data.targetType === "raw" ? "grams" : "pieces";
    if (data.baseUnit !== expectedUnit) {
      throw new WorkflowError(`This item uses ${expectedUnit}.`, "invalid_base_unit");
    }
    if (data.direction === "increment" && data.unitCostPaise === undefined) {
      throw new WorkflowError("A stock increase requires a unit cost.", "unit_cost_required");
    }

    const result = tx
      .insert(inventoryAdjustments)
      .values({
        factoryId: actor.factoryId,
        adjustmentNumber: data.adjustmentNumber,
        rawMaterialBatchId: data.targetType === "raw" ? data.targetId : null,
        packagingBatchId: data.targetType === "packaging" ? data.targetId : null,
        finishedGoodId: data.targetType === "finished_good" ? data.targetId : null,
        direction: data.direction,
        baseUnit: data.baseUnit,
        quantityBase: data.quantity,
        reason: data.reason,
        notes: data.notes || null,
        unitCostNumerator: data.unitCostPaise ?? null,
        unitCostDenominator: data.unitCostPaise === undefined ? null : 1,
        occurredAt: data.occurredAt,
        createdByUserId: actor.userId,
      })
      .run();
    const adjustmentId = Number(result.lastInsertRowid);

    postLedgerEntry(tx, {
      factoryId: actor.factoryId,
      target,
      transactionType: "adjustment",
      referenceType: "STOCK_ADJUSTMENT",
      referenceId: adjustmentId,
      referenceNumber: data.adjustmentNumber,
      baseUnit: data.baseUnit,
      quantityDelta: data.direction === "increment" ? data.quantity : -data.quantity,
      occurredAt: data.occurredAt,
      createdByUserId: actor.userId,
      unitCost: data.unitCostPaise === undefined ? undefined : createRational(data.unitCostPaise, 1),
    });

    recordAudit(tx, actor, "inventory.adjustment", "inventory_adjustment", adjustmentId, {
      adjustmentNumber: data.adjustmentNumber,
      target: data.targetType,
      reason: data.reason,
      direction: data.direction,
      quantity: data.quantity,
    });

    return { id: adjustmentId, adjustmentNumber: data.adjustmentNumber };
  });
}

function rawInventory(factoryId: number): InventoryRow[] {
  const db = getDb();
  const materials = db.select().from(rawMaterials).where(eq(rawMaterials.factoryId, factoryId)).all();
  const batches = db.select().from(materialBatches).where(eq(materialBatches.factoryId, factoryId)).all();

  return materials.map((material) => {
    const materialBatchesForItem = batches.filter((batch) => batch.rawMaterialId === material.id);
    const targets = materialBatchesForItem.map((batch) => ({ type: "raw" as const, id: batch.id }));
    const ledgerMap = loadStockLedgerGroups(db, factoryId, targets);
    const ledger = targets.flatMap((target) => ledgerMap.get(stockItemKey(target)) ?? []);
    return buildRow({
      category: "raw",
      itemId: material.id,
      code: material.code,
      name: material.name,
      unit: "kg",
      baseUnit: "grams",
      minimumStock: material.reorderLevelGrams,
      targets: materialBatchesForItem.map((batch) => ({ type: "raw", id: batch.id })),
      expiries: materialBatchesForItem.map((batch) => batch.expiresAt),
      ledger,
    });
  });
}

function packagingInventory(factoryId: number): InventoryRow[] {
  const db = getDb();
  const materials = db.select().from(packagingMaterials).where(eq(packagingMaterials.factoryId, factoryId)).all();
  const batches = db.select().from(packagingBatches).where(eq(packagingBatches.factoryId, factoryId)).all();

  return materials.map((material) => {
    const materialBatchesForItem = batches.filter((batch) => batch.packagingMaterialId === material.id);
    const targets = materialBatchesForItem.map((batch) => ({ type: "packaging" as const, id: batch.id }));
    const ledgerMap = loadStockLedgerGroups(db, factoryId, targets);
    const ledger = targets.flatMap((target) => ledgerMap.get(stockItemKey(target)) ?? []);
    return buildRow({
      category: "packaging",
      itemId: material.id,
      code: material.code,
      name: material.name,
      unit: "pcs",
      baseUnit: "pieces",
      minimumStock: material.reorderLevelUnits,
      targets: materialBatchesForItem.map((batch) => ({ type: "packaging", id: batch.id })),
      expiries: materialBatchesForItem.map((batch) => batch.expiresAt),
      ledger,
    });
  });
}

function finishedInventory(factoryId: number): InventoryRow[] {
  const db = getDb();
  const rows = db
    .select({
      id: finishedGoods.id,
      code: finishedGoods.batchCode,
      quantityGrams: finishedGoods.quantityGrams,
      expiresOn: finishedGoods.expiresOn,
      productCode: products.code,
      productName: products.name,
      packetGrams: products.packetGrams,
    })
    .from(finishedGoods)
    .innerJoin(products, eq(finishedGoods.productId, products.id))
    .where(eq(finishedGoods.factoryId, factoryId))
    .all();

  const targets = rows.map((row) => ({ type: "finished_good" as const, id: row.id }));
  const ledgerMap = loadStockLedgerGroups(db, factoryId, targets);
  return rows.map((row) => {
    const target = { type: "finished_good" as const, id: row.id };
    const ledger = ledgerMap.get(stockItemKey(target)) ?? [];
    return buildRow({
      category: "finished_good",
      itemId: row.id,
      code: row.code,
      name: row.productName,
      unit: `packets of ${row.packetGrams} g`,
      baseUnit: "pieces",
      minimumStock: 0,
      targets: [{ type: "finished_good", id: row.id }],
      expiries: [row.expiresOn],
      ledger,
    });
  });
}

function buildRow(input: {
  category: InventoryCategory;
  itemId: number;
  code: string;
  name: string;
  unit: string;
  baseUnit: "grams" | "millilitres" | "pieces";
  minimumStock: number;
  targets: { type: "raw" | "packaging" | "finished_good"; id: number }[];
  expiries: (string | null)[];
  ledger: ReturnType<typeof loadStockLedger>;
}): InventoryRow {
  const key = `${input.category}:${input.itemId}`;
  let currentStock = 0;
  let totalValue: Rational = rationalFromInteger(0);

  for (const target of input.targets) {
    const targetKey = `${target.type}:${target.id}`;
    const targetLedger = input.ledger.filter((movement) => movement.itemId === targetKey);
    const balance = calculateStockBalance(targetLedger, targetKey);
    currentStock += balance;
    if (balance > 0) {
      totalValue = rationalAdd(totalValue, calculateInventoryValue(targetLedger, targetKey));
    }
  }

  const averageCost = currentStock > 0 ? rationalToPaise(rationalDivide(totalValue, rationalFromInteger(currentStock))) : 0;
  const expiringBatchCount = input.expiries.filter((expiry) => expiry && isExpiring(expiry)).length;
  const alerts: string[] = [];
  let status: InventoryStatus = "healthy";

  if (currentStock === 0) {
    status = "out";
    alerts.push("Out of stock");
  } else if (currentStock < input.minimumStock) {
    status = "low";
    alerts.push("Below minimum");
  }
  if (expiringBatchCount > 0) {
    alerts.push(`${expiringBatchCount} expiring batch${expiringBatchCount === 1 ? "" : "es"}`);
    if (status === "healthy") {
      status = "expiring";
    }
  }

  const lastMovement = input.ledger.reduce<(typeof input.ledger)[number] | null>(
    (latest, movement) => (!latest || movement.occurredAt > latest.occurredAt ? movement : latest),
    null,
  );

  return {
    key,
    category: input.category,
    itemId: input.itemId,
    code: input.code,
    name: input.name,
    unit: input.unit,
    baseUnit: input.baseUnit,
    currentStock,
    averageCostPaise: averageCost,
    stockValuePaise: rationalToPaise(totalValue),
    minimumStock: input.minimumStock,
    status,
    alerts,
    batchCount: input.targets.length,
    expiringBatchCount,
    lastMovementAt: lastMovement?.occurredAt ?? null,
    lastMovementSource: lastMovement?.sourceReference ?? null,
  };
}

function rawBatches(factoryId: number, materialId: number): InventoryBatchView[] {
  const db = getDb();
  const batches = db
    .select({ batch: materialBatches, supplierName: suppliers.name })
    .from(materialBatches)
    .leftJoin(suppliers, eq(materialBatches.supplierId, suppliers.id))
    .where(and(eq(materialBatches.factoryId, factoryId), eq(materialBatches.rawMaterialId, materialId)))
    .orderBy(asc(materialBatches.receivedAt))
    .all();

  return batches.map(({ batch, supplierName }) => batchView(db, factoryId, { type: "raw", id: batch.id }, batch.batchCode, batch.receivedAt, batch.expiresAt, supplierName));
}

function packagingBatchesView(factoryId: number, materialId: number): InventoryBatchView[] {
  const db = getDb();
  const batches = db
    .select({ batch: packagingBatches, supplierName: suppliers.name })
    .from(packagingBatches)
    .leftJoin(suppliers, eq(packagingBatches.supplierId, suppliers.id))
    .where(and(eq(packagingBatches.factoryId, factoryId), eq(packagingBatches.packagingMaterialId, materialId)))
    .orderBy(asc(packagingBatches.receivedAt))
    .all();

  return batches.map(({ batch, supplierName }) => batchView(db, factoryId, { type: "packaging", id: batch.id }, batch.batchCode, batch.receivedAt, batch.expiresAt, supplierName));
}

function batchView(
  db: WorkflowDb,
  factoryId: number,
  target: { type: "raw" | "packaging"; id: number },
  batchCode: string,
  receivedAt: string,
  expiresAt: string | null,
  supplierName: string | null,
): InventoryBatchView {
  const ledger = loadStockLedger(db, factoryId, target);
  const itemId = `${target.type}:${target.id}`;
  const balance = calculateStockBalance(ledger, itemId);
  const cost = balance > 0 ? rationalToPaise(rationalDivide(calculateInventoryValue(ledger, itemId), rationalFromInteger(balance))) : null;
  return {
    id: target.id,
    batchCode,
    receivedAt,
    expiresAt,
    supplierName,
    quantity: ledger.filter((movement) => movement.quantityDelta > 0).reduce((sum, movement) => sum + movement.quantityDelta, 0),
    balance,
    unitCostPaise: cost,
    alert: expiresAt && isExpiring(expiresAt) ? "Expiring soon" : null,
  };
}

function resolveAdjustmentTarget(
  tx: WorkflowTransaction,
  factoryId: number,
  targetType: InventoryAdjustmentInput["targetType"],
  targetId: number,
): { type: "raw" | "packaging" | "finished_good"; id: number } {
  if (targetType === "raw") {
    const row = tx
      .select({ id: materialBatches.id })
      .from(materialBatches)
      .where(and(eq(materialBatches.id, targetId), eq(materialBatches.factoryId, factoryId)))
      .get();
    if (row) {
      return { type: "raw", id: row.id };
    }
  } else if (targetType === "packaging") {
    const row = tx
      .select({ id: packagingBatches.id })
      .from(packagingBatches)
      .where(and(eq(packagingBatches.id, targetId), eq(packagingBatches.factoryId, factoryId)))
      .get();
    if (row) {
      return { type: "packaging", id: row.id };
    }
  } else {
    const row = tx
      .select({ id: finishedGoods.id })
      .from(finishedGoods)
      .where(and(eq(finishedGoods.id, targetId), eq(finishedGoods.factoryId, factoryId)))
      .get();
    if (row) {
      return { type: "finished_good", id: row.id };
    }
  }

  throw new WorkflowError("Inventory target not found.", "unknown_target", 404);
}

function parseCategory(value: string | undefined): InventoryCategory {
  if (value === "packaging" || value === "finished_good") {
    return value;
  }
  return "raw";
}

function parseStockKey(key: string): { category: InventoryCategory; itemId: number } | null {
  const [category, rawId] = key.split(":");
  const itemId = Number(rawId);
  if (!Number.isInteger(itemId) || itemId <= 0) {
    return null;
  }
  if (category === "raw" || category === "packaging" || category === "finished_good") {
    return { category, itemId };
  }
  return null;
}

function isExpiring(value: string) {
  const expiry = Date.parse(value);
  if (Number.isNaN(expiry)) {
    return false;
  }
  return expiry <= Date.now() + EXPIRY_WINDOW_DAYS * 24 * 60 * 60 * 1000;
}

function sortInventory(rows: InventoryRow[], sort: string | undefined) {
  const sorted = [...rows];
  if (sort === "stock") {
    return sorted.sort((a, b) => b.currentStock - a.currentStock);
  }
  if (sort === "value") {
    return sorted.sort((a, b) => b.stockValuePaise - a.stockValuePaise);
  }
  if (sort === "status") {
    const rank: Record<InventoryStatus, number> = { out: 0, low: 1, expiring: 2, healthy: 3 };
    return sorted.sort((a, b) => rank[a.status] - rank[b.status] || a.code.localeCompare(b.code));
  }
  return sorted.sort((a, b) => a.code.localeCompare(b.code));
}

export function formatInventoryQuantity(value: number, unit: string) {
  return `${new Intl.NumberFormat("en-IN").format(value)} ${unit}`;
}

export function formatInventoryMoney(paise: number) {
  return formatPaise(paise);
}

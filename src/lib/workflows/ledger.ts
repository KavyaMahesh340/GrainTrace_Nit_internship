import { and, asc, eq } from "drizzle-orm";
import { createRational, postStockMovement, type BaseUnit, type PostedStockMovement, type Rational, type StockMovementInput } from "@/domain";
import { finishedGoods, materialBatches, packagingBatches, products, stockLedger } from "@/lib/db/schema";
import type { WorkflowDb, WorkflowTransaction } from "./db";
import { stockItemKey, type StockTarget } from "./db";

type LedgerPosting = {
  factoryId: number;
  target: StockTarget;
  transactionType: string;
  referenceType: string;
  referenceId: number;
  referenceNumber: string;
  baseUnit: BaseUnit;
  quantityDelta: number;
  occurredAt: string;
  createdByUserId: number;
  unitCost?: Rational;
  movementKey?: string;
};

function toMovement(row: typeof stockLedger.$inferSelect, target: StockTarget): PostedStockMovement {
  return {
    movementId:
      row.movementKey ?? `${row.referenceType}:${row.referenceNumber}:${row.id}`,
    itemId: stockItemKey(target),
    baseUnit: row.baseUnit as BaseUnit,
    quantityDelta: row.quantityDelta,
    occurredAt: row.occurredAt,
    sourceType: row.referenceType,
    sourceReference: row.referenceNumber,
    unitCost:
      row.unitCostNumerator === null || row.unitCostDenominator === null
        ? undefined
        : createRational(row.unitCostNumerator, row.unitCostDenominator),
    balance: row.balance,
  };
}

function targetForRow(row: typeof stockLedger.$inferSelect): StockTarget | null {
  if (row.materialBatchId !== null) return { type: "raw", id: row.materialBatchId };
  if (row.packagingBatchId !== null) return { type: "packaging", id: row.packagingBatchId };
  if (row.finishedGoodId !== null) return { type: "finished_good", id: row.finishedGoodId };
  return null;
}

export function loadStockLedger(
  tx: WorkflowDb | WorkflowTransaction,
  factoryId: number,
  target: StockTarget,
): PostedStockMovement[] {
  const targetField =
    target.type === "raw"
      ? stockLedger.materialBatchId
      : target.type === "packaging"
        ? stockLedger.packagingBatchId
        : stockLedger.finishedGoodId;

  const rows = tx
    .select()
    .from(stockLedger)
    .where(and(eq(stockLedger.factoryId, factoryId), eq(targetField, target.id)))
    .orderBy(asc(stockLedger.id))
    .all();

  return rows.map((row) => toMovement(row, target));
}

export function loadStockLedgerGroups(
  tx: WorkflowDb | WorkflowTransaction,
  factoryId: number,
  targets: StockTarget[],
): Map<string, PostedStockMovement[]> {
  const grouped = new Map<string, PostedStockMovement[]>();
  for (const target of targets) {
    const key = stockItemKey(target);
    if (!grouped.has(key)) grouped.set(key, []);
  }
  const rows = tx
    .select()
    .from(stockLedger)
    .where(eq(stockLedger.factoryId, factoryId))
    .orderBy(asc(stockLedger.id))
    .all();
  for (const row of rows) {
    const target = targetForRow(row);
    if (!target) continue;
    const key = stockItemKey(target);
    const entries = grouped.get(key);
    if (!entries) continue;
    entries.push(toMovement(row, target));
  }
  return grouped;
}

function gramsForMovement(
  tx: WorkflowTransaction,
  posting: LedgerPosting,
  posted: PostedStockMovement,
): { deltaGrams: number; balanceGrams: number } {
  if (posting.target.type === "raw") {
    return { deltaGrams: posting.quantityDelta, balanceGrams: posted.balance };
  }
  if (posting.target.type === "finished_good") {
    const packet = tx
      .select({ packetGrams: products.packetGrams })
      .from(finishedGoods)
      .innerJoin(products, eq(finishedGoods.productId, products.id))
      .where(and(eq(finishedGoods.factoryId, posting.factoryId), eq(finishedGoods.id, posting.target.id)))
      .get();
    if (!packet) throw new Error("Finished-good batch is unavailable for stock accounting.");
    return {
      deltaGrams: posting.quantityDelta * packet.packetGrams,
      balanceGrams: posted.balance * packet.packetGrams,
    };
  }
  return { deltaGrams: 0, balanceGrams: 0 };
}

function syncStoredBalance(
  tx: WorkflowTransaction,
  posting: LedgerPosting,
  balance: number,
  balanceGrams: number,
): void {
  const updatedAt = new Date().toISOString();
  if (posting.target.type === "raw") {
    tx.update(materialBatches)
      .set({ availableGrams: balance, updatedAt })
      .where(eq(materialBatches.id, posting.target.id))
      .run();
    return;
  }
  if (posting.target.type === "packaging") {
    tx.update(packagingBatches)
      .set({ availableUnits: balance, updatedAt })
      .where(eq(packagingBatches.id, posting.target.id))
      .run();
    return;
  }
  tx.update(finishedGoods)
    .set({ availableGrams: balanceGrams, updatedAt })
    .where(eq(finishedGoods.id, posting.target.id))
    .run();
}

export function postLedgerEntry(tx: WorkflowTransaction, posting: LedgerPosting) {
  const ledger = loadStockLedger(tx, posting.factoryId, posting.target);
  const movementKey =
    posting.movementKey ??
    `${posting.transactionType}:${posting.referenceType}:${posting.referenceNumber}:${posting.target.type}:${posting.target.id}`;
  const movement: StockMovementInput = {
    movementId: movementKey,
    itemId: stockItemKey(posting.target),
    baseUnit: posting.baseUnit,
    quantityDelta: posting.quantityDelta,
    occurredAt: posting.occurredAt,
    sourceType: posting.referenceType,
    sourceReference: posting.referenceNumber,
    unitCost: posting.unitCost,
  };

  const nextLedger = postStockMovement(ledger, movement);
  const posted = nextLedger[nextLedger.length - 1];
  const grams = gramsForMovement(tx, posting, posted);

  tx.insert(stockLedger)
    .values({
      factoryId: posting.factoryId,
      movementKey,
      materialBatchId: posting.target.type === "raw" ? posting.target.id : null,
      packagingBatchId: posting.target.type === "packaging" ? posting.target.id : null,
      finishedGoodId: posting.target.type === "finished_good" ? posting.target.id : null,
      transactionType: posting.transactionType,
      referenceType: posting.referenceType,
      referenceId: posting.referenceId,
      referenceNumber: posting.referenceNumber,
      baseUnit: posting.baseUnit,
      quantityDelta: posting.quantityDelta,
      balance: posted.balance,
      quantityDeltaGrams: grams.deltaGrams,
      balanceGrams: grams.balanceGrams,
      unitCostNumerator: posting.unitCost?.numerator ?? null,
      unitCostDenominator: posting.unitCost?.denominator ?? null,
      occurredAt: posting.occurredAt,
      createdByUserId: posting.createdByUserId,
    })
    .run();
  syncStoredBalance(tx, posting, posted.balance, grams.balanceGrams);

  return posted;
}

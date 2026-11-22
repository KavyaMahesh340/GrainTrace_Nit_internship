import { and, asc, eq } from "drizzle-orm";
import { createRational, postStockMovement, type BaseUnit, type PostedStockMovement, type Rational, type StockMovementInput } from "@/domain";
import { stockLedger } from "@/lib/db/schema";
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
};

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

  return rows.map((row) => ({
    movementId: `${row.referenceType}:${row.referenceNumber}:${row.id}`,
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
  }));
}

export function postLedgerEntry(tx: WorkflowTransaction, posting: LedgerPosting) {
  const ledger = loadStockLedger(tx, posting.factoryId, posting.target);
  const movement: StockMovementInput = {
    movementId: `${posting.referenceType}:${posting.referenceNumber}:${posting.target.type}:${posting.target.id}`,
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

  tx.insert(stockLedger)
    .values({
      factoryId: posting.factoryId,
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
      quantityDeltaGrams: posting.quantityDelta,
      balanceGrams: posted.balance,
      unitCostNumerator: posting.unitCost?.numerator ?? null,
      unitCostDenominator: posting.unitCost?.denominator ?? null,
      occurredAt: posting.occurredAt,
      createdByUserId: posting.createdByUserId,
    })
    .run();

  return posted;
}

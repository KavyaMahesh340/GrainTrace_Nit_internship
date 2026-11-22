import {
  createRational,
} from "./money";
import { BASE_UNITS } from "./units";
import type { PostedStockMovement, StockItemId, StockMovementInput } from "./types";
import {
  assertNonEmptyString,
  assertNonZeroInteger,
  assertSafeInteger,
  assertUniqueIds,
  DuplicatePostingError,
  InsufficientStockError,
  UnitConversionError,
  ValidationError,
} from "./validation";

function validateMovement(movement: StockMovementInput): void {
  assertNonEmptyString(movement.movementId, "movement id");
  assertNonEmptyString(movement.itemId, "stock item id");
  assertNonEmptyString(movement.sourceType, "source type");
  assertNonEmptyString(movement.sourceReference, "source reference");
  assertNonEmptyString(movement.occurredAt, "occurred at");
  assertNonZeroInteger(movement.quantityDelta, "quantity delta");

  if (!BASE_UNITS.includes(movement.baseUnit)) {
    throw new UnitConversionError(`Unsupported base unit: ${movement.baseUnit}.`);
  }

  if (movement.unitCost) {
    const unitCost = createRational(movement.unitCost.numerator, movement.unitCost.denominator);
    if (unitCost.numerator < 0) {
      throw new ValidationError("Unit cost cannot be negative.");
    }
  }
}

export function assertValidLedger(ledger: readonly PostedStockMovement[]): void {
  assertUniqueIds(ledger, (movement) => movement.movementId, "stock movement", DuplicatePostingError);

  const unitsByItem = new Map<StockItemId, string>();
  const balances = new Map<StockItemId, number>();

  for (const movement of ledger) {
    validateMovement(movement);
    const knownUnit = unitsByItem.get(movement.itemId);
    if (knownUnit && knownUnit !== movement.baseUnit) {
      throw new UnitConversionError(`Stock item ${movement.itemId} uses inconsistent base units.`);
    }
    unitsByItem.set(movement.itemId, movement.baseUnit);

    const balance = assertSafeInteger((balances.get(movement.itemId) ?? 0) + movement.quantityDelta, "stock balance");
    if (balance < 0) {
      throw new InsufficientStockError(`Stock for ${movement.itemId} cannot become negative.`);
    }
    balances.set(movement.itemId, balance);
  }
}

export function calculateStockBalance(ledger: readonly PostedStockMovement[], itemId: StockItemId): number {
  assertValidLedger(ledger);
  assertNonEmptyString(itemId, "stock item id");
  return ledger
    .filter((movement) => movement.itemId === itemId)
    .reduce((balance, movement) => balance + movement.quantityDelta, 0);
}

export function assertSufficientStock(
  ledger: readonly PostedStockMovement[],
  itemId: StockItemId,
  requiredQuantity: number,
): void {
  const available = calculateStockBalance(ledger, itemId);
  if (requiredQuantity > available) {
    throw new InsufficientStockError(`Required ${requiredQuantity} of ${itemId}, but only ${available} is available.`);
  }
}

export function postStockMovement(
  ledger: readonly PostedStockMovement[],
  movement: StockMovementInput,
): PostedStockMovement[] {
  validateMovement(movement);
  const existingIds = new Set(ledger.map((entry) => entry.movementId));
  if (existingIds.has(movement.movementId)) {
    throw new DuplicatePostingError(`Stock movement ${movement.movementId} has already been posted.`);
  }

  const posted: PostedStockMovement = { ...movement, balance: 0 };
  const candidate = [...ledger, posted];
  const balance = calculateStockBalance(candidate, movement.itemId);
  return [...ledger, { ...posted, balance }];
}

export function sumConsumptionBySource(
  ledger: readonly PostedStockMovement[],
  sourceReference: string,
): Map<StockItemId, number> {
  assertValidLedger(ledger);
  assertNonEmptyString(sourceReference, "source reference");

  const consumption = new Map<StockItemId, number>();
  for (const movement of ledger) {
    if (movement.sourceReference !== sourceReference || movement.quantityDelta >= 0) {
      continue;
    }
    const quantity = assertSafeInteger(consumption.get(movement.itemId) ?? 0, "consumed quantity") - movement.quantityDelta;
    consumption.set(movement.itemId, quantity);
  }
  return consumption;
}

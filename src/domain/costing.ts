import { assertValidLedger } from "./inventory";
import {
  createRational,
  rationalAdd,
  rationalDivide,
  rationalFromInteger,
  rationalMultiply,
  rationalSubtract,
  rationalToPaise,
  type Paise,
  type Rational,
} from "./money";
import type { PostedStockMovement, StockItemId } from "./types";
import { assertPositiveInteger, InsufficientStockError, ValidationError } from "./validation";

function normalizeUnitCost(unitCost: Rational | undefined, itemId: StockItemId): Rational {
  if (!unitCost) {
    throw new ValidationError(`A receipt for ${itemId} must include a unit cost.`);
  }

  const normalized = createRational(unitCost.numerator, unitCost.denominator);
  if (normalized.numerator < 0) {
    throw new ValidationError(`Unit cost for ${itemId} cannot be negative.`);
  }
  return normalized;
}

export function calculateInventoryValue(
  ledger: readonly PostedStockMovement[],
  itemId: StockItemId,
): Rational {
  assertValidLedger(ledger);

  let totalQuantity = 0;
  let totalValue = createRational(0, 1);

  for (const movement of ledger) {
    if (movement.itemId !== itemId) {
      continue;
    }

    if (movement.quantityDelta > 0) {
      const unitCost = normalizeUnitCost(movement.unitCost, itemId);
      totalValue = rationalAdd(totalValue, rationalMultiply(unitCost, rationalFromInteger(movement.quantityDelta)));
      totalQuantity += movement.quantityDelta;
      continue;
    }

    const issuedQuantity = -movement.quantityDelta;
    if (issuedQuantity > totalQuantity) {
      throw new InsufficientStockError(`Insufficient costed inventory for ${itemId}.`);
    }
    const averageCost = rationalDivide(totalValue, rationalFromInteger(totalQuantity));
    const issuedValue = rationalMultiply(averageCost, rationalFromInteger(issuedQuantity));
    totalValue = rationalSubtract(totalValue, issuedValue);
    totalQuantity -= issuedQuantity;
  }

  return totalValue;
}

export function calculateWeightedAverageCost(
  ledger: readonly PostedStockMovement[],
  itemId: StockItemId,
): Rational {
  const quantity = ledger
    .filter((movement) => movement.itemId === itemId)
    .reduce((total, movement) => total + movement.quantityDelta, 0);
  assertPositiveInteger(quantity, `available quantity for ${itemId}`);

  return rationalDivide(calculateInventoryValue(ledger, itemId), rationalFromInteger(quantity));
}

export function calculateCostOfUsage(unitCost: Rational, quantity: number): Paise {
  assertPositiveInteger(quantity, "usage quantity");
  const normalized = createRational(unitCost.numerator, unitCost.denominator);
  if (normalized.numerator < 0) {
    throw new ValidationError("Unit cost cannot be negative.");
  }
  return rationalToPaise(rationalMultiply(normalized, rationalFromInteger(quantity)));
}

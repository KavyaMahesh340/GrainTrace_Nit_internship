import type { FulfilmentPlan } from "./types";
import { assertNonEmptyString, assertNonNegativeInteger, InsufficientStockError, ValidationError } from "./validation";

export function createFulfilmentPlan(input: {
  orderNumber: string;
  orderedPackets: number;
  availablePackets: number;
  alreadyFulfilledPackets?: number;
}): FulfilmentPlan {
  const orderNumber = assertNonEmptyString(input.orderNumber, "order number");
  const ordered = assertNonNegativeInteger(input.orderedPackets, "ordered packets");
  const available = assertNonNegativeInteger(input.availablePackets, "available packets");
  const alreadyFulfilled = assertNonNegativeInteger(
    input.alreadyFulfilledPackets ?? 0,
    "already fulfilled packets",
  );

  if (alreadyFulfilled > ordered) {
    throw new ValidationError("Already fulfilled packets cannot exceed ordered packets.");
  }

  const requested = ordered - alreadyFulfilled;
  const fulfillable = Math.min(requested, available);
  const backorder = requested - fulfillable;

  return {
    orderNumber,
    requestedPackets: requested,
    availablePackets: available,
    fulfillablePackets: fulfillable,
    backorderPackets: backorder,
    shortagePackets: backorder,
    isPartial: backorder > 0,
  };
}

export function assertDispatchable(quantityPackets: number, availablePackets: number): void {
  const quantity = assertNonNegativeInteger(quantityPackets, "dispatch quantity");
  const available = assertNonNegativeInteger(availablePackets, "available packets");
  if (quantity === 0) {
    throw new ValidationError("Dispatch quantity must be greater than zero.");
  }
  if (quantity > available) {
    throw new InsufficientStockError(`Cannot dispatch ${quantity} packets with ${available} available.`);
  }
}

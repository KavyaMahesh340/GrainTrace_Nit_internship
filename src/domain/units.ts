import { createRational, type Rational } from "./money";
import { assertNonNegativeInteger, UnitConversionError } from "./validation";

export const BASE_UNITS = ["grams", "millilitres", "pieces"] as const;
export type BaseUnit = (typeof BASE_UNITS)[number];

export const UNIT_CODES = ["g", "kg", "ml", "l", "piece", "pouch", "carton", "packet"] as const;
export type UnitCode = (typeof UNIT_CODES)[number];

const UNIT_DEFINITIONS: Record<UnitCode, { baseUnit: BaseUnit; factor: number }> = {
  g: { baseUnit: "grams", factor: 1 },
  kg: { baseUnit: "grams", factor: 1_000 },
  ml: { baseUnit: "millilitres", factor: 1 },
  l: { baseUnit: "millilitres", factor: 1_000 },
  piece: { baseUnit: "pieces", factor: 1 },
  pouch: { baseUnit: "pieces", factor: 1 },
  carton: { baseUnit: "pieces", factor: 1 },
  packet: { baseUnit: "pieces", factor: 1 },
};

export function baseUnitFor(unit: UnitCode): BaseUnit {
  return UNIT_DEFINITIONS[unit].baseUnit;
}

export function toBaseQuantity(value: number, unit: UnitCode): number {
  const quantity = assertNonNegativeInteger(value, "quantity");
  return quantity * UNIT_DEFINITIONS[unit].factor;
}

export function fromBaseQuantity(value: number, unit: UnitCode): number {
  const quantity = assertNonNegativeInteger(value, "base quantity");
  const factor = UNIT_DEFINITIONS[unit].factor;
  if (quantity % factor !== 0) {
    throw new UnitConversionError(`${quantity} cannot be converted exactly to ${unit}.`);
  }
  return quantity / factor;
}

export function convertQuantity(value: number, fromUnit: UnitCode, toUnit: UnitCode): number {
  const from = UNIT_DEFINITIONS[fromUnit];
  const to = UNIT_DEFINITIONS[toUnit];
  if (from.baseUnit !== to.baseUnit) {
    throw new UnitConversionError(`${fromUnit} cannot be converted to ${toUnit}.`);
  }
  const baseQuantity = toBaseQuantity(value, fromUnit);
  return fromBaseQuantity(baseQuantity, toUnit);
}

export function convertQuantityToRational(
  value: number,
  fromUnit: UnitCode,
  toUnit: UnitCode,
): Rational {
  const from = UNIT_DEFINITIONS[fromUnit];
  const to = UNIT_DEFINITIONS[toUnit];
  if (from.baseUnit !== to.baseUnit) {
    throw new UnitConversionError(`${fromUnit} cannot be converted to ${toUnit}.`);
  }
  return createRational(toBaseQuantity(value, fromUnit), to.factor);
}

export function assertMatchingBaseUnits(left: BaseUnit, right: BaseUnit): void {
  if (left !== right) {
    throw new UnitConversionError(`Expected ${right} but received ${left}.`);
  }
}

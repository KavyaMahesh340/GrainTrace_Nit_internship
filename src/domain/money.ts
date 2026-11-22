import { assertNonNegativeInteger, assertPositiveInteger, assertSafeInteger, ValidationError } from "./validation";

export type Paise = number;

export type Rational = {
  numerator: number;
  denominator: number;
};

function greatestCommonDivisor(left: number, right: number): number {
  let a = Math.abs(left);
  let b = Math.abs(right);
  while (b !== 0) {
    const remainder = a % b;
    a = b;
    b = remainder;
  }
  return a === 0 ? 1 : a;
}

export function createRational(numerator: number, denominator: number): Rational {
  assertSafeInteger(numerator, "rational numerator");
  assertSafeInteger(denominator, "rational denominator");
  if (denominator <= 0) {
    throw new ValidationError("rational denominator must be greater than zero.");
  }

  const divisor = greatestCommonDivisor(numerator, denominator);
  return {
    numerator: numerator / divisor,
    denominator: denominator / divisor,
  };
}

export function rationalFromInteger(value: number): Rational {
  return createRational(value, 1);
}

export function rationalAdd(left: Rational, right: Rational): Rational {
  return createRational(
    left.numerator * right.denominator + right.numerator * left.denominator,
    left.denominator * right.denominator,
  );
}

export function rationalSubtract(left: Rational, right: Rational): Rational {
  return createRational(
    left.numerator * right.denominator - right.numerator * left.denominator,
    left.denominator * right.denominator,
  );
}

export function rationalMultiply(left: Rational, right: Rational): Rational {
  return createRational(left.numerator * right.numerator, left.denominator * right.denominator);
}

export function rationalDivide(left: Rational, right: Rational): Rational {
  if (right.numerator === 0) {
    throw new ValidationError("Cannot divide by a zero rational.");
  }
  return createRational(left.numerator * right.denominator, left.denominator * right.numerator);
}

export function roundRationalToInteger(value: Rational): number {
  const absoluteNumerator = Math.abs(value.numerator);
  const roundedMagnitude = Math.floor((2 * absoluteNumerator + value.denominator) / (2 * value.denominator));
  return value.numerator < 0 ? -roundedMagnitude : roundedMagnitude;
}

export function rationalToPaise(value: Rational): Paise {
  if (value.numerator < 0) {
    throw new ValidationError("Money cannot be negative.");
  }
  const result = roundRationalToInteger(value);
  assertSafeInteger(result, "paise");
  return result;
}

export function assertPaise(value: number, label = "amount"): Paise {
  return assertNonNegativeInteger(value, label);
}

export function addPaise(...amounts: readonly Paise[]): Paise {
  const total = amounts.reduce((sum, amount) => sum + assertPaise(amount), 0);
  return assertSafeInteger(total, "paise total");
}

export function subtractPaise(minuend: Paise, subtrahend: Paise): Paise {
  const result = assertPaise(minuend) - assertPaise(subtrahend);
  if (result < 0) {
    throw new ValidationError("Money subtraction cannot produce a negative amount.");
  }
  return result;
}

export function multiplyPaiseByInteger(amount: Paise, multiplier: number): Paise {
  const result = assertPaise(amount) * assertNonNegativeInteger(multiplier, "multiplier");
  return assertSafeInteger(result, "paise product");
}

export function applyBasisPoints(amount: Paise, basisPoints: number): Paise {
  assertPaise(amount);
  assertNonNegativeInteger(basisPoints, "basis points");
  return rationalToPaise(createRational(amount * basisPoints, 10_000));
}

export function calculateBasisPoints(numerator: number, denominator: number): number {
  assertNonNegativeInteger(numerator, "basis point numerator");
  assertPositiveInteger(denominator, "basis point denominator");
  return roundRationalToInteger(createRational(numerator * 10_000, denominator));
}

export function calculateVarianceBasisPoints(actual: number, planned: number): number {
  assertNonNegativeInteger(actual, "actual quantity");
  assertPositiveInteger(planned, "planned quantity");
  return roundRationalToInteger(createRational((actual - planned) * 10_000, planned));
}

export function calculateMarginBasisPoints(sellingPrice: Paise, cost: Paise): number {
  assertPositiveInteger(sellingPrice, "selling price");
  assertPaise(cost, "cost");
  if (cost > sellingPrice) {
    return -calculateBasisPoints(cost - sellingPrice, sellingPrice);
  }
  return calculateBasisPoints(sellingPrice - cost, sellingPrice);
}

export function calculateMarkupBasisPoints(sellingPrice: Paise, cost: Paise): number {
  assertPositiveInteger(sellingPrice, "selling price");
  assertPositiveInteger(cost, "cost");
  if (cost > sellingPrice) {
    return -calculateBasisPoints(cost - sellingPrice, cost);
  }
  return calculateBasisPoints(sellingPrice - cost, cost);
}

export function formatPaise(value: Paise): string {
  assertSafeInteger(value, "paise");
  const sign = value < 0 ? "-" : "";
  const absolute = Math.abs(value);
  const rupees = Math.floor(absolute / 100);
  const paise = absolute % 100;
  return `${sign}₹${rupees}.${String(paise).padStart(2, "0")}`;
}

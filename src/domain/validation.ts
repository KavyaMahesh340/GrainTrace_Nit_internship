export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DomainError";
  }
}

export class ValidationError extends DomainError {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

export class UnitConversionError extends DomainError {
  constructor(message: string) {
    super(message);
    this.name = "UnitConversionError";
  }
}

export class InsufficientStockError extends DomainError {
  constructor(message: string) {
    super(message);
    this.name = "InsufficientStockError";
  }
}

export class DuplicatePostingError extends DomainError {
  constructor(message: string) {
    super(message);
    this.name = "DuplicatePostingError";
  }
}

export class OverpaymentError extends DomainError {
  constructor(message: string) {
    super(message);
    this.name = "OverpaymentError";
  }
}

export function assertSafeInteger(value: number, label: string): number {
  if (!Number.isSafeInteger(value)) {
    throw new ValidationError(`${label} must be a safe integer.`);
  }
  return value;
}

export function assertPositiveInteger(value: number, label: string): number {
  assertSafeInteger(value, label);
  if (value <= 0) {
    throw new ValidationError(`${label} must be greater than zero.`);
  }
  return value;
}

export function assertNonNegativeInteger(value: number, label: string): number {
  assertSafeInteger(value, label);
  if (value < 0) {
    throw new ValidationError(`${label} must not be negative.`);
  }
  return value;
}

export function assertNonZeroInteger(value: number, label: string): number {
  assertSafeInteger(value, label);
  if (value === 0) {
    throw new ValidationError(`${label} must not be zero.`);
  }
  return value;
}

export function assertNonEmptyString(value: string, label: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new ValidationError(`${label} must not be empty.`);
  }
  return value.trim();
}

export function assertUniqueIds<T>(
  items: readonly T[],
  getId: (item: T) => string,
  label: string,
  ErrorType: new (message: string) => DomainError = DuplicatePostingError,
): void {
  const seen = new Set<string>();
  for (const item of items) {
    const id = assertNonEmptyString(getId(item), `${label} id`);
    if (seen.has(id)) {
      throw new ErrorType(`Duplicate ${label.toLowerCase()} id: ${id}.`);
    }
    seen.add(id);
  }
}

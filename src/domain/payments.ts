import { subtractPaise, type Paise } from "./money";
import type { PaymentMethod, PaymentRecord } from "./types";
import {
  assertNonEmptyString,
  assertSafeInteger,
  assertNonNegativeInteger,
  assertPositiveInteger,
  assertUniqueIds,
  OverpaymentError,
  ValidationError,
} from "./validation";

export const PAYMENT_METHODS: readonly PaymentMethod[] = [
  "cash",
  "upi",
  "bank_transfer",
  "cheque",
  "other",
];

export function signedPaymentPaise(payment: PaymentRecord): number {
  const amountPaise = assertPositiveInteger(payment.amountPaise, "payment amount");
  if (payment.direction === "debit") {
    return -amountPaise;
  }
  if (payment.direction !== undefined && payment.direction !== "credit") {
    throw new ValidationError(`Unsupported payment direction: ${payment.direction}.`);
  }
  return amountPaise;
}

export function calculateAmountPaid(payments: readonly PaymentRecord[]): Paise {
  let total = 0;
  for (const payment of payments) {
    total += signedPaymentPaise(payment);
    if (total < 0) {
      throw new ValidationError("Payment corrections cannot produce a negative receipt balance.");
    }
  }
  return assertSafeInteger(total, "paid total");
}

export function calculateOutstandingBalance(invoiceTotalPaise: Paise, payments: readonly PaymentRecord[]): Paise {
  return subtractPaise(invoiceTotalPaise, calculateAmountPaid(payments));
}

export function recordPayment(
  payments: readonly PaymentRecord[],
  input: PaymentRecord,
  invoiceTotalPaise: Paise,
): PaymentRecord[] {
  assertNonEmptyString(input.paymentId, "payment id");
  assertNonEmptyString(input.invoiceNumber, "invoice number");
  assertNonEmptyString(input.paidAt, "paid at");
  const amountPaise = assertPositiveInteger(input.amountPaise, "payment amount");
  if (!PAYMENT_METHODS.includes(input.method)) {
    throw new ValidationError(`Unsupported payment method: ${input.method}.`);
  }
  assertUniqueIds(payments, (payment) => payment.paymentId, "payment");

  const existingIds = new Set(payments.map((payment) => payment.paymentId));
  if (existingIds.has(input.paymentId)) {
    throw new ValidationError(`Payment ${input.paymentId} has already been recorded.`);
  }

  const proposed = [...payments, { ...input, amountPaise, direction: "credit" as const }];
  const total = calculateAmountPaid(proposed);
  if (total > invoiceTotalPaise) {
    throw new OverpaymentError(
      `Payment would exceed invoice total by ${total - invoiceTotalPaise} paise.`,
    );
  }

  return proposed;
}

export function recordPaymentCorrection(
  payments: readonly PaymentRecord[],
  originalPaymentId: string,
  input: {
    paymentId: string;
    invoiceNumber: string;
    amountPaise: Paise;
    method: PaymentMethod;
    paidAt: string;
    reason: string;
  },
  invoiceTotalPaise: Paise,
): PaymentRecord[] {
  assertNonEmptyString(originalPaymentId, "payment id");
  assertNonEmptyString(input.paymentId, "correction id");
  assertNonEmptyString(input.invoiceNumber, "invoice number");
  assertNonEmptyString(input.paidAt, "correction date");
  assertNonEmptyString(input.reason, "correction reason");
  const amountPaise = assertPositiveInteger(input.amountPaise, "correction amount");
  if (!PAYMENT_METHODS.includes(input.method)) {
    throw new ValidationError(`Unsupported payment method: ${input.method}.`);
  }
  assertUniqueIds(payments, (payment) => payment.paymentId, "payment");

  const original = payments.find(
    (payment) => payment.paymentId === originalPaymentId && payment.direction !== "debit",
  );
  if (!original) {
    throw new ValidationError(`Payment ${originalPaymentId} was not found.`);
  }
  if (original.invoiceNumber !== input.invoiceNumber) {
    throw new ValidationError("A correction must stay on the original invoice.");
  }

  const alreadyCorrected = payments
    .filter((payment) => payment.correctsPaymentId === originalPaymentId)
    .reduce((total, payment) => total + assertPositiveInteger(payment.amountPaise, "correction amount"), 0);
  if (alreadyCorrected + amountPaise > original.amountPaise) {
    throw new ValidationError("Correction cannot exceed the original payment amount.");
  }

  const proposed = [
    ...payments,
    {
      paymentId: input.paymentId,
      invoiceNumber: input.invoiceNumber,
      amountPaise,
      method: input.method,
      paidAt: input.paidAt,
      direction: "debit" as const,
      correctsPaymentId: originalPaymentId,
      reason: input.reason,
    },
  ];
  const total = calculateAmountPaid(proposed);
  if (total > invoiceTotalPaise) {
    throw new OverpaymentError(
      `Payment would exceed invoice total by ${total - invoiceTotalPaise} paise.`,
    );
  }
  assertNonNegativeInteger(total, "receipt balance");
  return proposed;
}

export function deriveInvoicePaymentStatus(
  invoiceTotalPaise: Paise,
  payments: readonly PaymentRecord[],
): "unpaid" | "partially_paid" | "paid" {
  const paid = calculateAmountPaid(payments);
  assertNonNegativeInteger(invoiceTotalPaise, "invoice total");
  if (paid === 0) {
    return "unpaid";
  }
  return paid === invoiceTotalPaise ? "paid" : "partially_paid";
}

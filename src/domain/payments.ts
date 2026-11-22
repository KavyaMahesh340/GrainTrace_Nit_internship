import { addPaise, subtractPaise, type Paise } from "./money";
import type { PaymentMethod, PaymentRecord } from "./types";
import {
  assertNonEmptyString,
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

export function calculateAmountPaid(payments: readonly PaymentRecord[]): Paise {
  return addPaise(...payments.map((payment) => payment.amountPaise));
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

  const proposed = [...payments, { ...input, amountPaise }];
  const total = calculateAmountPaid(proposed);
  if (total > invoiceTotalPaise) {
    throw new OverpaymentError(
      `Payment would exceed invoice total by ${total - invoiceTotalPaise} paise.`,
    );
  }

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

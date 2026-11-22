import "server-only";
import { and, asc, eq, sql } from "drizzle-orm";
import {
  calculateAmountPaid,
  recordPayment,
  recordPaymentCorrection,
  signedPaymentPaise,
  type PaymentDirection,
  type PaymentMethod,
  type PaymentRecord,
} from "@/domain";
import { getDb } from "@/lib/db";
import { customers, invoices, payments } from "@/lib/db/schema";
import type { WorkflowActor } from "./context";
import { requireActorPermission } from "./context";
import type { WorkflowDb, WorkflowTransaction } from "./db";
import { recordAudit } from "./audit";
import { WorkflowError } from "./errors";
import { deriveInvoiceStatus } from "./invoices";
import { allocateDocumentNumber } from "./numbering";
import type { PaymentCorrectionInput, PaymentInput } from "./validation";

export type PaymentSummary = {
  id: number;
  paymentNumber: string;
  invoiceNumber: string;
  customerName: string;
  paidAt: string;
  amountPaise: number;
  signedAmountPaise: number;
  method: string;
  referenceNo: string | null;
  notes: string;
  direction: PaymentDirection;
  status: string;
  correctsPaymentId: number | null;
  reason: string | null;
};

export type CollectionRow = {
  invoiceId: number;
  invoiceNumber: string;
  customerId: number;
  customerName: string;
  customerType: string;
  invoiceDate: string;
  dueDate: string;
  status: string;
  totalPaise: number;
  amountPaidPaise: number;
  creditNotePaise: number;
  outstandingPaise: number;
  agingBucket: string;
};

export type CollectionsDashboard = {
  duePaise: number;
  overduePaise: number;
  collectedPaise: number;
  correctionPaise: number;
  retailerOutstandingPaise: number;
  distributorOutstandingPaise: number;
  aging: { bucket: string; label: string; outstandingPaise: number; invoiceCount: number }[];
  customers: {
    customerId: number;
    customerName: string;
    customerType: string;
    outstandingPaise: number;
    overduePaise: number;
  }[];
};

const AGING_BUCKETS = [
  { bucket: "current", label: "Current" },
  { bucket: "1_30", label: "1–30 days" },
  { bucket: "31_60", label: "31–60 days" },
  { bucket: "61_90", label: "61–90 days" },
  { bucket: "90_plus", label: "90+ days" },
] as const;

function payablePaise(invoice: typeof invoices.$inferSelect) {
  return Math.max(0, invoice.totalPaise - invoice.creditNotePaise);
}

function duplicateKeyFor(method: string, referenceNo: string | undefined) {
  const reference = referenceNo?.trim().toUpperCase();
  return reference ? `${method}:${reference}` : null;
}

function statusFor(invoice: typeof invoices.$inferSelect, records: PaymentRecord[]) {
  return deriveInvoiceStatus(invoice, records);
}

function agingBucket(dueDate: string, today: string) {
  if (dueDate >= today) return "current";
  const due = Date.parse(dueDate);
  const now = Date.parse(today);
  if (Number.isNaN(due) || Number.isNaN(now)) return "current";
  const days = Math.floor((now - due) / 86_400_000);
  if (days <= 30) return "1_30";
  if (days <= 60) return "31_60";
  if (days <= 90) return "61_90";
  return "90_plus";
}

function loadPaymentRecords(
  tx: WorkflowDb | WorkflowTransaction,
  invoiceId: number,
  invoiceNumber: string,
): PaymentRecord[] {
  return tx
    .select({
      id: payments.id,
      amountPaise: payments.amountPaise,
      method: payments.method,
      paidAt: payments.paidAt,
      direction: payments.direction,
      correctsPaymentId: payments.correctsPaymentId,
      reason: payments.reason,
    })
    .from(payments)
    .where(eq(payments.invoiceId, invoiceId))
    .orderBy(asc(payments.id))
    .all()
    .map((payment) => ({
      paymentId: String(payment.id),
      invoiceNumber,
      amountPaise: payment.amountPaise,
      method: payment.method as PaymentMethod,
      paidAt: payment.paidAt,
      direction: payment.direction as PaymentDirection,
      correctsPaymentId: payment.correctsPaymentId === null ? undefined : String(payment.correctsPaymentId),
      reason: payment.reason ?? undefined,
    }));
}

export function listPayments(factoryId: number): PaymentSummary[] {
  return getDb()
    .select({
      id: payments.id,
      paymentNumber: payments.paymentNumber,
      invoiceNumber: invoices.invoiceNumber,
      customerName: customers.name,
      paidAt: payments.paidAt,
      amountPaise: payments.amountPaise,
      method: payments.method,
      referenceNo: payments.referenceNo,
      notes: payments.notes,
      direction: payments.direction,
      status: payments.status,
      correctsPaymentId: payments.correctsPaymentId,
      reason: payments.reason,
    })
    .from(payments)
    .innerJoin(invoices, eq(payments.invoiceId, invoices.id))
    .innerJoin(customers, eq(payments.customerId, customers.id))
    .where(eq(payments.factoryId, factoryId))
    .orderBy(sql`${payments.paidAt} desc`, sql`${payments.id} desc`)
    .all()
    .map((payment) => ({
      ...payment,
      direction: payment.direction as PaymentDirection,
      method: payment.method as PaymentMethod,
      signedAmountPaise: signedPaymentPaise({
        paymentId: payment.paymentNumber,
        invoiceNumber: payment.invoiceNumber,
        amountPaise: payment.amountPaise,
        method: payment.method as PaymentMethod,
        paidAt: payment.paidAt,
        direction: payment.direction as PaymentDirection,
      }),
    }));
}

export function listCollections(factoryId: number): CollectionRow[] {
  const today = new Date().toISOString().slice(0, 10);
  return getDb()
    .select({
      invoiceId: invoices.id,
      invoiceNumber: invoices.invoiceNumber,
      customerId: customers.id,
      customerName: customers.name,
      customerType: customers.customerType,
      invoiceDate: invoices.invoiceDate,
      dueDate: invoices.dueDate,
      status: invoices.status,
      totalPaise: invoices.totalPaise,
      amountPaidPaise: invoices.amountPaidPaise,
      creditNotePaise: invoices.creditNotePaise,
    })
    .from(invoices)
    .innerJoin(customers, eq(invoices.customerId, customers.id))
    .where(eq(invoices.factoryId, factoryId))
    .orderBy(asc(invoices.dueDate), asc(invoices.id))
    .all()
    .map((row) => ({
      ...row,
      outstandingPaise:
        row.status === "cancelled"
          ? 0
          : Math.max(0, row.totalPaise - row.creditNotePaise - row.amountPaidPaise),
      agingBucket: agingBucket(row.dueDate, today),
    }));
}

export function getCollectionsDashboard(factoryId: number): CollectionsDashboard {
  const today = new Date().toISOString().slice(0, 10);
  const collections = listCollections(factoryId);
  const paymentRows = listPayments(factoryId);

  return {
    duePaise: collections.reduce((sum, row) => sum + row.outstandingPaise, 0),
    overduePaise: collections
      .filter((row) => row.status !== "cancelled" && row.dueDate < today)
      .reduce((sum, row) => sum + row.outstandingPaise, 0),
    collectedPaise: paymentRows
      .filter((payment) => payment.direction === "credit")
      .reduce((sum, payment) => sum + payment.amountPaise, 0),
    correctionPaise: paymentRows
      .filter((payment) => payment.direction === "debit")
      .reduce((sum, payment) => sum + payment.amountPaise, 0),
    retailerOutstandingPaise: collections
      .filter((row) => row.customerType === "retailer")
      .reduce((sum, row) => sum + row.outstandingPaise, 0),
    distributorOutstandingPaise: collections
      .filter((row) => row.customerType === "distributor")
      .reduce((sum, row) => sum + row.outstandingPaise, 0),
    aging: AGING_BUCKETS.map((bucket) => {
      const rows = collections.filter(
        (row) => row.outstandingPaise > 0 && row.agingBucket === bucket.bucket,
      );
      return {
        bucket: bucket.bucket,
        label: bucket.label,
        outstandingPaise: rows.reduce((sum, row) => sum + row.outstandingPaise, 0),
        invoiceCount: rows.length,
      };
    }),
    customers: buildCustomerBalances(collections, today),
  };
}

function buildCustomerBalances(rows: CollectionRow[], today: string): CollectionsDashboard["customers"] {
  const balances = new Map<number, CollectionsDashboard["customers"][number]>();
  for (const row of rows) {
    if (row.outstandingPaise <= 0) continue;
    const existing = balances.get(row.customerId);
    const overduePaise = row.dueDate < today ? row.outstandingPaise : 0;
    if (existing) {
      existing.outstandingPaise += row.outstandingPaise;
      existing.overduePaise += overduePaise;
      continue;
    }
    balances.set(row.customerId, {
      customerId: row.customerId,
      customerName: row.customerName,
      customerType: row.customerType,
      outstandingPaise: row.outstandingPaise,
      overduePaise,
    });
  }
  return Array.from(balances.values()).sort((left, right) => right.outstandingPaise - left.outstandingPaise);
}

export function createPayment(actor: WorkflowActor, input: PaymentInput) {
  requireActorPermission(actor, "payments:manage");

  return getDb().transaction((tx) => {
    const invoice = tx
      .select()
      .from(invoices)
      .where(and(eq(invoices.factoryId, actor.factoryId), eq(invoices.invoiceNumber, input.invoiceNumber)))
      .get();
    if (!invoice) throw new WorkflowError("Invoice not found.", "not_found", 404);
    if (invoice.status === "cancelled") {
      throw new WorkflowError("Payments cannot be recorded against a cancelled invoice.", "invalid_invoice");
    }

    const duplicateKey = duplicateKeyFor(input.method, input.referenceNo);
    if (duplicateKey) {
      const duplicate = tx
        .select({ id: payments.id })
        .from(payments)
        .where(and(eq(payments.factoryId, actor.factoryId), eq(payments.duplicateKey, duplicateKey)))
        .get();
      if (duplicate) {
        throw new WorkflowError("This payment reference has already been recorded.", "duplicate_payment", 409);
      }
    }

    const numbered = allocateDocumentNumber(tx, actor.factoryId, "PAYMENT", input.paidAt);
    const existing = loadPaymentRecords(tx, invoice.id, invoice.invoiceNumber);
    const nextRecords = recordPayment(
      existing,
      {
        paymentId: `pending-${numbered.number}`,
        invoiceNumber: invoice.invoiceNumber,
        amountPaise: input.amountPaise,
        method: input.method,
        paidAt: input.paidAt,
      },
      payablePaise(invoice),
    );
    const amountPaidPaise = calculateAmountPaid(nextRecords);
    const now = new Date().toISOString();
    const result = tx
      .insert(payments)
      .values({
        factoryId: actor.factoryId,
        invoiceId: invoice.id,
        customerId: invoice.customerId,
        paymentNumber: numbered.number,
        paidAt: input.paidAt,
        amountPaise: input.amountPaise,
        method: input.method,
        referenceNo: input.referenceNo || null,
        notes: input.notes,
        direction: "credit",
        status: "posted",
        duplicateKey,
        recordedByUserId: actor.userId,
        updatedAt: now,
      })
      .run();
    const paymentId = Number(result.lastInsertRowid);
    const status = statusFor(invoice, nextRecords);

    tx.update(invoices)
      .set({ amountPaidPaise, status, updatedAt: now })
      .where(eq(invoices.id, invoice.id))
      .run();
    recordAudit(
      tx,
      actor,
      "PAYMENT_RECORDED",
      "payment",
      paymentId,
      {
        paymentNumber: numbered.number,
        invoiceNumber: invoice.invoiceNumber,
        amountPaise: input.amountPaise,
        referenceNo: input.referenceNo || null,
      },
      {
        before: { amountPaidPaise: invoice.amountPaidPaise, invoiceStatus: invoice.status },
        after: { amountPaidPaise, invoiceStatus: status },
      },
    );

    return {
      id: paymentId,
      paymentNumber: numbered.number,
      invoiceNumber: invoice.invoiceNumber,
      amountPaise: input.amountPaise,
      amountPaidPaise,
      status,
    };
  });
}

export function correctPayment(actor: WorkflowActor, input: PaymentCorrectionInput) {
  requireActorPermission(actor, "payments:correct");

  return getDb().transaction((tx) => {
    const original = tx
      .select()
      .from(payments)
      .where(
        and(eq(payments.factoryId, actor.factoryId), eq(payments.paymentNumber, input.paymentNumber)),
      )
      .get();
    if (!original) throw new WorkflowError("Payment not found.", "not_found", 404);
    if (original.direction !== "credit") {
      throw new WorkflowError("Corrections can only be posted against an original receipt.", "invalid_payment");
    }
    const invoice = tx.select().from(invoices).where(eq(invoices.id, original.invoiceId)).get();
    if (!invoice) throw new WorkflowError("Invoice not found.", "not_found", 404);

    const numbered = allocateDocumentNumber(tx, actor.factoryId, "PAYMENT", input.correctedAt);
    const records = loadPaymentRecords(tx, invoice.id, invoice.invoiceNumber);
    const nextRecords = recordPaymentCorrection(
      records,
      String(original.id),
      {
        paymentId: numbered.number,
        invoiceNumber: invoice.invoiceNumber,
        amountPaise: input.amountPaise,
        method: original.method as PaymentMethod,
        paidAt: input.correctedAt,
        reason: input.reason,
      },
      payablePaise(invoice),
    );
    const amountPaidPaise = calculateAmountPaid(nextRecords);
    const correctedPaise = nextRecords
      .filter((record) => String(record.correctsPaymentId ?? "") === String(original.id))
      .reduce((total, record) => total + record.amountPaise, 0);
    const originalStatus = correctedPaise >= original.amountPaise ? "corrected" : "partially_corrected";
    const now = new Date().toISOString();
    const result = tx
      .insert(payments)
      .values({
        factoryId: actor.factoryId,
        invoiceId: invoice.id,
        customerId: original.customerId,
        paymentNumber: numbered.number,
        paidAt: input.correctedAt,
        amountPaise: input.amountPaise,
        method: original.method,
        referenceNo: null,
        notes: input.reason,
        direction: "debit",
        status: "correction",
        correctsPaymentId: original.id,
        duplicateKey: null,
        recordedByUserId: actor.userId,
        updatedAt: now,
      })
      .run();
    const correctionId = Number(result.lastInsertRowid);
    const status = statusFor(invoice, nextRecords);

    tx.update(payments)
      .set({ status: originalStatus, updatedAt: now })
      .where(eq(payments.id, original.id))
      .run();
    tx.update(invoices)
      .set({ amountPaidPaise, status, updatedAt: now })
      .where(eq(invoices.id, invoice.id))
      .run();
    recordAudit(
      tx,
      actor,
      "PAYMENT_CORRECTED",
      "payment",
      correctionId,
      {
        paymentNumber: numbered.number,
        originalPaymentNumber: original.paymentNumber,
        invoiceNumber: invoice.invoiceNumber,
        amountPaise: input.amountPaise,
      },
      {
        severity: "warning",
        reason: input.reason,
        before: {
          paymentStatus: original.status,
          amountPaidPaise: invoice.amountPaidPaise,
          invoiceStatus: invoice.status,
        },
        after: { paymentStatus: originalStatus, amountPaidPaise, invoiceStatus: status },
      },
    );

    return {
      id: correctionId,
      paymentNumber: numbered.number,
      originalPaymentNumber: original.paymentNumber,
      invoiceNumber: invoice.invoiceNumber,
      amountPaise: input.amountPaise,
      amountPaidPaise,
      status,
    };
  });
}

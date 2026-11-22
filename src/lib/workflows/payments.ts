import "server-only";
import { and, asc, eq, sql } from "drizzle-orm";
import { calculateAmountPaid, recordPayment, type PaymentMethod, type PaymentRecord } from "@/domain";
import { getDb } from "@/lib/db";
import { customers, invoices, payments } from "@/lib/db/schema";
import type { WorkflowActor } from "./context";
import { requireActorPermission } from "./context";
import type { WorkflowDb, WorkflowTransaction } from "./db";
import { recordAudit } from "./audit";
import { WorkflowError } from "./errors";
import { deriveInvoiceStatus } from "./invoices";
import { allocateDocumentNumber } from "./numbering";
import type { PaymentInput } from "./validation";

export type PaymentSummary = {
  id: number;
  paymentNumber: string;
  invoiceNumber: string;
  customerName: string;
  paidAt: string;
  amountPaise: number;
  method: string;
  referenceNo: string | null;
};

export type CollectionRow = {
  invoiceId: number;
  invoiceNumber: string;
  customerName: string;
  dueDate: string;
  status: string;
  totalPaise: number;
  amountPaidPaise: number;
  outstandingPaise: number;
};

function loadPaymentRecords(tx: WorkflowDb | WorkflowTransaction, invoiceId: number, invoiceNumber: string): PaymentRecord[] {
  return tx
    .select({
      id: payments.id,
      amountPaise: payments.amountPaise,
      method: payments.method,
      paidAt: payments.paidAt,
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
    })
    .from(payments)
    .innerJoin(invoices, eq(payments.invoiceId, invoices.id))
    .innerJoin(customers, eq(payments.customerId, customers.id))
    .where(eq(payments.factoryId, factoryId))
    .orderBy(sql`${payments.paidAt} desc`, sql`${payments.id} desc`)
    .all()
    .map((payment) => ({
      id: payment.id,
      paymentNumber: payment.paymentNumber,
      invoiceNumber: payment.invoiceNumber,
      customerName: payment.customerName,
      paidAt: payment.paidAt,
      amountPaise: payment.amountPaise,
      method: payment.method as PaymentMethod,
      referenceNo: payment.referenceNo,
    }));
}

export function listCollections(factoryId: number): CollectionRow[] {
  return getDb()
    .select({
      invoiceId: invoices.id,
      invoiceNumber: invoices.invoiceNumber,
      customerName: customers.name,
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
      invoiceId: row.invoiceId,
      invoiceNumber: row.invoiceNumber,
      customerName: row.customerName,
      dueDate: row.dueDate,
      status: row.status,
      totalPaise: row.totalPaise,
      amountPaidPaise: row.amountPaidPaise,
      outstandingPaise:
        row.status === "cancelled"
          ? 0
          : Math.max(0, row.totalPaise - row.creditNotePaise - row.amountPaidPaise),
    }));
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

    const numbered = allocateDocumentNumber(tx, actor.factoryId, "PAYMENT", input.paidAt);
    const existing = loadPaymentRecords(tx, invoice.id, invoice.invoiceNumber);
    const nextRecords = recordPayment(
      existing,
      {
        paymentId: numbered.number,
        invoiceNumber: invoice.invoiceNumber,
        amountPaise: input.amountPaise,
        method: input.method,
        paidAt: input.paidAt,
      },
      invoice.totalPaise,
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
        referenceNo: input.referenceNo,
        recordedByUserId: actor.userId,
        updatedAt: now,
      })
      .run();
    const paymentId = Number(result.lastInsertRowid);

    tx.update(invoices)
      .set({
        amountPaidPaise,
        status: deriveInvoiceStatus(invoice, nextRecords),
        updatedAt: now,
      })
      .where(eq(invoices.id, invoice.id))
      .run();
    recordAudit(tx, actor, "PAYMENT_RECORDED", "payment", paymentId, {
      paymentNumber: numbered.number,
      invoiceNumber: invoice.invoiceNumber,
      amountPaise: input.amountPaise,
    });

    return {
      id: paymentId,
      paymentNumber: numbered.number,
      invoiceNumber: invoice.invoiceNumber,
      amountPaise: input.amountPaise,
      amountPaidPaise,
      status: deriveInvoiceStatus(invoice, nextRecords),
    };
  });
}

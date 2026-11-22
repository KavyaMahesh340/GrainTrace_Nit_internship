import "server-only";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import {
  addPaise,
  assertHsnCode,
  calculateGst,
  deriveInvoicePaymentStatus,
  multiplyPaiseByInteger,
  resolveGstJurisdiction,
  subtractPaise,
  assertUniqueIds,
  type PaymentDirection,
  type PaymentMethod,
  type PaymentRecord,
} from "@/domain";
import { getDb } from "@/lib/db";
import {
  creditNoteItems,
  creditNotes,
  customers,
  factories,
  invoiceItems,
  invoices,
  payments,
  products,
  salesOrderItems,
  salesOrders,
} from "@/lib/db/schema";
import type { WorkflowActor } from "./context";
import { requireActorPermission } from "./context";
import type { WorkflowDb, WorkflowTransaction } from "./db";
import { recordAudit } from "./audit";
import { WorkflowError } from "./errors";
import { addDaysToDate, allocateDocumentNumber } from "./numbering";
import type { InvoiceCancelInput, InvoiceInput } from "./validation";

export type InvoiceLineDetail = {
  id: number;
  salesOrderItemId: number | null;
  productName: string;
  hsnCode: string;
  quantityPackets: number;
  unitPricePaise: number;
  taxablePaise: number;
  rateBasisPoints: number;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
  taxPaise: number;
  lineTotalPaise: number;
};

export type InvoiceDetail = {
  id: number;
  invoiceNumber: string;
  financialYear: string;
  invoiceDate: string;
  dueDate: string;
  status: string;
  orderNumber: string;
  customerId: number;
  customerName: string;
  customerGstin: string | null;
  fromState: string;
  fromGstin: string;
  fromAddressLine1: string;
  fromCity: string;
  fromPostalCode: string;
  toState: string;
  toGstin: string;
  toAddressLine1: string;
  toCity: string;
  toPostalCode: string;
  jurisdiction: string;
  hsnCode: string;
  paymentTermsDays: number;
  subtotalPaise: number;
  taxPaise: number;
  totalPaise: number;
  amountPaidPaise: number;
  outstandingPaise: number;
  creditNoteNumber: string | null;
  creditNotePaise: number;
  cancellationReason: string | null;
  cancelledAt: string | null;
  postedAt: string | null;
  lines: InvoiceLineDetail[];
  payments: PaymentRecord[];
};

export type InvoiceSummary = Pick<
  InvoiceDetail,
  | "id"
  | "invoiceNumber"
  | "financialYear"
  | "invoiceDate"
  | "dueDate"
  | "status"
  | "customerName"
  | "totalPaise"
  | "amountPaidPaise"
  | "outstandingPaise"
  | "creditNoteNumber"
>;

function loadPaymentRecords(tx: WorkflowDb | WorkflowTransaction, invoiceId: number, invoiceNumber: string): PaymentRecord[] {
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

function loadInvoiceDetail(tx: WorkflowDb | WorkflowTransaction, invoice: typeof invoices.$inferSelect): InvoiceDetail {
  const order = tx.select().from(salesOrders).where(eq(salesOrders.id, invoice.salesOrderId)).get();
  const customer = tx.select().from(customers).where(eq(customers.id, invoice.customerId)).get();
  const lines = tx
    .select({
      id: invoiceItems.id,
      salesOrderItemId: invoiceItems.salesOrderItemId,
      productName: products.name,
      hsnCode: invoiceItems.hsnCode,
      quantityPackets: invoiceItems.quantityPackets,
      unitPricePaise: invoiceItems.unitPricePaise,
      taxablePaise: invoiceItems.taxablePaise,
      rateBasisPoints: invoiceItems.rateBasisPoints,
      cgstPaise: invoiceItems.cgstPaise,
      sgstPaise: invoiceItems.sgstPaise,
      igstPaise: invoiceItems.igstPaise,
      taxPaise: invoiceItems.taxPaise,
      lineTotalPaise: invoiceItems.lineTotalPaise,
    })
    .from(invoiceItems)
    .innerJoin(products, eq(invoiceItems.productId, products.id))
    .where(eq(invoiceItems.invoiceId, invoice.id))
    .orderBy(asc(invoiceItems.id))
    .all();
  const paymentRecords = loadPaymentRecords(tx, invoice.id, invoice.invoiceNumber);
  const outstandingPaise =
    invoice.status === "cancelled"
      ? 0
      : Math.max(0, subtractPaise(subtractPaise(invoice.totalPaise, invoice.creditNotePaise), invoice.amountPaidPaise));

  return {
    id: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    financialYear: invoice.financialYear,
    invoiceDate: invoice.invoiceDate,
    dueDate: invoice.dueDate,
    status: invoice.status,
    orderNumber: order?.orderNumber ?? "",
    customerId: invoice.customerId,
    customerName: customer?.name ?? "Unknown customer",
    customerGstin: customer?.gstin ?? null,
    fromState: invoice.fromState,
    fromGstin: invoice.fromGstin,
    fromAddressLine1: invoice.fromAddressLine1,
    fromCity: invoice.fromCity,
    fromPostalCode: invoice.fromPostalCode,
    toState: invoice.toState,
    toGstin: invoice.toGstin,
    toAddressLine1: invoice.toAddressLine1,
    toCity: invoice.toCity,
    toPostalCode: invoice.toPostalCode,
    jurisdiction: invoice.jurisdiction,
    hsnCode: invoice.hsnCode,
    paymentTermsDays: invoice.paymentTermsDays,
    subtotalPaise: invoice.subtotalPaise,
    taxPaise: invoice.taxPaise,
    totalPaise: invoice.totalPaise,
    amountPaidPaise: invoice.amountPaidPaise,
    outstandingPaise,
    creditNoteNumber: invoice.creditNoteNumber,
    creditNotePaise: invoice.creditNotePaise,
    cancellationReason: invoice.cancellationReason,
    cancelledAt: invoice.cancelledAt,
    postedAt: invoice.postedAt,
    lines,
    payments: paymentRecords,
  };
}

export function listInvoices(
  factoryId: number,
  filters: { status?: string; query?: string } = {},
): InvoiceSummary[] {
  return getDb()
    .select({
      id: invoices.id,
      invoiceNumber: invoices.invoiceNumber,
      financialYear: invoices.financialYear,
      invoiceDate: invoices.invoiceDate,
      dueDate: invoices.dueDate,
      status: invoices.status,
      customerName: customers.name,
      totalPaise: invoices.totalPaise,
      amountPaidPaise: invoices.amountPaidPaise,
      creditNotePaise: invoices.creditNotePaise,
      creditNoteNumber: invoices.creditNoteNumber,
    })
    .from(invoices)
    .innerJoin(customers, eq(invoices.customerId, customers.id))
    .where(eq(invoices.factoryId, factoryId))
    .orderBy(sql`${invoices.invoiceDate} desc`, sql`${invoices.id} desc`)
    .all()
    .map((row) => ({
      id: row.id,
      invoiceNumber: row.invoiceNumber,
      financialYear: row.financialYear,
      invoiceDate: row.invoiceDate,
      dueDate: row.dueDate,
      status: row.status,
      customerName: row.customerName,
      totalPaise: row.totalPaise,
      amountPaidPaise: row.amountPaidPaise,
      outstandingPaise:
        row.status === "cancelled"
          ? 0
          : Math.max(0, row.totalPaise - row.creditNotePaise - row.amountPaidPaise),
      creditNoteNumber: row.creditNoteNumber,
    }))
    .filter((row) => {
      if (filters.status && filters.status !== "all" && row.status !== filters.status) return false;
      const needle = filters.query?.trim().toLowerCase();
      if (!needle) return true;
      return `${row.invoiceNumber} ${row.customerName} ${row.financialYear}`.toLowerCase().includes(needle);
    });
}

export function getInvoiceDetail(factoryId: number, invoiceNumber: string): InvoiceDetail | null {
  const db = getDb();
  const invoice = db
    .select()
    .from(invoices)
    .where(and(eq(invoices.factoryId, factoryId), eq(invoices.invoiceNumber, invoiceNumber)))
    .get();
  return invoice ? loadInvoiceDetail(db, invoice) : null;
}

export function getInvoicePdfData(factoryId: number, invoiceNumber: string) {
  const db = getDb();
  const invoice = db
    .select()
    .from(invoices)
    .where(and(eq(invoices.factoryId, factoryId), eq(invoices.invoiceNumber, invoiceNumber)))
    .get();
  if (!invoice) return null;
  const factory = db.select().from(factories).where(eq(factories.id, factoryId)).get();
  const detail = loadInvoiceDetail(db, invoice);
  return {
    ...detail,
    businessName: factory?.name ?? "GrainTrace Demo Factory",
    businessGstin: factory?.gstin ?? "",
    businessAddress: [factory?.addressLine1, factory?.city, factory?.postalCode].filter(Boolean).join(", "),
    customerAddress: [detail.toAddressLine1, detail.toCity, detail.toPostalCode].filter(Boolean).join(", "),
  };
}

export type InvoicePdfData = NonNullable<ReturnType<typeof getInvoicePdfData>>;

export function getInvoiceOptions(factoryId: number) {
  const db = getDb();
  const eligibleOrders = db
    .select({
      orderNumber: salesOrders.orderNumber,
      customerName: customers.name,
      status: salesOrders.status,
    })
    .from(salesOrders)
    .innerJoin(customers, eq(salesOrders.customerId, customers.id))
    .where(eq(salesOrders.factoryId, factoryId))
    .orderBy(sql`${salesOrders.orderDate} desc`)
    .all()
    .filter((order) => ["approved", "partially_fulfilled", "fulfilled"].includes(order.status));
  return { orders: eligibleOrders };
}

export function getSalesInvoiceCandidates(factoryId: number, orderNumber: string) {
  const db = getDb();
  const order = db
    .select()
    .from(salesOrders)
    .where(and(eq(salesOrders.factoryId, factoryId), eq(salesOrders.orderNumber, orderNumber)))
    .get();
  if (!order) return null;
  return db
    .select({
      salesOrderItemId: salesOrderItems.id,
      productName: products.name,
      hsnCode: salesOrderItems.hsnCode,
      quantityPackets: salesOrderItems.quantityPackets,
      fulfilledPackets: salesOrderItems.fulfilledPackets,
      invoicedPackets: salesOrderItems.invoicedPackets,
      unitPricePaise: salesOrderItems.unitPricePaise,
      discountPaise: salesOrderItems.discountPaise,
    })
    .from(salesOrderItems)
    .innerJoin(products, eq(salesOrderItems.productId, products.id))
    .where(eq(salesOrderItems.salesOrderId, order.id))
    .orderBy(asc(salesOrderItems.id))
    .all()
    .map((line) => ({
      ...line,
      availableToInvoicePackets: line.fulfilledPackets - line.invoicedPackets,
      netUnitPricePaise: subtractPaise(line.unitPricePaise, line.discountPaise),
    }));
}

export function createInvoice(actor: WorkflowActor, input: InvoiceInput): InvoiceDetail {
  requireActorPermission(actor, "invoices:manage");

  return getDb().transaction((tx) => {
    const order = tx
      .select()
      .from(salesOrders)
      .where(and(eq(salesOrders.factoryId, actor.factoryId), eq(salesOrders.orderNumber, input.salesOrderNumber)))
      .get();
    if (!order) throw new WorkflowError("Sales order not found.", "not_found", 404);
    if (!["approved", "partially_fulfilled", "fulfilled"].includes(order.status)) {
      throw new WorkflowError(`Cannot invoice an order in ${order.status} state.`, "invalid_transition");
    }

    const customer = tx.select().from(customers).where(eq(customers.id, order.customerId)).get();
    const factory = tx.select().from(factories).where(eq(factories.id, actor.factoryId)).get();
    if (!customer || !factory) throw new WorkflowError("Invoice party is unavailable.", "not_found", 404);

    assertUniqueIds(input.lines, (line) => String(line.salesOrderItemId), "invoice line");
    const itemIds = input.lines.map((line) => line.salesOrderItemId);
    const itemRows = tx
      .select({
        item: salesOrderItems,
        productHsn: products.hsnCode,
      })
      .from(salesOrderItems)
      .innerJoin(products, eq(salesOrderItems.productId, products.id))
      .where(and(eq(salesOrderItems.salesOrderId, order.id), inArray(salesOrderItems.id, itemIds)))
      .all();
    const itemsById = new Map(itemRows.map((row) => [row.item.id, row]));
    if (itemsById.size !== itemIds.length) {
      throw new WorkflowError("One or more order lines are unavailable.", "not_found", 404);
    }

    const toState = customer.deliveryState || customer.state || "";
    const fromState = factory.state;
    const jurisdiction = resolveGstJurisdiction(fromState, toState);
    const numbered = allocateDocumentNumber(tx, actor.factoryId, "INVOICE", input.invoiceDate);
    const now = new Date().toISOString();
    const preparedLines: {
      salesOrderItemId: number;
      productId: number;
      hsnCode: string;
      quantityPackets: number;
      unitPricePaise: number;
      taxablePaise: number;
      cgstPaise: number;
      sgstPaise: number;
      igstPaise: number;
      taxPaise: number;
      lineTotalPaise: number;
    }[] = [];

    for (const line of input.lines) {
      const row = itemsById.get(line.salesOrderItemId);
      if (!row) continue;
      const remaining = row.item.fulfilledPackets - row.item.invoicedPackets;
      if (line.quantityPackets > remaining) {
        throw new WorkflowError(
          `Only ${remaining} packets on this line are available to invoice.`,
          "over_invoice",
        );
      }
      const hsnCode = assertHsnCode(row.item.hsnCode || row.productHsn || "");
      const netUnitPaise = subtractPaise(row.item.unitPricePaise, row.item.discountPaise);
      const taxablePaise = multiplyPaiseByInteger(netUnitPaise, line.quantityPackets);
      const tax = calculateGst({
        hsnCode,
        taxablePaise,
        rateBasisPoints: input.rateBasisPoints,
        jurisdiction,
      });
      preparedLines.push({
        salesOrderItemId: row.item.id,
        productId: row.item.productId,
        hsnCode,
        quantityPackets: line.quantityPackets,
        unitPricePaise: netUnitPaise,
        taxablePaise,
        cgstPaise: tax.cgstPaise,
        sgstPaise: tax.sgstPaise,
        igstPaise: tax.igstPaise,
        taxPaise: tax.totalTaxPaise,
        lineTotalPaise: tax.totalPaise,
      });
    }

    const subtotalPaise = addPaise(...preparedLines.map((line) => line.taxablePaise));
    const taxPaise = addPaise(...preparedLines.map((line) => line.taxPaise));
    const totalPaise = addPaise(subtotalPaise, taxPaise);
    const hsnCodes = new Set(preparedLines.map((line) => line.hsnCode));
    const dueDate = addDaysToDate(input.invoiceDate, customer.creditTermsDays);

    const result = tx
      .insert(invoices)
      .values({
        factoryId: actor.factoryId,
        salesOrderId: order.id,
        customerId: customer.id,
        invoiceNumber: numbered.number,
        financialYear: numbered.financialYear,
        invoiceDate: input.invoiceDate,
        dueDate,
        fromState,
        fromGstin: factory.gstin,
        fromAddressLine1: factory.addressLine1,
        fromCity: factory.city,
        fromPostalCode: factory.postalCode,
        toState,
        toGstin: customer.gstin ?? "",
        toAddressLine1: customer.addressLine1 ?? "",
        toCity: customer.city ?? "",
        toPostalCode: customer.postalCode ?? "",
        jurisdiction,
        hsnCode: hsnCodes.size === 1 ? Array.from(hsnCodes)[0] : "MULTI",
        paymentTermsDays: customer.creditTermsDays,
        subtotalPaise,
        taxPaise,
        totalPaise,
        status: "issued",
        postedAt: now,
        createdByUserId: actor.userId,
        updatedAt: now,
      })
      .run();
    const invoiceId = Number(result.lastInsertRowid);

    for (const line of preparedLines) {
      tx.insert(invoiceItems)
        .values({
          invoiceId,
          salesOrderItemId: line.salesOrderItemId,
          productId: line.productId,
          hsnCode: line.hsnCode,
          quantityPackets: line.quantityPackets,
          unitPricePaise: line.unitPricePaise,
          taxablePaise: line.taxablePaise,
          rateBasisPoints: input.rateBasisPoints,
          cgstPaise: line.cgstPaise,
          sgstPaise: line.sgstPaise,
          igstPaise: line.igstPaise,
          taxPaise: line.taxPaise,
          lineTotalPaise: line.lineTotalPaise,
          updatedAt: now,
        })
        .run();
      tx.update(salesOrderItems)
        .set({
          invoicedPackets: sql`${salesOrderItems.invoicedPackets} + ${line.quantityPackets}`,
          updatedAt: now,
        })
        .where(eq(salesOrderItems.id, line.salesOrderItemId))
        .run();
    }

    recordAudit(tx, actor, "INVOICE_CREATED", "invoice", invoiceId, {
      invoiceNumber: numbered.number,
      orderNumber: order.orderNumber,
      totalPaise,
    });

    const invoice = tx.select().from(invoices).where(eq(invoices.id, invoiceId)).get();
    if (!invoice) throw new WorkflowError("Unable to load the invoice.", "load_failed", 500);
    return loadInvoiceDetail(tx, invoice);
  });
}

export function cancelInvoice(actor: WorkflowActor, invoiceNumber: string, input: InvoiceCancelInput): InvoiceDetail {
  requireActorPermission(actor, "invoices:manage");

  return getDb().transaction((tx) => {
    const invoice = tx
      .select()
      .from(invoices)
      .where(and(eq(invoices.factoryId, actor.factoryId), eq(invoices.invoiceNumber, invoiceNumber)))
      .get();
    if (!invoice) throw new WorkflowError("Invoice not found.", "not_found", 404);
    if (invoice.status === "cancelled") {
      throw new WorkflowError("This invoice has already been cancelled.", "already_cancelled");
    }
    const items = tx
      .select()
      .from(invoiceItems)
      .where(eq(invoiceItems.invoiceId, invoice.id))
      .orderBy(asc(invoiceItems.id))
      .all();
    if (items.length === 0) throw new WorkflowError("Invoice lines are unavailable.", "not_found", 404);

    const creditNoteDate = new Date().toISOString().slice(0, 10);
    const numbered = allocateDocumentNumber(tx, actor.factoryId, "CREDIT_NOTE", creditNoteDate);
    const now = new Date().toISOString();
    const taxPaise = addPaise(...items.map((item) => item.taxPaise));
    const cgstPaise = addPaise(...items.map((item) => item.cgstPaise));
    const sgstPaise = addPaise(...items.map((item) => item.sgstPaise));
    const igstPaise = addPaise(...items.map((item) => item.igstPaise));

    const creditResult = tx
      .insert(creditNotes)
      .values({
        factoryId: actor.factoryId,
        invoiceId: invoice.id,
        customerId: invoice.customerId,
        creditNoteNumber: numbered.number,
        financialYear: numbered.financialYear,
        creditNoteDate,
        reason: input.reason,
        jurisdiction: invoice.jurisdiction,
        hsnCode: invoice.hsnCode,
        subtotalPaise: invoice.subtotalPaise,
        cgstPaise,
        sgstPaise,
        igstPaise,
        taxPaise,
        totalPaise: invoice.totalPaise,
        status: "issued",
        createdByUserId: actor.userId,
        updatedAt: now,
      })
      .run();
    const creditNoteId = Number(creditResult.lastInsertRowid);

    for (const item of items) {
      tx.insert(creditNoteItems)
        .values({
          creditNoteId,
          invoiceItemId: item.id,
          productId: item.productId,
          hsnCode: item.hsnCode,
          quantityPackets: item.quantityPackets,
          unitPricePaise: item.unitPricePaise,
          taxablePaise: item.taxablePaise,
          taxPaise: item.taxPaise,
          lineTotalPaise: item.lineTotalPaise,
          updatedAt: now,
        })
        .run();
      if (item.salesOrderItemId !== null) {
        tx.update(salesOrderItems)
          .set({
            invoicedPackets: sql`${salesOrderItems.invoicedPackets} - ${item.quantityPackets}`,
            updatedAt: now,
          })
          .where(eq(salesOrderItems.id, item.salesOrderItemId))
          .run();
      }
    }

    let amountPaidPaise = invoice.amountPaidPaise;
    if (invoice.amountPaidPaise > 0) {
      const latestPayment = tx
        .select({ method: payments.method })
        .from(payments)
        .where(eq(payments.invoiceId, invoice.id))
        .orderBy(desc(payments.id))
        .get();
      const refundNumber = allocateDocumentNumber(tx, actor.factoryId, "PAYMENT", creditNoteDate);
      tx.insert(payments)
        .values({
          factoryId: actor.factoryId,
          invoiceId: invoice.id,
          customerId: invoice.customerId,
          paymentNumber: refundNumber.number,
          paidAt: creditNoteDate,
          amountPaise: invoice.amountPaidPaise,
          method: latestPayment?.method ?? "other",
          notes: `Refund for cancelled invoice ${invoiceNumber}.`,
          direction: "debit",
          status: "correction",
          reason: input.reason,
          duplicateKey: null,
          recordedByUserId: actor.userId,
          updatedAt: now,
        })
        .run();
      amountPaidPaise = 0;
    }

    tx.update(invoices)
      .set({
        status: "cancelled",
        creditNoteNumber: numbered.number,
        creditNotePaise: invoice.totalPaise,
        amountPaidPaise,
        cancellationReason: input.reason,
        cancelledAt: now,
        updatedAt: now,
      })
      .where(eq(invoices.id, invoice.id))
      .run();

    recordAudit(tx, actor, "INVOICE_CANCELLED", "invoice", invoice.id, {
      invoiceNumber,
      creditNoteNumber: numbered.number,
      reason: input.reason,
      refundedPaise: invoice.amountPaidPaise,
    });

    const updated = tx.select().from(invoices).where(eq(invoices.id, invoice.id)).get();
    if (!updated) throw new WorkflowError("Unable to load the invoice.", "load_failed", 500);
    return loadInvoiceDetail(tx, updated);
  });
}

export function deriveInvoiceStatus(invoice: typeof invoices.$inferSelect, paymentRecords: PaymentRecord[]) {
  if (invoice.status === "cancelled") return "cancelled";
  const payable = Math.max(0, invoice.totalPaise - invoice.creditNotePaise);
  const status = deriveInvoicePaymentStatus(payable, paymentRecords);
  if (status === "paid") return "paid";
  if (status === "partially_paid") return "partially_paid";
  return invoice.dueDate < new Date().toISOString().slice(0, 10) ? "overdue" : "issued";
}

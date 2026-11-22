import { createElement } from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { and, eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { ReportPdfDocument } from "@/lib/exports/report-pdf-document";
import { reportToCsv, reportToXlsx } from "@/lib/exports/report-export";
import { permissionsFor, type RoleName } from "@/lib/auth/permissions";
import {
  auditLog,
  customers,
  invoiceItems,
  invoices,
  products,
  salesOrders,
  users,
} from "@/lib/db/schema";
import type { WorkflowActor } from "@/lib/workflows/context";
import { getAuditorTrail, listAuditEntries } from "@/lib/workflows/audit-explorer";
import {
  correctPayment,
  createPayment,
  getCollectionsDashboard,
  listPayments,
} from "@/lib/workflows/payments";
import { formatReportCell, getReport } from "@/lib/workflows/reports";
import { prepareDatabase } from "./database";

const db = prepareDatabase();

function suffix() {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`.toUpperCase();
}

function actorFor(email: string, role: RoleName): WorkflowActor {
  const user = db.select().from(users).where(eq(users.email, email)).get();
  if (!user) throw new Error(`Missing seeded user ${email}.`);
  return {
    userId: user.id,
    factoryId: user.factoryId,
    email: user.email,
    role,
    permissions: permissionsFor(role),
  };
}

function financeFixture() {
  const owner = actorFor("owner@graintrace.local", "owner");
  const accountant = actorFor("accountant@graintrace.local", "accountant");
  const id = suffix();
  const product = db
    .select()
    .from(products)
    .where(and(eq(products.factoryId, owner.factoryId), eq(products.code, "PROD-500")))
    .get();
  if (!product) throw new Error("Seeded product is missing.");

  const customerResult = db
    .insert(customers)
    .values({
      factoryId: owner.factoryId,
      code: `CUST-FIN-${id}`,
      name: `Finance Customer ${id}`,
      customerType: "retailer",
      deliveryState: "Maharashtra",
      state: "Maharashtra",
      creditTermsDays: 30,
      status: "active",
      updatedAt: new Date().toISOString(),
    })
    .returning()
    .get();

  const orderNumber = `SO-FIN-${id}`;
  const order = db
    .insert(salesOrders)
    .values({
      factoryId: owner.factoryId,
      customerId: customerResult.id,
      orderNumber,
      orderDate: "2026-03-01T00:00:00.000Z",
      status: "approved",
      totalAmountPaise: 787_500,
      createdByUserId: owner.userId,
      approvedByUserId: owner.userId,
      approvedAt: "2026-03-01T00:00:00.000Z",
      updatedAt: new Date().toISOString(),
    })
    .returning()
    .get();

  const invoiceNumber = `INV-FIN-${id}`;
  const invoice = db
    .insert(invoices)
    .values({
      factoryId: owner.factoryId,
      salesOrderId: order.id,
      customerId: customerResult.id,
      invoiceNumber,
      financialYear: "2026-2027",
      invoiceDate: "2026-03-01T00:00:00.000Z",
      dueDate: "2026-03-31T00:00:00.000Z",
      fromState: "Maharashtra",
      toState: "Maharashtra",
      jurisdiction: "intra_state",
      hsnCode: "110100",
      paymentTermsDays: 30,
      subtotalPaise: 750_000,
      taxPaise: 37_500,
      totalPaise: 787_500,
      status: "issued",
      postedAt: "2026-03-01T00:00:00.000Z",
      createdByUserId: owner.userId,
      updatedAt: new Date().toISOString(),
    })
    .returning()
    .get();

  db.insert(invoiceItems)
    .values({
      invoiceId: invoice.id,
      productId: product.id,
      hsnCode: "110100",
      quantityPackets: 100,
      unitPricePaise: 7_500,
      taxablePaise: 750_000,
      rateBasisPoints: 500,
      cgstPaise: 18_750,
      sgstPaise: 18_750,
      taxPaise: 37_500,
      lineTotalPaise: 787_500,
      updatedAt: new Date().toISOString(),
    })
    .run();

  return { owner, accountant, invoiceNumber, customerName: customerResult.name };
}

describe("phase 7 finance, reports, and audit", () => {
  it("records receipts, posts audited corrections, and keeps duplicate references out", () => {
    const { accountant, invoiceNumber } = financeFixture();
    const referenceNo = `FIN-REF-${suffix()}`;
    const payment = createPayment(accountant, {
      invoiceNumber,
      paidAt: "2026-03-05T00:00:00.000Z",
      amountPaise: 400_000,
      method: "upi",
      referenceNo,
      notes: "Benchmark partial receipt",
    });
    expect(payment.amountPaidPaise).toBe(400_000);

    expect(() =>
      createPayment(accountant, {
        invoiceNumber,
        paidAt: "2026-03-05T00:00:00.000Z",
        amountPaise: 100,
        method: "upi",
        referenceNo: referenceNo.toLowerCase(),
        notes: "",
      }),
    ).toThrow(/already been recorded/i);

    const correction = correctPayment(accountant, {
      paymentNumber: payment.paymentNumber,
      correctedAt: "2026-03-06T00:00:00.000Z",
      amountPaise: 50_000,
      reason: "Bank credited a lower amount than advised.",
    });
    expect(correction.amountPaidPaise).toBe(350_000);

    const records = listPayments(accountant.factoryId).filter(
      (row) => row.invoiceNumber === invoiceNumber,
    );
    expect(records).toHaveLength(2);
    expect(records.map((row) => row.signedAmountPaise).sort((left, right) => left - right)).toEqual([
      -50_000,
      400_000,
    ]);

    const invoice = db.select().from(invoices).where(eq(invoices.invoiceNumber, invoiceNumber)).get();
    expect(invoice?.amountPaidPaise).toBe(350_000);
    expect(invoice?.status).toBe("partially_paid");

    const audit = db
      .select()
      .from(auditLog)
      .where(and(eq(auditLog.factoryId, accountant.factoryId), eq(auditLog.entityType, "payment")))
      .all()
      .filter((entry) => JSON.stringify(entry.metadataJson).includes(invoiceNumber));
    expect(audit.some((entry) => entry.action === "PAYMENT_RECORDED")).toBe(true);
    const correctionAudit = audit.find((entry) => entry.action === "PAYMENT_CORRECTED");
    expect(correctionAudit?.severity).toBe("warning");
    expect(correctionAudit?.reason).toContain("Bank credited");
  });

  it("builds filtered reports with real data and exports CSV, XLSX, and PDF", async () => {
    const { accountant, invoiceNumber, customerName } = financeFixture();
    const referenceNo = `FIN-EXPORT-${suffix()}`;
    createPayment(accountant, {
      invoiceNumber,
      paidAt: "2026-03-05T00:00:00.000Z",
      amountPaise: 100_000,
      method: "bank_transfer",
      referenceNo,
      notes: "Export fixture",
    });

    const filters = { dateFrom: "2026-03-01", dateTo: "2026-03-31" };
    const sales = getReport(accountant.factoryId, "sales_register", filters);
    const salesRow = sales.rows.find((row) => row.invoice === invoiceNumber);
    expect(salesRow?.totalPaise).toBe(787_500);
    expect(salesRow?.customer).toBe(customerName);

    const collections = getReport(accountant.factoryId, "collections", filters);
    expect(collections.rows.some((row) => row.reference === referenceNo)).toBe(true);
    expect(formatReportCell(787_500, "paise")).toBe("₹7875.00");

    const dashboard = getCollectionsDashboard(accountant.factoryId);
    expect(dashboard.duePaise).toBeGreaterThanOrEqual(687_500);
    expect(dashboard.collectedPaise).toBeGreaterThanOrEqual(100_000);

    const csv = reportToCsv(sales);
    expect(csv).toContain(invoiceNumber);
    expect(csv).toContain("₹7875.00");

    const xlsx = await reportToXlsx(sales);
    expect(xlsx.byteLength).toBeGreaterThan(1000);

    const headers = sales.columns.map((column) => column.label);
    const rows = sales.rows.map((row) =>
      sales.columns.map((column) => formatReportCell(row[column.key] ?? null, column.kind)),
    );
    const pdf = await renderToBuffer(
      createElement(ReportPdfDocument, {
        title: `GrainTrace · ${sales.label}`,
        author: "GrainTrace",
        report: sales,
        headers,
        rows,
      }),
    );
    expect(pdf.byteLength).toBeGreaterThan(1000);
  });

  it("exposes audit search and an invoice source-to-transaction trail", () => {
    const { accountant, invoiceNumber } = financeFixture();
    createPayment(accountant, {
      invoiceNumber,
      paidAt: "2026-03-05T00:00:00.000Z",
      amountPaise: 200_000,
      method: "cash",
      referenceNo: "",
      notes: "Trail fixture",
    });
    correctPayment(accountant, {
      paymentNumber: listPayments(accountant.factoryId).find((row) => row.invoiceNumber === invoiceNumber)?.paymentNumber ?? "",
      correctedAt: "2026-03-06T00:00:00.000Z",
      amountPaise: 10_000,
      reason: "Cash count adjustment.",
    });

    const entries = listAuditEntries(accountant.factoryId, { action: "PAYMENT" });
    expect(entries.length).toBeGreaterThan(0);
    expect(entries.every((entry) => entry.action.includes("PAYMENT"))).toBe(true);

    const trail = getAuditorTrail(accountant.factoryId, invoiceNumber);
    expect(trail.kind).toBe("invoice");
    expect(trail.steps.some((step) => step.stage.includes("TAX DOCUMENT"))).toBe(true);
    expect(trail.steps.some((step) => step.stage.includes("CORRECTION"))).toBe(true);
  });
});

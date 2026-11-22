import "server-only";
import { asc, eq } from "drizzle-orm";
import {
  assertSafeInteger,
  calculateMarginBasisPoints,
  formatPaise,
  signedPaymentPaise,
  type Paise,
  type PaymentDirection,
  type PaymentMethod,
} from "@/domain";
import { getDb } from "@/lib/db";
import {
  customers,
  invoiceItems,
  invoices,
  payments,
  products,
  stockLedger,
} from "@/lib/db/schema";
import { listInventory } from "./inventory";
import { getProductionRunDetail, listProductionRuns } from "./production";
import { listCollections, listPayments } from "./payments";
import { listPurchaseOrders } from "./purchases";
import type { ReportFilterInput } from "./validation";

export type ReportKey =
  | "sales_register"
  | "gst_summary"
  | "collections"
  | "receivables_aging"
  | "inventory_valuation"
  | "production_cost_variance"
  | "purchase_register"
  | "customer_ledger"
  | "product_profitability"
  | "stock_movements";

export type ReportColumnKind = "text" | "date" | "integer" | "paise" | "basis_points";

export type ReportColumn = {
  key: string;
  label: string;
  kind: ReportColumnKind;
};

export type ReportRow = Record<string, string | number | null>;

export type ReportSummary = {
  label: string;
  value: string;
};

export type ReportDefinition = {
  key: ReportKey;
  label: string;
  description: string;
  columns: ReportColumn[];
  rows: ReportRow[];
  summaries: ReportSummary[];
  generatedAt: string;
  filters: ReportFilterInput;
};

export const REPORT_CATALOG: readonly { key: ReportKey; label: string; description: string }[] = [
  { key: "sales_register", label: "Sales register", description: "Taxable value, GST, and revenue by invoice line." },
  { key: "gst_summary", label: "GST summary", description: "CGST, SGST, and IGST grouped by HSN and jurisdiction." },
  { key: "collections", label: "Collections register", description: "Receipts, corrections, references, and collection status." },
  { key: "receivables_aging", label: "Receivables aging", description: "Open invoices bucketed by due date." },
  { key: "inventory_valuation", label: "Inventory valuation", description: "Stock on hand at weighted average cost." },
  { key: "production_cost_variance", label: "Production cost variance", description: "Yield and cost per good packet by run." },
  { key: "purchase_register", label: "Purchase register", description: "Purchase orders and committed spend by supplier." },
  { key: "customer_ledger", label: "Customer ledger", description: "Chronological invoice and receipt activity." },
  { key: "product_profitability", label: "Product profitability", description: "Revenue, tax, estimated cost, and margin by product." },
  { key: "stock_movements", label: "Stock movement register", description: "Append-only inventory ledger entries with source references." },
];

export type ReportFilters = ReportFilterInput;

function isReportKey(value: string): value is ReportKey {
  return REPORT_CATALOG.some((report) => report.key === value);
}

export function parseReportKey(value: string | undefined): ReportKey {
  return value && isReportKey(value) ? value : REPORT_CATALOG[0].key;
}

export function getReportOptions(factoryId: number) {
  const db = getDb();
  const customerRows = db
    .select({ id: customers.id, name: customers.name })
    .from(customers)
    .where(eq(customers.factoryId, factoryId))
    .orderBy(asc(customers.name))
    .all();
  const productRows = db
    .select({ id: products.id, code: products.code, name: products.name, category: products.category })
    .from(products)
    .where(eq(products.factoryId, factoryId))
    .orderBy(asc(products.name))
    .all();
  return {
    customers: customerRows,
    products: productRows,
    categories: Array.from(new Set(productRows.map((product) => product.category))).sort(),
  };
}

function dateOnly(value: string) {
  return value.slice(0, 10);
}

function matchesDate(value: string | null | undefined, filters: ReportFilters) {
  if (!value) return false;
  const date = dateOnly(value);
  if (filters.dateFrom && date < dateOnly(filters.dateFrom)) return false;
  if (filters.dateTo && date > dateOnly(filters.dateTo)) return false;
  return true;
}

function matchesCustomer(customerId: number, filters: ReportFilters) {
  return !filters.customerId || filters.customerId === customerId;
}

function sumColumn(rows: ReportRow[], key: string): Paise {
  return assertSafeInteger(
    rows.reduce((total, row) => total + Number(row[key] ?? 0), 0),
    "report total",
  );
}

function summary(label: string, valuePaise: number): ReportSummary {
  return { label, value: formatPaise(valuePaise) };
}

function countSummary(label: string, value: number): ReportSummary {
  return { label, value: String(value) };
}

function commonColumns(columns: ReportColumn[]): ReportColumn[] {
  return columns;
}

function salesRegister(factoryId: number, filters: ReportFilters): ReportDefinition {
  const db = getDb();
  const rows = db
    .select({
      invoiceDate: invoices.invoiceDate,
      invoiceNumber: invoices.invoiceNumber,
      productId: invoiceItems.productId,
      customerId: invoices.customerId,
      customerName: customers.name,
      productName: products.name,
      category: products.category,
      hsnCode: invoiceItems.hsnCode,
      quantityPackets: invoiceItems.quantityPackets,
      taxablePaise: invoiceItems.taxablePaise,
      taxPaise: invoiceItems.taxPaise,
      lineTotalPaise: invoiceItems.lineTotalPaise,
      status: invoices.status,
      totalPaise: invoices.totalPaise,
      amountPaidPaise: invoices.amountPaidPaise,
      creditNotePaise: invoices.creditNotePaise,
    })
    .from(invoiceItems)
    .innerJoin(invoices, eq(invoiceItems.invoiceId, invoices.id))
    .innerJoin(customers, eq(invoices.customerId, customers.id))
    .innerJoin(products, eq(invoiceItems.productId, products.id))
    .where(eq(invoices.factoryId, factoryId))
    .orderBy(asc(invoices.invoiceDate), asc(invoices.id), asc(invoiceItems.id))
    .all()
    .filter(
      (row) =>
        matchesDate(row.invoiceDate, filters) &&
        matchesCustomer(row.customerId, filters) &&
        (!filters.productId || filters.productId === row.productId) &&
        (!filters.category || filters.category === row.category),
    )
    .map((row) => ({
      date: dateOnly(row.invoiceDate),
      invoice: row.invoiceNumber,
      customer: row.customerName,
      product: row.productName,
      category: row.category,
      hsn: row.hsnCode,
      packets: row.quantityPackets,
      taxablePaise: row.taxablePaise,
      taxPaise: row.taxPaise,
      totalPaise: row.lineTotalPaise,
      status: row.status,
      outstandingPaise:
        row.status === "cancelled"
          ? 0
          : Math.max(0, row.totalPaise - row.creditNotePaise - row.amountPaidPaise),
    }));

  return {
    key: "sales_register",
    label: "Sales register",
    description: "Taxable value, GST, and revenue by invoice line.",
    columns: commonColumns([
      { key: "date", label: "Date", kind: "date" },
      { key: "invoice", label: "Invoice", kind: "text" },
      { key: "customer", label: "Customer", kind: "text" },
      { key: "product", label: "Product", kind: "text" },
      { key: "category", label: "Category", kind: "text" },
      { key: "hsn", label: "HSN", kind: "text" },
      { key: "packets", label: "Packets", kind: "integer" },
      { key: "taxablePaise", label: "Taxable", kind: "paise" },
      { key: "taxPaise", label: "GST", kind: "paise" },
      { key: "totalPaise", label: "Line total", kind: "paise" },
      { key: "outstandingPaise", label: "Outstanding", kind: "paise" },
      { key: "status", label: "Status", kind: "text" },
    ]),
    rows,
    summaries: [
      countSummary("Lines", rows.length),
      summary("Taxable value", sumColumn(rows, "taxablePaise")),
      summary("GST", sumColumn(rows, "taxPaise")),
      summary("Revenue", sumColumn(rows, "totalPaise")),
    ],
    generatedAt: new Date().toISOString(),
    filters,
  };
}

function gstSummary(factoryId: number, filters: ReportFilters): ReportDefinition {
  const db = getDb();
  const lines = db
    .select({
      invoiceDate: invoices.invoiceDate,
      customerId: invoices.customerId,
      productId: invoiceItems.productId,
      jurisdiction: invoices.jurisdiction,
      hsnCode: invoiceItems.hsnCode,
      taxablePaise: invoiceItems.taxablePaise,
      cgstPaise: invoiceItems.cgstPaise,
      sgstPaise: invoiceItems.sgstPaise,
      igstPaise: invoiceItems.igstPaise,
      taxPaise: invoiceItems.taxPaise,
      lineTotalPaise: invoiceItems.lineTotalPaise,
    })
    .from(invoiceItems)
    .innerJoin(invoices, eq(invoiceItems.invoiceId, invoices.id))
    .where(eq(invoices.factoryId, factoryId))
    .all()
    .filter(
      (row) =>
        matchesDate(row.invoiceDate, filters) &&
        matchesCustomer(row.customerId, filters) &&
        (!filters.productId || filters.productId === row.productId),
    );

  const productsById = new Map(
    getReportOptions(factoryId).products.map((product) => [product.id, product]),
  );
  const groups = new Map<string, Record<string, string | number>>();
  for (const line of lines) {
    const product = productsById.get(line.productId);
    if (filters.category && product?.category !== filters.category) continue;
    const key = `${line.hsnCode}|${line.jurisdiction}`;
    const group = groups.get(key) ?? {
      hsn: line.hsnCode,
      jurisdiction: line.jurisdiction,
      taxablePaise: 0,
      cgstPaise: 0,
      sgstPaise: 0,
      igstPaise: 0,
      taxPaise: 0,
      totalPaise: 0,
    };
    group.taxablePaise = Number(group.taxablePaise) + line.taxablePaise;
    group.cgstPaise = Number(group.cgstPaise) + line.cgstPaise;
    group.sgstPaise = Number(group.sgstPaise) + line.sgstPaise;
    group.igstPaise = Number(group.igstPaise) + line.igstPaise;
    group.taxPaise = Number(group.taxPaise) + line.taxPaise;
    group.totalPaise = Number(group.totalPaise) + line.lineTotalPaise;
    groups.set(key, group);
  }
  const rows: ReportRow[] = Array.from(groups.values()).sort((left, right) =>
    String(left.hsn).localeCompare(String(right.hsn)),
  );
  return {
    key: "gst_summary",
    label: "GST summary",
    description: "CGST, SGST, and IGST grouped by HSN and jurisdiction.",
    columns: [
      { key: "hsn", label: "HSN", kind: "text" },
      { key: "jurisdiction", label: "Jurisdiction", kind: "text" },
      { key: "taxablePaise", label: "Taxable", kind: "paise" },
      { key: "cgstPaise", label: "CGST", kind: "paise" },
      { key: "sgstPaise", label: "SGST", kind: "paise" },
      { key: "igstPaise", label: "IGST", kind: "paise" },
      { key: "taxPaise", label: "Total GST", kind: "paise" },
      { key: "totalPaise", label: "Invoice value", kind: "paise" },
    ],
    rows,
    summaries: [
      countSummary("Groups", rows.length),
      summary("Taxable value", sumColumn(rows, "taxablePaise")),
      summary("CGST", sumColumn(rows, "cgstPaise")),
      summary("SGST", sumColumn(rows, "sgstPaise")),
      summary("IGST", sumColumn(rows, "igstPaise")),
      summary("Total GST", sumColumn(rows, "taxPaise")),
    ],
    generatedAt: new Date().toISOString(),
    filters,
  };
}

function collectionsReport(factoryId: number, filters: ReportFilters): ReportDefinition {
  const customerById = new Map(
    getReportOptions(factoryId).customers.map((customer) => [customer.id, customer.name]),
  );
  const rows = listPayments(factoryId)
    .filter((payment) => matchesDate(payment.paidAt, filters))
    .filter((payment) => !filters.customerId || payment.customerName === customerById.get(filters.customerId))
    .map((payment) => ({
      date: dateOnly(payment.paidAt),
      receipt: payment.paymentNumber,
      invoice: payment.invoiceNumber,
      customer: payment.customerName,
      method: payment.method.replaceAll("_", " "),
      reference: payment.referenceNo ?? "",
      direction: payment.direction === "debit" ? "correction" : "receipt",
      amountPaise: payment.signedAmountPaise,
      status: payment.status,
    }));

  return {
    key: "collections",
    label: "Collections register",
    description: "Receipts, corrections, references, and collection status.",
    columns: [
      { key: "date", label: "Date", kind: "date" },
      { key: "receipt", label: "Receipt", kind: "text" },
      { key: "invoice", label: "Invoice", kind: "text" },
      { key: "customer", label: "Customer", kind: "text" },
      { key: "method", label: "Method", kind: "text" },
      { key: "reference", label: "Reference", kind: "text" },
      { key: "direction", label: "Type", kind: "text" },
      { key: "amountPaise", label: "Net amount", kind: "paise" },
      { key: "status", label: "Status", kind: "text" },
    ],
    rows,
    summaries: [
      countSummary("Entries", rows.length),
      summary("Net collected", sumColumn(rows, "amountPaise")),
    ],
    generatedAt: new Date().toISOString(),
    filters,
  };
}

function receivablesAging(factoryId: number, filters: ReportFilters): ReportDefinition {
  const rows = listCollections(factoryId)
    .filter((row) => row.outstandingPaise > 0)
    .filter((row) => matchesDate(row.invoiceDate, filters))
    .filter((row) => matchesCustomer(row.customerId, filters))
    .map((row) => ({
      invoice: row.invoiceNumber,
      customer: row.customerName,
      invoiceDate: row.invoiceDate,
      dueDate: row.dueDate,
      aging: row.agingBucket.replaceAll("_", " "),
      totalPaise: row.totalPaise,
      paidPaise: row.amountPaidPaise,
      creditPaise: row.creditNotePaise,
      outstandingPaise: row.outstandingPaise,
    }));
  return {
    key: "receivables_aging",
    label: "Receivables aging",
    description: "Open invoices bucketed by due date.",
    columns: [
      { key: "invoice", label: "Invoice", kind: "text" },
      { key: "customer", label: "Customer", kind: "text" },
      { key: "invoiceDate", label: "Invoice date", kind: "date" },
      { key: "dueDate", label: "Due date", kind: "date" },
      { key: "aging", label: "Aging", kind: "text" },
      { key: "totalPaise", label: "Invoice total", kind: "paise" },
      { key: "paidPaise", label: "Received", kind: "paise" },
      { key: "creditPaise", label: "Credit note", kind: "paise" },
      { key: "outstandingPaise", label: "Outstanding", kind: "paise" },
    ],
    rows,
    summaries: [
      countSummary("Open invoices", rows.length),
      summary("Outstanding", sumColumn(rows, "outstandingPaise")),
    ],
    generatedAt: new Date().toISOString(),
    filters,
  };
}

function inventoryValuation(factoryId: number, filters: ReportFilters): ReportDefinition {
  const productRows = getReportOptions(factoryId).products;
  const selectedProduct = productRows.find((product) => product.id === filters.productId);
  const rows = listInventory(factoryId)
    .filter((row) => !selectedProduct || row.name === selectedProduct.name)
    .filter(
      (row) =>
        !filters.category ||
        productRows.some((product) => product.name === row.name && product.category === filters.category),
    )
    .map((row) => ({
      item: `${row.code} · ${row.name}`,
      category: row.category.replaceAll("_", " "),
      stock: row.currentStock,
      unit: row.unit,
      averageCostPaise: row.averageCostPaise,
      valuePaise: row.stockValuePaise,
      status: row.status,
    }));
  return {
    key: "inventory_valuation",
    label: "Inventory valuation",
    description: "Stock on hand at weighted average cost.",
    columns: [
      { key: "item", label: "Item", kind: "text" },
      { key: "category", label: "Category", kind: "text" },
      { key: "stock", label: "Stock", kind: "integer" },
      { key: "unit", label: "Unit", kind: "text" },
      { key: "averageCostPaise", label: "Avg cost", kind: "paise" },
      { key: "valuePaise", label: "Stock value", kind: "paise" },
      { key: "status", label: "Status", kind: "text" },
    ],
    rows,
    summaries: [
      countSummary("Items", rows.length),
      summary("Stock value", sumColumn(rows, "valuePaise")),
    ],
    generatedAt: new Date().toISOString(),
    filters,
  };
}

function productionCostVariance(factoryId: number, filters: ReportFilters): ReportDefinition {
  const runs = listProductionRuns(factoryId);
  const rows: ReportRow[] = [];
  for (const run of runs) {
    if (filters.productId && !run.productCode) continue;
    const detail = getProductionRunDetail(factoryId, run.runNumber);
    if (!detail) continue;
    const date = detail.postedAt ?? detail.completedAt ?? detail.createdAt;
    if (!matchesDate(date, filters)) continue;
    const snapshot = detail.snapshot;
    if (!snapshot) continue;
    rows.push({
      run: detail.runNumber,
      date: dateOnly(date),
      product: detail.productName,
      packets: detail.goodOutputPackets,
      yieldVarianceBasisPoints: detail.yieldVarianceBasisPoints ?? 0,
      materialPaise: snapshot.materialCostPaise,
      labourPaise: snapshot.labourPaise,
      gasPaise: snapshot.gasPaise,
      overheadPaise: snapshot.overheadPaise,
      totalPaise: snapshot.totalRunCostPaise,
      costPerPacketPaise: snapshot.costPerGoodPacketPaise,
    });
  }
  return {
    key: "production_cost_variance",
    label: "Production cost variance",
    description: "Yield and cost per good packet by run.",
    columns: [
      { key: "run", label: "Run", kind: "text" },
      { key: "date", label: "Date", kind: "date" },
      { key: "product", label: "Product", kind: "text" },
      { key: "packets", label: "Good packets", kind: "integer" },
      { key: "yieldVarianceBasisPoints", label: "Yield variance", kind: "basis_points" },
      { key: "materialPaise", label: "Material", kind: "paise" },
      { key: "labourPaise", label: "Labour", kind: "paise" },
      { key: "gasPaise", label: "Gas", kind: "paise" },
      { key: "overheadPaise", label: "Overhead", kind: "paise" },
      { key: "totalPaise", label: "Total cost", kind: "paise" },
      { key: "costPerPacketPaise", label: "Cost / packet", kind: "paise" },
    ],
    rows,
    summaries: [
      countSummary("Posted runs", rows.length),
      summary("Material", sumColumn(rows, "materialPaise")),
      summary("Total cost", sumColumn(rows, "totalPaise")),
    ],
    generatedAt: new Date().toISOString(),
    filters,
  };
}

function purchaseRegister(factoryId: number, filters: ReportFilters): ReportDefinition {
  const rows = listPurchaseOrders(factoryId)
    .filter((row) => matchesDate(row.orderDate, filters))
    .map((row) => ({
      order: row.orderNumber,
      date: row.orderDate,
      supplier: row.supplierName,
      status: row.status,
      lines: row.lineCount,
      amountPaise: row.totalAmountPaise,
    }));
  return {
    key: "purchase_register",
    label: "Purchase register",
    description: "Purchase orders and committed spend by supplier.",
    columns: [
      { key: "order", label: "Order", kind: "text" },
      { key: "date", label: "Date", kind: "date" },
      { key: "supplier", label: "Supplier", kind: "text" },
      { key: "status", label: "Status", kind: "text" },
      { key: "lines", label: "Lines", kind: "integer" },
      { key: "amountPaise", label: "Commitment", kind: "paise" },
    ],
    rows,
    summaries: [
      countSummary("Orders", rows.length),
      summary("Committed spend", sumColumn(rows, "amountPaise")),
    ],
    generatedAt: new Date().toISOString(),
    filters,
  };
}

function customerLedger(factoryId: number, filters: ReportFilters): ReportDefinition {
  const db = getDb();
  const invoiceRows = db
    .select({
      date: invoices.invoiceDate,
      customerId: invoices.customerId,
      customerName: customers.name,
      document: invoices.invoiceNumber,
      type: invoices.status,
      amountPaise: invoices.totalPaise,
    })
    .from(invoices)
    .innerJoin(customers, eq(invoices.customerId, customers.id))
    .where(eq(invoices.factoryId, factoryId))
    .all()
    .filter((row) => matchesDate(row.date, filters) && matchesCustomer(row.customerId, filters))
    .map((row) => ({
      date: dateOnly(row.date),
      customer: row.customerName,
      document: row.document,
      type: "invoice",
      debitPaise: row.type === "cancelled" ? 0 : row.amountPaise,
      creditPaise: 0,
    }));
  const paymentRows = db
    .select({
      date: payments.paidAt,
      customerId: payments.customerId,
      customerName: customers.name,
      document: payments.paymentNumber,
      method: payments.method,
      amountPaise: payments.amountPaise,
      direction: payments.direction,
    })
    .from(payments)
    .innerJoin(customers, eq(payments.customerId, customers.id))
    .where(eq(payments.factoryId, factoryId))
    .all()
    .filter((row) => matchesDate(row.date, filters) && matchesCustomer(row.customerId, filters))
    .map((row) => {
      const direction = row.direction as PaymentDirection;
      const signed = signedPaymentPaise({
        paymentId: row.document,
        invoiceNumber: "",
        amountPaise: row.amountPaise,
        method: row.method as PaymentMethod,
        paidAt: row.date,
        direction,
      });
      return {
        date: dateOnly(row.date),
        customer: row.customerName,
        document: row.document,
        type: direction === "debit" ? "correction" : "receipt",
        debitPaise: 0,
        creditPaise: signed > 0 ? signed : -signed,
      };
    });
  const rows = [...invoiceRows, ...paymentRows].sort((left, right) => {
    const byDate = String(left.date).localeCompare(String(right.date));
    return byDate || String(left.document).localeCompare(String(right.document));
  });
  return {
    key: "customer_ledger",
    label: "Customer ledger",
    description: "Chronological invoice and receipt activity.",
    columns: [
      { key: "date", label: "Date", kind: "date" },
      { key: "customer", label: "Customer", kind: "text" },
      { key: "document", label: "Document", kind: "text" },
      { key: "type", label: "Type", kind: "text" },
      { key: "debitPaise", label: "Debit", kind: "paise" },
      { key: "creditPaise", label: "Credit", kind: "paise" },
    ],
    rows,
    summaries: [
      countSummary("Entries", rows.length),
      summary("Invoiced", sumColumn(rows, "debitPaise")),
      summary("Received", sumColumn(rows, "creditPaise")),
    ],
    generatedAt: new Date().toISOString(),
    filters,
  };
}

function productProfitability(factoryId: number, filters: ReportFilters): ReportDefinition {
  const productById = new Map(getReportOptions(factoryId).products.map((product) => [product.id, product]));
  const lineRows = getDb()
    .select({
      productId: invoiceItems.productId,
      invoiceDate: invoices.invoiceDate,
      customerId: invoices.customerId,
      quantityPackets: invoiceItems.quantityPackets,
      taxablePaise: invoiceItems.taxablePaise,
      taxPaise: invoiceItems.taxPaise,
      lineTotalPaise: invoiceItems.lineTotalPaise,
    })
    .from(invoiceItems)
    .innerJoin(invoices, eq(invoiceItems.invoiceId, invoices.id))
    .where(eq(invoices.factoryId, factoryId))
    .all()
    .filter(
      (row) =>
        matchesDate(row.invoiceDate, filters) &&
        matchesCustomer(row.customerId, filters) &&
        (!filters.productId || filters.productId === row.productId) &&
        (!filters.category || productById.get(row.productId)?.category === filters.category),
    );

  const grouped = new Map<number, ReportRow>();
  for (const line of lineRows) {
    const product = productById.get(line.productId);
    if (!product) continue;
    const row = grouped.get(line.productId) ?? {
      product: product.name,
      category: product.category,
      packets: 0,
      revenuePaise: 0,
      taxPaise: 0,
      costPaise: 0,
      marginPaise: 0,
      marginBasisPoints: 0,
    };
    row.packets = Number(row.packets) + line.quantityPackets;
    row.revenuePaise = Number(row.revenuePaise) + line.lineTotalPaise;
    row.taxPaise = Number(row.taxPaise) + line.taxPaise;
    grouped.set(line.productId, row);
  }

  const costByProduct = new Map<string, number>();
  for (const run of listProductionRuns(factoryId)) {
    if (run.costPerPacketPaise === null) continue;
    costByProduct.set(run.productCode, run.costPerPacketPaise);
  }
  const rows = Array.from(grouped.values());
  for (const row of rows) {
    const product = Array.from(productById.values()).find((item) => item.name === row.product);
    const costPerPacket = product
      ? costByProduct.get(product.code) ?? costByProduct.get(product.category) ?? 0
      : 0;
    row.costPaise = Number(row.packets) * costPerPacket;
    const revenue = Number(row.revenuePaise);
    const cost = Number(row.costPaise);
    row.marginPaise = Math.max(0, revenue - cost);
    row.marginBasisPoints = revenue > 0 ? calculateMarginBasisPoints(revenue, cost) : 0;
  }
  return {
    key: "product_profitability",
    label: "Product profitability",
    description: "Revenue, tax, estimated cost, and margin by product.",
    columns: [
      { key: "product", label: "Product", kind: "text" },
      { key: "category", label: "Category", kind: "text" },
      { key: "packets", label: "Packets", kind: "integer" },
      { key: "revenuePaise", label: "Revenue", kind: "paise" },
      { key: "taxPaise", label: "GST", kind: "paise" },
      { key: "costPaise", label: "Est. cost", kind: "paise" },
      { key: "marginPaise", label: "Margin", kind: "paise" },
      { key: "marginBasisPoints", label: "Margin %", kind: "basis_points" },
    ],
    rows,
    summaries: [
      countSummary("Products", rows.length),
      summary("Revenue", sumColumn(rows, "revenuePaise")),
      summary("Estimated cost", sumColumn(rows, "costPaise")),
      summary("Margin", sumColumn(rows, "marginPaise")),
    ],
    generatedAt: new Date().toISOString(),
    filters,
  };
}

function stockMovements(factoryId: number, filters: ReportFilters): ReportDefinition {
  const rows = getDb()
    .select()
    .from(stockLedger)
    .where(eq(stockLedger.factoryId, factoryId))
    .orderBy(asc(stockLedger.occurredAt), asc(stockLedger.id))
    .all()
    .filter((row) => matchesDate(row.occurredAt, filters))
    .map((row) => ({
      date: dateOnly(row.occurredAt),
      source: row.referenceNumber,
      type: row.transactionType.replaceAll("_", " "),
      item: row.referenceType.replaceAll("_", " "),
      quantityDelta: row.quantityDelta,
      balance: row.balance,
      unit: row.baseUnit,
    }));
  return {
    key: "stock_movements",
    label: "Stock movement register",
    description: "Append-only inventory ledger entries with source references.",
    columns: [
      { key: "date", label: "Date", kind: "date" },
      { key: "source", label: "Source", kind: "text" },
      { key: "type", label: "Transaction", kind: "text" },
      { key: "item", label: "Reference", kind: "text" },
      { key: "quantityDelta", label: "Change", kind: "integer" },
      { key: "balance", label: "Balance", kind: "integer" },
      { key: "unit", label: "Unit", kind: "text" },
    ],
    rows,
    summaries: [countSummary("Movements", rows.length)],
    generatedAt: new Date().toISOString(),
    filters,
  };
}

export function getReport(
  factoryId: number,
  key: ReportKey,
  filters: ReportFilters = {},
): ReportDefinition {
  switch (key) {
    case "gst_summary":
      return gstSummary(factoryId, filters);
    case "collections":
      return collectionsReport(factoryId, filters);
    case "receivables_aging":
      return receivablesAging(factoryId, filters);
    case "inventory_valuation":
      return inventoryValuation(factoryId, filters);
    case "production_cost_variance":
      return productionCostVariance(factoryId, filters);
    case "purchase_register":
      return purchaseRegister(factoryId, filters);
    case "customer_ledger":
      return customerLedger(factoryId, filters);
    case "product_profitability":
      return productProfitability(factoryId, filters);
    case "stock_movements":
      return stockMovements(factoryId, filters);
    case "sales_register":
      return salesRegister(factoryId, filters);
  }
}

export function formatReportCell(value: string | number | null, kind: ReportColumnKind) {
  if (value === null) return "";
  if (kind === "paise") return formatPaise(Number(value));
  if (kind === "basis_points") {
    const basisPoints = Number(value);
    return `${(basisPoints / 100).toFixed(2)}%`;
  }
  return String(value);
}

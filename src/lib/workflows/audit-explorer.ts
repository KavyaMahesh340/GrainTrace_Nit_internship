import "server-only";
import { and, asc, eq } from "drizzle-orm";
import { formatPaise, type PaymentDirection, type PaymentMethod } from "@/domain";
import { getDb } from "@/lib/db";
import {
  auditLog,
  dispatches,
  invoices,
  payments,
  salesOrders,
  users,
} from "@/lib/db/schema";
import { getBatchTrace } from "./batch-dna";
import { getInvoiceDetail } from "./invoices";
import type { AuditFilterInput } from "./validation";

export type AuditEntry = {
  id: number;
  createdAt: string;
  userId: number | null;
  actorEmail: string | null;
  actorName: string | null;
  actorRole: string | null;
  action: string;
  entityType: string;
  entityId: number | null;
  severity: "info" | "warning" | "critical";
  reason: string | null;
  metadata: Record<string, unknown>;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  sourceHref: string | null;
};

export type AuditorTrailStep = {
  id: string;
  stage: string;
  label: string;
  detail: string;
  timestamp: string | null;
  href: string | null;
  risk: boolean;
};

export type AuditorTrail = {
  identifier: string;
  kind: "invoice" | "batch" | "audit";
  title: string;
  steps: AuditorTrailStep[];
  gaps: string[];
};

function parseJsonObject(value: string | null): Record<string, unknown> | null {
  if (!value) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : value === null || value === undefined ? "" : String(value);
}

function sourceHref(metadata: Record<string, unknown>, entityType: string, entityId: number | null) {
  const invoiceNumber = stringValue(metadata.invoiceNumber);
  const runNumber = stringValue(metadata.runNumber);
  const dispatchNumber = stringValue(metadata.dispatchNumber);
  if (invoiceNumber) return `/invoices?focus=${encodeURIComponent(invoiceNumber)}`;
  if (runNumber) return `/production?focus=${encodeURIComponent(runNumber)}`;
  if (dispatchNumber) return `/dispatch?focus=${encodeURIComponent(dispatchNumber)}`;
  if (entityType === "payment") return "/collections";
  if (entityType === "invoice" && entityId) return `/invoices?focus=${entityId}`;
  return null;
}

export function listAuditEntries(factoryId: number, filters: AuditFilterInput = {}): AuditEntry[] {
  const query = filters.query?.trim().toLowerCase() ?? "";
  const action = filters.action?.trim().toLowerCase() ?? "";
  const entityType = filters.entityType?.trim().toLowerCase() ?? "";

  return getDb()
    .select({ entry: auditLog, actorName: users.fullName })
    .from(auditLog)
    .leftJoin(users, eq(auditLog.userId, users.id))
    .where(eq(auditLog.factoryId, factoryId))
    .orderBy(asc(auditLog.createdAt), asc(auditLog.id))
    .all()
    .reverse()
    .map(({ entry, actorName }) => {
      const metadata = parseJsonObject(entry.metadataJson) ?? {};
      return {
        id: entry.id,
        createdAt: entry.createdAt,
        userId: entry.userId,
        actorEmail: entry.actorEmail,
        actorName,
        actorRole: entry.actorRole,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId,
        severity: entry.severity as AuditEntry["severity"],
        reason: entry.reason,
        metadata,
        before: parseJsonObject(entry.beforeJson),
        after: parseJsonObject(entry.afterJson),
        sourceHref: sourceHref(metadata, entry.entityType, entry.entityId),
      };
    })
    .filter((entry) => {
      if (action && !entry.action.toLowerCase().includes(action)) return false;
      if (entityType && !entry.entityType.toLowerCase().includes(entityType)) return false;
      if (filters.userId && entry.userId !== filters.userId) return false;
      if (filters.dateFrom && entry.createdAt.slice(0, 10) < filters.dateFrom.slice(0, 10)) return false;
      if (filters.dateTo && entry.createdAt.slice(0, 10) > filters.dateTo.slice(0, 10)) return false;
      if (!query) return true;
      return `${entry.action} ${entry.entityType} ${entry.actorEmail ?? ""} ${entry.actorName ?? ""} ${JSON.stringify(entry.metadata)}`
        .toLowerCase()
        .includes(query);
    });
}

function invoiceTrail(factoryId: number, invoiceNumber: string): AuditorTrail | null {
  const db = getDb();
  const invoice = db
    .select()
    .from(invoices)
    .where(and(eq(invoices.factoryId, factoryId), eq(invoices.invoiceNumber, invoiceNumber)))
    .get();
  if (!invoice) return null;
  const detail = getInvoiceDetail(factoryId, invoiceNumber);
  const order = db.select().from(salesOrders).where(eq(salesOrders.id, invoice.salesOrderId)).get();
  const steps: AuditorTrailStep[] = [];

  if (order) {
    steps.push({
      id: `order-${order.id}`,
      stage: "01 / SOURCE ORDER",
      label: order.orderNumber,
      detail: `Sales order raised and approved for ${detail?.customerName ?? "customer"}.`,
      timestamp: order.approvedAt ?? order.orderDate,
      href: `/orders?focus=${encodeURIComponent(order.orderNumber)}`,
      risk: false,
    });
  }
  for (const dispatch of db
    .select()
    .from(dispatches)
    .where(eq(dispatches.invoiceId, invoice.id))
    .orderBy(asc(dispatches.id))
    .all()) {
    steps.push({
      id: `dispatch-${dispatch.id}`,
      stage: `${String(steps.length + 1).padStart(2, "0")} / DISPATCH`,
      label: dispatch.dispatchNumber,
      detail: `Dispatch status ${dispatch.status}; carrier ${dispatch.carrierName || "not assigned"}.`,
      timestamp: dispatch.dispatchedAt,
      href: `/dispatch?focus=${encodeURIComponent(dispatch.dispatchNumber)}`,
      risk: false,
    });
  }
  steps.push({
    id: `invoice-${invoice.id}`,
    stage: `${String(steps.length + 1).padStart(2, "0")} / TAX DOCUMENT`,
    label: invoice.invoiceNumber,
    detail: `${formatPaise(invoice.totalPaise)} invoiced on ${invoice.invoiceDate.slice(0, 10)}; due ${invoice.dueDate.slice(0, 10)}.`,
    timestamp: invoice.postedAt ?? invoice.invoiceDate,
    href: `/invoices?focus=${encodeURIComponent(invoice.invoiceNumber)}`,
    risk: invoice.status === "cancelled",
  });
  for (const payment of db
    .select()
    .from(payments)
    .where(eq(payments.invoiceId, invoice.id))
    .orderBy(asc(payments.id))
    .all()) {
    const direction = payment.direction as PaymentDirection;
    steps.push({
      id: `payment-${payment.id}`,
      stage: `${String(steps.length + 1).padStart(2, "0")} / ${direction === "debit" ? "CORRECTION" : "COLLECTION"}`,
      label: payment.paymentNumber,
      detail: `${direction === "debit" ? "Reversal of" : "Receipt of"} ${formatPaise(payment.amountPaise)} via ${(payment.method as PaymentMethod).replaceAll("_", " ")}.`,
      timestamp: payment.paidAt,
      href: "/collections",
      risk: direction === "debit",
    });
  }
  for (const entry of listAuditEntries(factoryId, { query: invoiceNumber })) {
    steps.push({
      id: `audit-${entry.id}`,
      stage: `${String(steps.length + 1).padStart(2, "0")} / AUDIT`,
      label: entry.action.replaceAll("_", " "),
      detail: entry.reason ?? `${entry.actorEmail ?? "System"} recorded ${entry.action.toLowerCase()}.`,
      timestamp: entry.createdAt,
      href: `/audit?focus=${entry.id}`,
      risk: entry.severity !== "info",
    });
  }

  return {
    identifier: invoiceNumber,
    kind: "invoice",
    title: `${invoiceNumber} · ${detail?.customerName ?? "Invoice"}`,
    steps,
    gaps: detail?.lines.length === 0 ? ["Invoice lines are unavailable."] : [],
  };
}

function batchTrail(factoryId: number, identifier: string): AuditorTrail | null {
  const trace = getBatchTrace(factoryId, identifier);
  if (!trace) return null;
  return {
    identifier,
    kind: "batch",
    title: `${trace.batchCode} · ${trace.runNumber}`,
    steps: trace.nodes.map((node) => ({
      id: node.id,
      stage: node.stageLabel,
      label: node.label,
      detail: `${node.summary}${node.quantity ? ` · ${node.quantity}` : ""}`,
      timestamp: node.timestamp,
      href: node.links[0]?.href ?? null,
      risk: node.risk,
    })),
    gaps: trace.gaps,
  };
}

export function getAuditorTrail(factoryId: number, identifier: string): AuditorTrail {
  const needle = identifier.trim();
  const invoice = invoiceTrail(factoryId, needle);
  if (invoice) return invoice;
  const batch = batchTrail(factoryId, needle);
  if (batch) return batch;

  const matches = listAuditEntries(factoryId, { query: needle }).slice(0, 30);
  return {
    identifier: needle,
    kind: "audit",
    title: `Audit references for ${needle}`,
    steps: matches.map((entry) => ({
      id: `audit-${entry.id}`,
      stage: entry.entityType.replaceAll("_", " ").toUpperCase(),
      label: entry.action.replaceAll("_", " "),
      detail: entry.reason ?? `${entry.actorEmail ?? "System"} · ${JSON.stringify(entry.metadata)}`,
      timestamp: entry.createdAt,
      href: entry.sourceHref,
      risk: entry.severity !== "info",
    })),
    gaps: matches.length === 0 ? ["No matching source document was found."] : [],
  };
}

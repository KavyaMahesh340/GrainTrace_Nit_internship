import "server-only";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { assertUniqueIds, multiplyPaiseByInteger, subtractPaise } from "@/domain";
import { getDb } from "@/lib/db";
import { customers, products, salesOrderItems, salesOrders, users } from "@/lib/db/schema";
import type { WorkflowActor } from "./context";
import { requireActorPermission } from "./context";
import type { WorkflowDb, WorkflowTransaction } from "./db";
import { recordAudit } from "./audit";
import { WorkflowError } from "./errors";
import type { SalesOrderInput, SalesOrderStatusInput } from "./validation";

export type SalesOrderLineDetail = {
  id: number;
  productId: number;
  productCode: string;
  productName: string;
  packetGrams: number;
  hsnCode: string;
  quantityPackets: number;
  unitPricePaise: number;
  discountPaise: number;
  lineTotalPaise: number;
  fulfilledPackets: number;
  invoicedPackets: number;
};

export type SalesOrderDetail = {
  id: number;
  orderNumber: string;
  customerId: number;
  customerCode: string;
  customerName: string;
  customerType: string;
  orderDate: string;
  requestedDate: string | null;
  status: string;
  totalAmountPaise: number;
  notes: string;
  salesmanName: string;
  approvedAt: string | null;
  createdAt: string;
  lines: SalesOrderLineDetail[];
};

export type SalesOrderSummary = Pick<
  SalesOrderDetail,
  "id" | "orderNumber" | "customerName" | "orderDate" | "requestedDate" | "status" | "totalAmountPaise"
>;

type SalesOrderRow = typeof salesOrders.$inferSelect;

function loadSalesOrderDetail(tx: WorkflowDb | WorkflowTransaction, order: SalesOrderRow): SalesOrderDetail {
  const customer = tx.select().from(customers).where(eq(customers.id, order.customerId)).get();
  const salesman = tx
    .select({ fullName: users.fullName })
    .from(users)
    .where(eq(users.id, order.salesmanUserId ?? order.createdByUserId))
    .get();
  const lines = tx
    .select({
      id: salesOrderItems.id,
      productId: salesOrderItems.productId,
      productCode: products.code,
      productName: products.name,
      packetGrams: products.packetGrams,
      hsnCode: salesOrderItems.hsnCode,
      quantityPackets: salesOrderItems.quantityPackets,
      unitPricePaise: salesOrderItems.unitPricePaise,
      discountPaise: salesOrderItems.discountPaise,
      lineTotalPaise: salesOrderItems.lineTotalPaise,
      fulfilledPackets: salesOrderItems.fulfilledPackets,
      invoicedPackets: salesOrderItems.invoicedPackets,
    })
    .from(salesOrderItems)
    .innerJoin(products, eq(salesOrderItems.productId, products.id))
    .where(eq(salesOrderItems.salesOrderId, order.id))
    .orderBy(asc(salesOrderItems.id))
    .all();

  return {
    id: order.id,
    orderNumber: order.orderNumber,
    customerId: order.customerId,
    customerCode: customer?.code ?? "",
    customerName: customer?.name ?? "Unknown customer",
    customerType: customer?.customerType ?? "retailer",
    orderDate: order.orderDate,
    requestedDate: order.requestedDate,
    status: order.status,
    totalAmountPaise: order.totalAmountPaise,
    notes: order.notes,
    salesmanName: salesman?.fullName ?? "Unknown user",
    approvedAt: order.approvedAt,
    createdAt: order.createdAt,
    lines,
  };
}

export function listSalesOrders(
  factoryId: number,
  filters: { status?: string; query?: string } = {},
): SalesOrderSummary[] {
  return getDb()
    .select({
      id: salesOrders.id,
      orderNumber: salesOrders.orderNumber,
      customerName: customers.name,
      orderDate: salesOrders.orderDate,
      requestedDate: salesOrders.requestedDate,
      status: salesOrders.status,
      totalAmountPaise: salesOrders.totalAmountPaise,
    })
    .from(salesOrders)
    .innerJoin(customers, eq(salesOrders.customerId, customers.id))
    .where(eq(salesOrders.factoryId, factoryId))
    .orderBy(sql`${salesOrders.orderDate} desc`, sql`${salesOrders.id} desc`)
    .all()
    .filter((row) => {
      if (filters.status && filters.status !== "all" && row.status !== filters.status) return false;
      const needle = filters.query?.trim().toLowerCase();
      if (!needle) return true;
      return `${row.orderNumber} ${row.customerName} ${row.status}`.toLowerCase().includes(needle);
    });
}

export function getSalesOrderDetail(factoryId: number, orderNumber: string): SalesOrderDetail | null {
  const db = getDb();
  const order = db
    .select()
    .from(salesOrders)
    .where(and(eq(salesOrders.factoryId, factoryId), eq(salesOrders.orderNumber, orderNumber)))
    .get();
  return order ? loadSalesOrderDetail(db, order) : null;
}

export function getSalesOptions(factoryId: number) {
  const db = getDb();
  return {
    customers: db
      .select({
        id: customers.id,
        code: customers.code,
        name: customers.name,
        customerType: customers.customerType,
        state: customers.state,
        creditTermsDays: customers.creditTermsDays,
        status: customers.status,
      })
      .from(customers)
      .where(eq(customers.factoryId, factoryId))
      .orderBy(asc(customers.name))
      .all(),
    products: db
      .select({
        id: products.id,
        code: products.code,
        name: products.name,
        packetGrams: products.packetGrams,
        hsnCode: products.hsnCode,
      })
      .from(products)
      .where(eq(products.factoryId, factoryId))
      .orderBy(asc(products.name))
      .all(),
  };
}

export function getSalesOverview(factoryId: number) {
  const rows = getDb()
    .select({
      status: salesOrders.status,
      total: sql<number>`count(*)`,
      value: sql<number>`coalesce(sum(${salesOrders.totalAmountPaise}), 0)`,
    })
    .from(salesOrders)
    .where(eq(salesOrders.factoryId, factoryId))
    .groupBy(salesOrders.status)
    .all();
  const byStatus = Object.fromEntries(rows.map((row) => [row.status, { count: row.total, value: row.value }]));
  return {
    byStatus,
    openOrders: rows
      .filter((row) => !["fulfilled", "cancelled", "rejected"].includes(row.status))
      .reduce((sum, row) => sum + row.total, 0),
    awaitingApproval: byStatus.submitted?.count ?? 0,
    inFulfilment: (byStatus.approved?.count ?? 0) + (byStatus.partially_fulfilled?.count ?? 0),
    pipelinePaise: rows
      .filter((row) => !["cancelled", "rejected"].includes(row.status))
      .reduce((sum, row) => sum + row.value, 0),
  };
}

export function createSalesOrder(actor: WorkflowActor, input: SalesOrderInput): SalesOrderDetail {
  requireActorPermission(actor, "orders:manage");
  return getDb().transaction((tx) => {
    const duplicate = tx
      .select({ id: salesOrders.id })
      .from(salesOrders)
      .where(and(eq(salesOrders.factoryId, actor.factoryId), eq(salesOrders.orderNumber, input.orderNumber)))
      .get();
    if (duplicate) {
      throw new WorkflowError(`Sales order ${input.orderNumber} already exists.`, "duplicate_order", 409);
    }

    const customer = tx
      .select()
      .from(customers)
      .where(and(eq(customers.id, input.customerId), eq(customers.factoryId, actor.factoryId)))
      .get();
    if (!customer) {
      throw new WorkflowError("Customer not found.", "not_found", 404);
    }
    if (customer.status !== "active") {
      throw new WorkflowError("Only active customers can receive sales orders.", "customer_inactive");
    }

    assertUniqueIds(input.lines, (line) => String(line.productId), "sales order line");
    const productIds = input.lines.map((line) => line.productId);
    const productRows = tx
      .select()
      .from(products)
      .where(and(eq(products.factoryId, actor.factoryId), inArray(products.id, productIds)))
      .all();
    const productsById = new Map(productRows.map((product) => [product.id, product]));
    if (productsById.size !== productIds.length) {
      throw new WorkflowError("One or more products are unavailable.", "not_found", 404);
    }

    let totalAmountPaise = 0;
    for (const line of input.lines) {
      const netUnitPaise = subtractPaise(line.unitPricePaise, line.discountPaise);
      totalAmountPaise += multiplyPaiseByInteger(netUnitPaise, line.quantityPackets);
    }

    const now = new Date().toISOString();
    const result = tx
      .insert(salesOrders)
      .values({
        factoryId: actor.factoryId,
        customerId: input.customerId,
        orderNumber: input.orderNumber,
        orderDate: input.orderDate,
        requestedDate: input.requestedDate || null,
        status: "draft",
        totalAmountPaise,
        notes: input.notes,
        salesmanUserId: actor.role === "salesman" ? actor.userId : null,
        createdByUserId: actor.userId,
        updatedAt: now,
      })
      .run();
    const orderId = Number(result.lastInsertRowid);

    for (const line of input.lines) {
      const product = productsById.get(line.productId);
      if (!product) continue;
      const netUnitPaise = subtractPaise(line.unitPricePaise, line.discountPaise);
      tx.insert(salesOrderItems)
        .values({
          salesOrderId: orderId,
          productId: line.productId,
          quantityPackets: line.quantityPackets,
          unitPricePaise: line.unitPricePaise,
          discountPaise: line.discountPaise,
          lineTotalPaise: multiplyPaiseByInteger(netUnitPaise, line.quantityPackets),
          hsnCode: product.hsnCode ?? "",
          updatedAt: now,
        })
        .run();
    }

    recordAudit(tx, actor, "SALES_ORDER_CREATED", "sales_order", orderId, {
      orderNumber: input.orderNumber,
      totalPaise: totalAmountPaise,
    });

    const order = tx.select().from(salesOrders).where(eq(salesOrders.id, orderId)).get();
    if (!order) throw new WorkflowError("Unable to load the sales order.", "load_failed", 500);
    return loadSalesOrderDetail(tx, order);
  });
}

export function updateSalesOrderStatus(
  actor: WorkflowActor,
  orderNumber: string,
  status: SalesOrderStatusInput,
): SalesOrderDetail {
  const permission = status === "approved" || status === "rejected" ? "orders:approve" : "orders:manage";
  requireActorPermission(actor, permission);

  return getDb().transaction((tx) => {
    const order = tx
      .select()
      .from(salesOrders)
      .where(and(eq(salesOrders.factoryId, actor.factoryId), eq(salesOrders.orderNumber, orderNumber)))
      .get();
    if (!order) throw new WorkflowError("Sales order not found.", "not_found", 404);

    const allowed: Record<SalesOrderStatusInput, string[]> = {
      submitted: ["draft"],
      approved: ["submitted", "confirmed"],
      rejected: ["submitted", "confirmed"],
      cancelled: ["draft", "submitted", "approved", "partially_fulfilled"],
    };
    if (!allowed[status].includes(order.status)) {
      throw new WorkflowError(`Cannot ${status} an order in ${order.status} state.`, "invalid_transition");
    }

    const now = new Date().toISOString();
    tx.update(salesOrders)
      .set({
        status,
        approvedByUserId: status === "approved" ? actor.userId : order.approvedByUserId,
        approvedAt: status === "approved" ? now : order.approvedAt,
        updatedAt: now,
      })
      .where(eq(salesOrders.id, order.id))
      .run();
    recordAudit(tx, actor, "SALES_ORDER_STATUS_CHANGED", "sales_order", order.id, {
      orderNumber,
      from: order.status,
      to: status,
    });

    const updated = tx.select().from(salesOrders).where(eq(salesOrders.id, order.id)).get();
    if (!updated) throw new WorkflowError("Unable to load the sales order.", "load_failed", 500);
    return loadSalesOrderDetail(tx, updated);
  });
}

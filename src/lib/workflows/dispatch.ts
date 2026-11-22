import "server-only";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import {
  assertDispatchable,
  assertSufficientStock,
  assertUniqueIds,
  createFulfilmentPlan,
} from "@/domain";
import { getDb } from "@/lib/db";
import {
  customers,
  dispatchItems,
  dispatches,
  finishedGoodPackets,
  finishedGoods,
  products,
  salesOrderItems,
  salesOrders,
} from "@/lib/db/schema";
import type { WorkflowActor } from "./context";
import { requireActorPermission } from "./context";
import type { WorkflowDb, WorkflowTransaction } from "./db";
import { stockItemKey } from "./db";
import { recordAudit } from "./audit";
import { WorkflowError } from "./errors";
import { loadStockLedger, postLedgerEntry } from "./ledger";
import { allocateDocumentNumber } from "./numbering";
import type { DispatchInput, DispatchStatusInput } from "./validation";

export type DispatchPlanLine = {
  salesOrderItemId: number;
  productName: string;
  productCode: string;
  orderedPackets: number;
  fulfilledPackets: number;
  availablePackets: number;
  fulfillablePackets: number;
  backorderPackets: number;
  isPartial: boolean;
};

export type DispatchPlan = {
  orderNumber: string;
  status: string;
  lines: DispatchPlanLine[];
};

export type DispatchSummary = {
  id: number;
  dispatchNumber: string;
  orderNumber: string | null;
  customerName: string;
  dispatchedAt: string;
  status: string;
  carrierName: string | null;
  trackingNumber: string | null;
};

export type DispatchDetail = DispatchSummary & {
  expectedDate: string | null;
  deliveredAt: string | null;
  notes: string;
  lines: {
    salesOrderItemId: number | null;
    productName: string;
    batchCode: string;
    packetCode: string;
    quantityPackets: number;
  }[];
};

type AvailablePacket = {
  packetId: number;
  finishedGoodId: number;
  quantityGrams: number;
  batchCode: string;
  packetCode: string;
};

function availablePacketsForProduct(
  tx: WorkflowDb | WorkflowTransaction,
  factoryId: number,
  productId: number,
): AvailablePacket[] {
  return tx
    .select({
      packetId: finishedGoodPackets.id,
      finishedGoodId: finishedGoods.id,
      quantityGrams: finishedGoodPackets.quantityGrams,
      batchCode: finishedGoods.batchCode,
      packetCode: finishedGoodPackets.packetCode,
    })
    .from(finishedGoodPackets)
    .innerJoin(finishedGoods, eq(finishedGoodPackets.finishedGoodId, finishedGoods.id))
    .where(
      and(
        eq(finishedGoodPackets.factoryId, factoryId),
        eq(finishedGoodPackets.status, "available"),
        eq(finishedGoods.productId, productId),
      ),
    )
    .orderBy(asc(finishedGoods.expiresOn), asc(finishedGoodPackets.id))
    .all();
}

function loadDispatchDetail(tx: WorkflowDb | WorkflowTransaction, dispatchId: number): DispatchDetail | null {
  const row = tx
    .select({
      id: dispatches.id,
      dispatchNumber: dispatches.dispatchNumber,
      orderNumber: salesOrders.orderNumber,
      customerName: customers.name,
      dispatchedAt: dispatches.dispatchedAt,
      expectedDate: dispatches.expectedDate,
      deliveredAt: dispatches.deliveredAt,
      status: dispatches.status,
      carrierName: dispatches.carrierName,
      trackingNumber: dispatches.trackingNumber,
      notes: dispatches.notes,
    })
    .from(dispatches)
    .innerJoin(customers, eq(dispatches.customerId, customers.id))
    .leftJoin(salesOrders, eq(dispatches.salesOrderId, salesOrders.id))
    .where(eq(dispatches.id, dispatchId))
    .get();
  if (!row) return null;

  const lines = tx
    .select({
      salesOrderItemId: dispatchItems.salesOrderItemId,
      productName: products.name,
      batchCode: finishedGoods.batchCode,
      packetCode: finishedGoodPackets.packetCode,
      quantityPackets: dispatchItems.quantityPackets,
    })
    .from(dispatchItems)
    .innerJoin(finishedGoodPackets, eq(dispatchItems.finishedGoodPacketId, finishedGoodPackets.id))
    .innerJoin(finishedGoods, eq(finishedGoodPackets.finishedGoodId, finishedGoods.id))
    .innerJoin(products, eq(finishedGoods.productId, products.id))
    .where(eq(dispatchItems.dispatchId, dispatchId))
    .orderBy(asc(dispatchItems.id))
    .all();

  return { ...row, lines };
}

export function getDispatchPlan(factoryId: number, orderNumber: string): DispatchPlan | null {
  const db = getDb();
  const order = db
    .select()
    .from(salesOrders)
    .where(and(eq(salesOrders.factoryId, factoryId), eq(salesOrders.orderNumber, orderNumber)))
    .get();
  if (!order) return null;

  const itemRows = db
    .select({
      id: salesOrderItems.id,
      quantityPackets: salesOrderItems.quantityPackets,
      fulfilledPackets: salesOrderItems.fulfilledPackets,
      productId: salesOrderItems.productId,
      productName: products.name,
      productCode: products.code,
    })
    .from(salesOrderItems)
    .innerJoin(products, eq(salesOrderItems.productId, products.id))
    .where(eq(salesOrderItems.salesOrderId, order.id))
    .orderBy(asc(salesOrderItems.id))
    .all();

  return {
    orderNumber: order.orderNumber,
    status: order.status,
    lines: itemRows.map((item) => {
      const plan = createFulfilmentPlan({
        orderNumber: order.orderNumber,
        orderedPackets: item.quantityPackets,
        availablePackets: availablePacketsForProduct(db, factoryId, item.productId).length,
        alreadyFulfilledPackets: item.fulfilledPackets,
      });
      return {
        salesOrderItemId: item.id,
        productName: item.productName,
        productCode: item.productCode,
        orderedPackets: item.quantityPackets,
        fulfilledPackets: item.fulfilledPackets,
        availablePackets: plan.availablePackets,
        fulfillablePackets: plan.fulfillablePackets,
        backorderPackets: plan.backorderPackets,
        isPartial: plan.isPartial,
      };
    }),
  };
}

export function listDispatches(factoryId: number, filters: { status?: string; query?: string } = {}): DispatchSummary[] {
  return getDb()
    .select({
      id: dispatches.id,
      dispatchNumber: dispatches.dispatchNumber,
      orderNumber: salesOrders.orderNumber,
      customerName: customers.name,
      dispatchedAt: dispatches.dispatchedAt,
      status: dispatches.status,
      carrierName: dispatches.carrierName,
      trackingNumber: dispatches.trackingNumber,
    })
    .from(dispatches)
    .innerJoin(customers, eq(dispatches.customerId, customers.id))
    .leftJoin(salesOrders, eq(dispatches.salesOrderId, salesOrders.id))
    .where(eq(dispatches.factoryId, factoryId))
    .orderBy(sql`${dispatches.dispatchedAt} desc`, sql`${dispatches.id} desc`)
    .all()
    .filter((row) => {
      if (filters.status && filters.status !== "all" && row.status !== filters.status) return false;
      const needle = filters.query?.trim().toLowerCase();
      if (!needle) return true;
      return `${row.dispatchNumber} ${row.orderNumber ?? ""} ${row.customerName}`.toLowerCase().includes(needle);
    });
}

export function getDispatchDetail(factoryId: number, dispatchNumber: string): DispatchDetail | null {
  const db = getDb();
  const row = db
    .select()
    .from(dispatches)
    .where(and(eq(dispatches.factoryId, factoryId), eq(dispatches.dispatchNumber, dispatchNumber)))
    .get();
  return row ? loadDispatchDetail(db, row.id) : null;
}

export function createDispatch(actor: WorkflowActor, input: DispatchInput): DispatchDetail {
  requireActorPermission(actor, "dispatch:manage");

  return getDb().transaction((tx) => {
    const order = tx
      .select()
      .from(salesOrders)
      .where(and(eq(salesOrders.factoryId, actor.factoryId), eq(salesOrders.orderNumber, input.salesOrderNumber)))
      .get();
    if (!order) throw new WorkflowError("Sales order not found.", "not_found", 404);
    if (!["approved", "partially_fulfilled"].includes(order.status)) {
      throw new WorkflowError(`Cannot dispatch an order in ${order.status} state.`, "invalid_transition");
    }

    assertUniqueIds(input.lines, (line) => String(line.salesOrderItemId), "dispatch line");
    const itemIds = input.lines.map((line) => line.salesOrderItemId);
    const itemRows = tx
      .select()
      .from(salesOrderItems)
      .where(and(eq(salesOrderItems.salesOrderId, order.id), inArray(salesOrderItems.id, itemIds)))
      .all();
    const itemsById = new Map(itemRows.map((item) => [item.id, item]));
    if (itemsById.size !== itemIds.length) {
      throw new WorkflowError("One or more order lines are unavailable.", "not_found", 404);
    }

    const allocatedPackets = new Set<number>();
    const packetsByFinishedGood = new Map<number, number>();
    const allocations: { itemId: number; packet: AvailablePacket }[] = [];

    for (const line of input.lines) {
      const item = itemsById.get(line.salesOrderItemId);
      if (!item) continue;
      const remaining = item.quantityPackets - item.fulfilledPackets;
      assertDispatchable(line.quantityPackets, remaining);
      const packets = availablePacketsForProduct(tx, actor.factoryId, item.productId).filter(
        (packet) => !allocatedPackets.has(packet.packetId),
      );
      assertDispatchable(line.quantityPackets, packets.length);
      for (const packet of packets.slice(0, line.quantityPackets)) {
        allocatedPackets.add(packet.packetId);
        allocations.push({ itemId: item.id, packet });
        packetsByFinishedGood.set(
          packet.finishedGoodId,
          (packetsByFinishedGood.get(packet.finishedGoodId) ?? 0) + 1,
        );
      }
    }

    for (const [finishedGoodId, packetCount] of Array.from(packetsByFinishedGood.entries())) {
      const ledger = loadStockLedger(tx, actor.factoryId, { type: "finished_good", id: finishedGoodId });
      assertSufficientStock(ledger, stockItemKey({ type: "finished_good", id: finishedGoodId }), packetCount);
    }

    const numbered = allocateDocumentNumber(tx, actor.factoryId, "DISPATCH", input.dispatchedAt);
    const now = new Date().toISOString();
    const deliveryStatus = input.status;
    const result = tx
      .insert(dispatches)
      .values({
        factoryId: actor.factoryId,
        salesOrderId: order.id,
        customerId: order.customerId,
        dispatchNumber: numbered.number,
        dispatchedAt: input.dispatchedAt,
        expectedDate: input.expectedDate || null,
        deliveredAt: deliveryStatus === "delivered" ? now : null,
        status: deliveryStatus,
        carrierName: input.carrierName,
        trackingNumber: input.trackingNumber,
        notes: input.notes,
        createdByUserId: actor.userId,
        updatedAt: now,
      })
      .run();
    const dispatchId = Number(result.lastInsertRowid);
    const packetIds = Array.from(allocatedPackets);

    tx.update(finishedGoodPackets)
      .set({ status: "reserved", updatedAt: now })
      .where(inArray(finishedGoodPackets.id, packetIds))
      .run();

    for (const allocation of allocations) {
      tx.insert(dispatchItems)
        .values({
          dispatchId,
          salesOrderItemId: allocation.itemId,
          finishedGoodPacketId: allocation.packet.packetId,
          quantityPackets: 1,
          updatedAt: now,
        })
        .run();
      tx.update(salesOrderItems)
        .set({
          fulfilledPackets: sql`${salesOrderItems.fulfilledPackets} + 1`,
          updatedAt: now,
        })
        .where(eq(salesOrderItems.id, allocation.itemId))
        .run();
    }

    for (const [finishedGoodId, packetCount] of Array.from(packetsByFinishedGood.entries())) {
      postLedgerEntry(tx, {
        factoryId: actor.factoryId,
        target: { type: "finished_good", id: finishedGoodId },
        transactionType: "dispatch",
        referenceType: "DISPATCH",
        referenceId: dispatchId,
        referenceNumber: numbered.number,
        baseUnit: "pieces",
        quantityDelta: -packetCount,
        occurredAt: input.dispatchedAt,
        createdByUserId: actor.userId,
      });
    }

    tx.update(finishedGoodPackets)
      .set({ status: "dispatched", updatedAt: now })
      .where(inArray(finishedGoodPackets.id, packetIds))
      .run();

    const itemsAfter = tx
      .select({ quantityPackets: salesOrderItems.quantityPackets, fulfilledPackets: salesOrderItems.fulfilledPackets })
      .from(salesOrderItems)
      .where(eq(salesOrderItems.salesOrderId, order.id))
      .all();
    const fullyFulfilled = itemsAfter.every((item) => item.fulfilledPackets >= item.quantityPackets);
    tx.update(salesOrders)
      .set({
        status: fullyFulfilled ? "fulfilled" : "partially_fulfilled",
        updatedAt: now,
      })
      .where(eq(salesOrders.id, order.id))
      .run();

    recordAudit(tx, actor, "DISPATCH_CREATED", "dispatch", dispatchId, {
      dispatchNumber: numbered.number,
      orderNumber: order.orderNumber,
      packetCount: packetIds.length,
    });

    const detail = loadDispatchDetail(tx, dispatchId);
    if (!detail) throw new WorkflowError("Unable to load the dispatch.", "load_failed", 500);
    return detail;
  });
}

export function updateDispatchStatus(actor: WorkflowActor, dispatchNumber: string, status: DispatchStatusInput) {
  requireActorPermission(actor, "dispatch:manage");
  return getDb().transaction((tx) => {
    const dispatch = tx
      .select()
      .from(dispatches)
      .where(and(eq(dispatches.factoryId, actor.factoryId), eq(dispatches.dispatchNumber, dispatchNumber)))
      .get();
    if (!dispatch) throw new WorkflowError("Dispatch not found.", "not_found", 404);
    const allowedTransitions: Record<string, readonly string[]> = {
      planned: ["in_transit", "cancelled"],
      in_transit: ["delivered", "cancelled"],
      delivered: [],
      cancelled: [],
    };
    if (!allowedTransitions[dispatch.status]?.includes(status)) {
      throw new WorkflowError(`A ${dispatch.status} dispatch cannot move to ${status}.`, "invalid_transition");
    }

    const now = new Date().toISOString();
    if (status === "cancelled") {
      const items = tx
        .select({
          packetId: finishedGoodPackets.id,
          finishedGoodId: finishedGoodPackets.finishedGoodId,
          salesOrderItemId: dispatchItems.salesOrderItemId,
          quantityPackets: dispatchItems.quantityPackets,
        })
        .from(dispatchItems)
        .innerJoin(finishedGoodPackets, eq(dispatchItems.finishedGoodPacketId, finishedGoodPackets.id))
        .where(eq(dispatchItems.dispatchId, dispatch.id))
        .all();
      const packetsByFinishedGood = new Map<number, number>();
      for (const item of items) {
        packetsByFinishedGood.set(
          item.finishedGoodId,
          (packetsByFinishedGood.get(item.finishedGoodId) ?? 0) + item.quantityPackets,
        );
        if (item.salesOrderItemId !== null) {
          tx.update(salesOrderItems)
            .set({
              fulfilledPackets: sql`${salesOrderItems.fulfilledPackets} - ${item.quantityPackets}`,
              updatedAt: now,
            })
            .where(eq(salesOrderItems.id, item.salesOrderItemId))
            .run();
        }
        tx.update(finishedGoodPackets)
          .set({ status: "available", updatedAt: now })
          .where(eq(finishedGoodPackets.id, item.packetId))
          .run();
      }
      for (const [finishedGoodId, packetCount] of Array.from(packetsByFinishedGood.entries())) {
        postLedgerEntry(tx, {
          factoryId: actor.factoryId,
          target: { type: "finished_good", id: finishedGoodId },
          transactionType: "dispatch_reversal",
          referenceType: "DISPATCH_CANCELLATION",
          referenceId: dispatch.id,
          referenceNumber: dispatchNumber,
          baseUnit: "pieces",
          quantityDelta: packetCount,
          occurredAt: now,
          createdByUserId: actor.userId,
          movementKey: `DISPATCH_CANCELLATION:${dispatchNumber}:finished_good:${finishedGoodId}`,
        });
      }
      if (dispatch.salesOrderId !== null) {
        const orderItems = tx
          .select({
            quantityPackets: salesOrderItems.quantityPackets,
            fulfilledPackets: salesOrderItems.fulfilledPackets,
          })
          .from(salesOrderItems)
          .where(eq(salesOrderItems.salesOrderId, dispatch.salesOrderId))
          .all();
        const anyFulfilled = orderItems.some((item) => item.fulfilledPackets > 0);
        const fullyFulfilled = orderItems.every((item) => item.fulfilledPackets >= item.quantityPackets);
        tx.update(salesOrders)
          .set({
            status: fullyFulfilled ? "fulfilled" : anyFulfilled ? "partially_fulfilled" : "approved",
            updatedAt: now,
          })
          .where(eq(salesOrders.id, dispatch.salesOrderId))
          .run();
      }
    }

    tx.update(dispatches)
      .set({
        status,
        deliveredAt: status === "delivered" ? dispatch.deliveredAt ?? now : status === "cancelled" ? null : dispatch.deliveredAt,
        updatedAt: now,
      })
      .where(eq(dispatches.id, dispatch.id))
      .run();
    recordAudit(tx, actor, "DISPATCH_STATUS_CHANGED", "dispatch", dispatch.id, {
      dispatchNumber,
      from: dispatch.status,
      to: status,
    });
    const detail = loadDispatchDetail(tx, dispatch.id);
    if (!detail) throw new WorkflowError("Unable to load the dispatch.", "load_failed", 500);
    return detail;
  });
}

export function getDispatchOverview(factoryId: number) {
  const rows = getDb()
    .select({ status: dispatches.status, total: sql<number>`count(*)` })
    .from(dispatches)
    .where(eq(dispatches.factoryId, factoryId))
    .groupBy(dispatches.status)
    .all();
  return {
    byStatus: Object.fromEntries(rows.map((row) => [row.status, row.total])),
    inTransit: rows.find((row) => row.status === "in_transit")?.total ?? 0,
    delivered: rows.find((row) => row.status === "delivered")?.total ?? 0,
  };
}

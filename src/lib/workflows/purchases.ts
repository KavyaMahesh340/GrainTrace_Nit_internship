import "server-only";
import { and, asc, desc, eq, like, or } from "drizzle-orm";
import {
  addPaise,
  assertNonNegativeInteger,
  createRational,
  multiplyPaiseByInteger,
} from "@/domain";
import { getDb } from "@/lib/db";
import {
  goodsReceiptItems,
  goodsReceipts,
  materialBatches,
  packagingBatches,
  packagingMaterials,
  purchaseOrderPackagingMaterials,
  purchaseOrderRawMaterials,
  purchaseOrders,
  rawMaterials,
  suppliers,
} from "@/lib/db/schema";
import { requireActorPermission, type WorkflowActor } from "./context";
import type { WorkflowTransaction } from "./db";
import { recordAudit } from "./audit";
import { postLedgerEntry } from "./ledger";
import { WorkflowError } from "./errors";
import {
  goodsReceiptInputSchema,
  purchaseOrderInputSchema,
  purchaseOrderStatusSchema,
  supplierInputSchema,
  type GoodsReceiptInput,
  type PurchaseOrderInput,
  type PurchaseOrderStatusInput,
  type SupplierInput,
} from "./validation";

export type PurchaseOrderStatus =
  | "draft"
  | "submitted"
  | "approved"
  | "partially_received"
  | "received"
  | "cancelled";

export type PurchaseOrderSummary = {
  id: number;
  orderNumber: string;
  supplierCode: string;
  supplierName: string;
  orderDate: string;
  expectedDate: string | null;
  status: PurchaseOrderStatus;
  totalAmountPaise: number;
  lineCount: number;
};

export type PurchaseOrderLineView = {
  id: number;
  kind: "raw" | "packaging";
  materialId: number;
  code: string;
  name: string;
  unit: string;
  quantity: number;
  unitCostPaise: number;
  lineTotalPaise: number;
  receivedQuantity: number;
};

export type PurchaseOrderDetail = PurchaseOrderSummary & {
  notes: null;
  lines: PurchaseOrderLineView[];
};

export type GoodsReceiptSummary = {
  id: number;
  receiptNumber: string;
  orderNumber: string;
  receivedAt: string;
  lineCount: number;
  acceptedQuantity: number;
  damagedQuantity: number;
  rejectedQuantity: number;
};

export function listSuppliers(factoryId: number) {
  return getDb()
    .select()
    .from(suppliers)
    .where(eq(suppliers.factoryId, factoryId))
    .orderBy(asc(suppliers.name))
    .all();
}

export function listPurchaseOrders(
  factoryId: number,
  filters: { status?: string; query?: string } = {},
): PurchaseOrderSummary[] {
  const conditions = [eq(purchaseOrders.factoryId, factoryId)];
  if (filters.status && filters.status !== "all") {
    conditions.push(eq(purchaseOrders.status, filters.status));
  }
  if (filters.query) {
    const pattern = `%${filters.query}%`;
    const search = or(like(purchaseOrders.orderNumber, pattern), like(suppliers.name, pattern));
    if (search) {
      conditions.push(search);
    }
  }

  const rows = getDb()
    .select({
      id: purchaseOrders.id,
      orderNumber: purchaseOrders.orderNumber,
      orderDate: purchaseOrders.orderDate,
      expectedDate: purchaseOrders.expectedDate,
      status: purchaseOrders.status,
      totalAmountPaise: purchaseOrders.totalAmountPaise,
      supplierCode: suppliers.code,
      supplierName: suppliers.name,
    })
    .from(purchaseOrders)
    .innerJoin(suppliers, eq(purchaseOrders.supplierId, suppliers.id))
    .where(and(...conditions))
    .orderBy(desc(purchaseOrders.orderDate), desc(purchaseOrders.id))
    .all();

  const counts = new Map<number, number>();
  for (const row of rows) {
    const rawCount = getDb()
      .select({ id: purchaseOrderRawMaterials.id })
      .from(purchaseOrderRawMaterials)
      .where(eq(purchaseOrderRawMaterials.purchaseOrderId, row.id))
      .all().length;
    const packagingCount = getDb()
      .select({ id: purchaseOrderPackagingMaterials.id })
      .from(purchaseOrderPackagingMaterials)
      .where(eq(purchaseOrderPackagingMaterials.purchaseOrderId, row.id))
      .all().length;
    counts.set(row.id, rawCount + packagingCount);
  }

  return rows.map((row) => ({
    ...row,
    status: row.status as PurchaseOrderStatus,
    lineCount: counts.get(row.id) ?? 0,
  }));
}

export function getPurchaseOrderDetail(factoryId: number, orderNumber: string): PurchaseOrderDetail | null {
  const order = getDb()
    .select({
      id: purchaseOrders.id,
      orderNumber: purchaseOrders.orderNumber,
      orderDate: purchaseOrders.orderDate,
      expectedDate: purchaseOrders.expectedDate,
      status: purchaseOrders.status,
      totalAmountPaise: purchaseOrders.totalAmountPaise,
      supplierCode: suppliers.code,
      supplierName: suppliers.name,
    })
    .from(purchaseOrders)
    .innerJoin(suppliers, eq(purchaseOrders.supplierId, suppliers.id))
    .where(and(eq(purchaseOrders.factoryId, factoryId), eq(purchaseOrders.orderNumber, orderNumber)))
    .get();

  if (!order) {
    return null;
  }

  const receiptLines = getDb()
    .select({
      rawLineId: goodsReceiptItems.purchaseOrderRawMaterialId,
      packagingLineId: goodsReceiptItems.purchaseOrderPackagingMaterialId,
      accepted: goodsReceiptItems.quantityGrams,
      acceptedUnits: goodsReceiptItems.quantityUnits,
    })
    .from(goodsReceiptItems)
    .innerJoin(goodsReceipts, eq(goodsReceiptItems.goodsReceiptId, goodsReceipts.id))
    .where(eq(goodsReceipts.purchaseOrderId, order.id))
    .all();

  const receivedByRawLine = new Map<number, number>();
  const receivedByPackagingLine = new Map<number, number>();
  for (const line of receiptLines) {
    if (line.rawLineId !== null) {
      receivedByRawLine.set(line.rawLineId, (receivedByRawLine.get(line.rawLineId) ?? 0) + (line.accepted ?? 0));
    }
    if (line.packagingLineId !== null) {
      receivedByPackagingLine.set(
        line.packagingLineId,
        (receivedByPackagingLine.get(line.packagingLineId) ?? 0) + (line.acceptedUnits ?? 0),
      );
    }
  }

  const rawLines = getDb()
    .select({
      id: purchaseOrderRawMaterials.id,
      materialId: rawMaterials.id,
      code: rawMaterials.code,
      name: rawMaterials.name,
      unit: rawMaterials.unitOfMeasure,
      quantity: purchaseOrderRawMaterials.quantityGrams,
      unitCostPaise: purchaseOrderRawMaterials.unitPricePaise,
      lineTotalPaise: purchaseOrderRawMaterials.lineTotalPaise,
    })
    .from(purchaseOrderRawMaterials)
    .innerJoin(rawMaterials, eq(purchaseOrderRawMaterials.rawMaterialId, rawMaterials.id))
    .where(eq(purchaseOrderRawMaterials.purchaseOrderId, order.id))
    .all()
    .map(
      (line): PurchaseOrderLineView => ({
        ...line,
        kind: "raw",
        receivedQuantity: receivedByRawLine.get(line.id) ?? 0,
      }),
    );

  const packagingLines = getDb()
    .select({
      id: purchaseOrderPackagingMaterials.id,
      materialId: packagingMaterials.id,
      code: packagingMaterials.code,
      name: packagingMaterials.name,
      unit: packagingMaterials.unitOfMeasure,
      quantity: purchaseOrderPackagingMaterials.quantityUnits,
      unitCostPaise: purchaseOrderPackagingMaterials.unitPricePaise,
      lineTotalPaise: purchaseOrderPackagingMaterials.lineTotalPaise,
    })
    .from(purchaseOrderPackagingMaterials)
    .innerJoin(packagingMaterials, eq(purchaseOrderPackagingMaterials.packagingMaterialId, packagingMaterials.id))
    .where(eq(purchaseOrderPackagingMaterials.purchaseOrderId, order.id))
    .all()
    .map(
      (line): PurchaseOrderLineView => ({
        ...line,
        kind: "packaging",
        receivedQuantity: receivedByPackagingLine.get(line.id) ?? 0,
      }),
    );

  return {
    ...order,
    status: order.status as PurchaseOrderStatus,
    notes: null,
    lineCount: rawLines.length + packagingLines.length,
    lines: [...rawLines, ...packagingLines],
  };
}

export function listGoodsReceipts(factoryId: number): GoodsReceiptSummary[] {
  const rows = getDb()
    .select({
      id: goodsReceipts.id,
      receiptNumber: goodsReceipts.receiptNumber,
      orderNumber: purchaseOrders.orderNumber,
      receivedAt: goodsReceipts.receivedAt,
    })
    .from(goodsReceipts)
    .innerJoin(purchaseOrders, eq(goodsReceipts.purchaseOrderId, purchaseOrders.id))
    .where(eq(goodsReceipts.factoryId, factoryId))
    .orderBy(desc(goodsReceipts.receivedAt), desc(goodsReceipts.id))
    .all();

  return rows.map((row) => {
    const lines = getDb()
      .select()
      .from(goodsReceiptItems)
      .where(eq(goodsReceiptItems.goodsReceiptId, row.id))
      .all();

    return {
      ...row,
      lineCount: lines.length,
      acceptedQuantity: lines.reduce(
        (sum, line) => sum + (line.quantityGrams ?? line.quantityUnits ?? 0),
        0,
      ),
      damagedQuantity: lines.reduce((sum, line) => sum + line.damagedQuantity, 0),
      rejectedQuantity: lines.reduce((sum, line) => sum + line.rejectedQuantity, 0),
    };
  });
}

export function createSupplier(actor: WorkflowActor, input: SupplierInput) {
  requireActorPermission(actor, "purchases:manage");
  const data = supplierInputSchema.parse(input);

  return getDb().transaction((tx) => {
    const existing = tx
      .select({ id: suppliers.id })
      .from(suppliers)
      .where(and(eq(suppliers.factoryId, actor.factoryId), eq(suppliers.code, data.code)))
      .get();
    if (existing) {
      throw new WorkflowError("A supplier with this code already exists.", "duplicate_supplier", 409);
    }

    const result = tx
      .insert(suppliers)
      .values({
        factoryId: actor.factoryId,
        code: data.code,
        name: data.name,
        contactName: data.contactName || null,
        email: data.email || null,
        phone: data.phone || null,
        addressLine1: data.addressLine1 || null,
        city: data.city || null,
        state: data.state || null,
        postalCode: data.postalCode || null,
        gstin: data.gstin || null,
      })
      .run();

    const supplierId = Number(result.lastInsertRowid);
    recordAudit(tx, actor, "supplier.created", "supplier", supplierId, { code: data.code });
    return { id: supplierId, code: data.code };
  });
}

export function createPurchaseOrder(actor: WorkflowActor, input: PurchaseOrderInput) {
  requireActorPermission(actor, "purchases:manage");
  const data = purchaseOrderInputSchema.parse(input);

  return getDb().transaction((tx) => {
    const supplier = tx
      .select({ id: suppliers.id })
      .from(suppliers)
      .where(and(eq(suppliers.id, data.supplierId), eq(suppliers.factoryId, actor.factoryId)))
      .get();
    if (!supplier) {
      throw new WorkflowError("Select a supplier from this factory.", "unknown_supplier");
    }

    const existing = tx
      .select({ id: purchaseOrders.id })
      .from(purchaseOrders)
      .where(and(eq(purchaseOrders.factoryId, actor.factoryId), eq(purchaseOrders.orderNumber, data.orderNumber)))
      .get();
    if (existing) {
      throw new WorkflowError("A purchase order with this number already exists.", "duplicate_order", 409);
    }

    const lineIds = data.lines.flatMap((line) => (line.sourceLineId === undefined ? [] : [line.sourceLineId]));
    if (new Set(lineIds).size !== lineIds.length) {
      throw new WorkflowError("Purchase order lines must be unique.", "duplicate_line");
    }

    let total = 0;
    for (const line of data.lines) {
      const lineTotal = multiplyPaiseByInteger(line.unitCostPaise, line.quantity);
      total = addPaise(total, lineTotal);
      if (line.kind === "raw") {
        assertFactoryMaterial(tx, rawMaterials, actor.factoryId, line.rawMaterialId, "raw material");
      } else {
        assertFactoryMaterial(tx, packagingMaterials, actor.factoryId, line.packagingMaterialId, "packaging material");
      }
    }

    const orderResult = tx
      .insert(purchaseOrders)
      .values({
        factoryId: actor.factoryId,
        supplierId: data.supplierId,
        orderNumber: data.orderNumber,
        orderDate: data.orderDate,
        expectedDate: data.expectedDate || null,
        status: "draft",
        totalAmountPaise: total,
        createdByUserId: actor.userId,
      })
      .run();
    const orderId = Number(orderResult.lastInsertRowid);

    for (const line of data.lines) {
      const lineTotal = multiplyPaiseByInteger(line.unitCostPaise, line.quantity);
      if (line.kind === "raw") {
        tx.insert(purchaseOrderRawMaterials)
          .values({
            purchaseOrderId: orderId,
            rawMaterialId: line.rawMaterialId,
            quantityGrams: line.quantity,
            unitPricePaise: line.unitCostPaise,
            lineTotalPaise: lineTotal,
          })
          .run();
      } else {
        tx.insert(purchaseOrderPackagingMaterials)
          .values({
            purchaseOrderId: orderId,
            packagingMaterialId: line.packagingMaterialId,
            quantityUnits: line.quantity,
            unitPricePaise: line.unitCostPaise,
            lineTotalPaise: lineTotal,
          })
          .run();
      }
    }

    recordAudit(tx, actor, "purchase_order.created", "purchase_order", orderId, {
      orderNumber: data.orderNumber,
      totalPaise: total,
    });
    return { id: orderId, orderNumber: data.orderNumber };
  });
}

export function updatePurchaseOrderStatus(actor: WorkflowActor, orderNumber: string, input: PurchaseOrderStatusInput) {
  requireActorPermission(actor, "purchases:manage");
  const status = purchaseOrderStatusSchema.parse(input);

  return getDb().transaction((tx) => {
    const order = tx
      .select()
      .from(purchaseOrders)
      .where(and(eq(purchaseOrders.factoryId, actor.factoryId), eq(purchaseOrders.orderNumber, orderNumber)))
      .get();
    if (!order) {
      throw new WorkflowError("Purchase order not found.", "unknown_order", 404);
    }

    const current = order.status as PurchaseOrderStatus;
    const allowed: Record<string, PurchaseOrderStatus[]> = {
      draft: ["submitted", "cancelled"],
      submitted: ["approved", "cancelled"],
      approved: ["cancelled"],
      partially_received: [],
      received: [],
      cancelled: [],
    };
    if (!allowed[current]?.includes(status)) {
      throw new WorkflowError(`Cannot change status from ${current} to ${status}.`, "invalid_transition");
    }

    if (status === "cancelled") {
      const receipts = tx
        .select({ id: goodsReceipts.id })
        .from(goodsReceipts)
        .where(eq(goodsReceipts.purchaseOrderId, order.id))
        .all();
      if (receipts.length > 0) {
        throw new WorkflowError("A received order cannot be cancelled.", "invalid_transition");
      }
    }

    tx.update(purchaseOrders)
      .set({
        status,
        approvedByUserId: status === "approved" ? actor.userId : order.approvedByUserId,
        approvedAt: status === "approved" ? new Date().toISOString() : order.approvedAt,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(purchaseOrders.id, order.id))
      .run();

    recordAudit(tx, actor, "purchase_order.status", "purchase_order", order.id, {
      orderNumber,
      from: current,
      to: status,
    });
    return { orderNumber, status };
  });
}

export function createGoodsReceipt(actor: WorkflowActor, input: GoodsReceiptInput) {
  requireActorPermission(actor, "purchases:manage");
  const data = goodsReceiptInputSchema.parse(input);

  return getDb().transaction((tx) => {
    const existingReceipt = tx
      .select({ id: goodsReceipts.id })
      .from(goodsReceipts)
      .where(and(eq(goodsReceipts.factoryId, actor.factoryId), eq(goodsReceipts.receiptNumber, data.receiptNumber)))
      .get();
    if (existingReceipt) {
      throw new WorkflowError("A goods receipt with this number already exists.", "duplicate_receipt", 409);
    }

    const order = tx
      .select()
      .from(purchaseOrders)
      .where(and(eq(purchaseOrders.factoryId, actor.factoryId), eq(purchaseOrders.id, data.purchaseOrderId)))
      .get();
    if (!order) {
      throw new WorkflowError("Purchase order not found.", "unknown_order", 404);
    }
    if (order.status !== "approved" && order.status !== "partially_received") {
      throw new WorkflowError("Only approved purchase orders can receive goods.", "invalid_order_status");
    }

    const rawLines = tx
      .select()
      .from(purchaseOrderRawMaterials)
      .where(eq(purchaseOrderRawMaterials.purchaseOrderId, order.id))
      .all();
    const packagingLines = tx
      .select()
      .from(purchaseOrderPackagingMaterials)
      .where(eq(purchaseOrderPackagingMaterials.purchaseOrderId, order.id))
      .all();

    const previous = tx
      .select({
        rawLineId: goodsReceiptItems.purchaseOrderRawMaterialId,
        packagingLineId: goodsReceiptItems.purchaseOrderPackagingMaterialId,
        accepted: goodsReceiptItems.quantityGrams,
        acceptedUnits: goodsReceiptItems.quantityUnits,
        damaged: goodsReceiptItems.damagedQuantity,
        rejected: goodsReceiptItems.rejectedQuantity,
      })
      .from(goodsReceiptItems)
      .innerJoin(goodsReceipts, eq(goodsReceiptItems.goodsReceiptId, goodsReceipts.id))
      .where(eq(goodsReceipts.purchaseOrderId, order.id))
      .all();

    const deliveredByRaw = new Map<number, number>();
    const deliveredByPackaging = new Map<number, number>();
    for (const line of previous) {
      if (line.rawLineId !== null) {
        const delivered = (line.accepted ?? 0) + line.damaged + line.rejected;
        deliveredByRaw.set(line.rawLineId, (deliveredByRaw.get(line.rawLineId) ?? 0) + delivered);
      }
      if (line.packagingLineId !== null) {
        const delivered = (line.acceptedUnits ?? 0) + line.damaged + line.rejected;
        deliveredByPackaging.set(line.packagingLineId, (deliveredByPackaging.get(line.packagingLineId) ?? 0) + delivered);
      }
    }

    const sourceLineKeys = data.lines.map((line) => `${line.kind}:${line.sourceLineId}`);
    if (new Set(sourceLineKeys).size !== sourceLineKeys.length) {
      throw new WorkflowError("A purchase order line can be received only once per receipt.", "duplicate_line");
    }

    const receiptResult = tx
      .insert(goodsReceipts)
      .values({
        factoryId: actor.factoryId,
        purchaseOrderId: order.id,
        receiptNumber: data.receiptNumber,
        receivedAt: data.receivedAt,
        receivedByUserId: actor.userId,
        notes: data.notes || null,
      })
      .run();
    const receiptId = Number(receiptResult.lastInsertRowid);

    for (const line of data.lines) {
      const totalQuantity = line.acceptedQuantity + line.damagedQuantity + line.rejectedQuantity;
      assertNonNegativeInteger(totalQuantity, "delivered quantity");

      let material: typeof rawMaterials.$inferSelect | typeof packagingMaterials.$inferSelect;
      let orderedQuantity: number;
      let alreadyDelivered: number;

      if (line.kind === "raw") {
        const orderLine = rawLines.find((candidate) => candidate.id === line.sourceLineId);
        if (!orderLine) {
          throw new WorkflowError("Receipt references an unknown raw material line.", "unknown_line");
        }
        const materialRow = tx
          .select()
          .from(rawMaterials)
          .where(and(eq(rawMaterials.id, orderLine.rawMaterialId), eq(rawMaterials.factoryId, actor.factoryId)))
          .get();
        if (!materialRow) {
          throw new WorkflowError("Raw material not found.", "unknown_material");
        }
        material = materialRow;
        orderedQuantity = orderLine.quantityGrams;
        alreadyDelivered = deliveredByRaw.get(orderLine.id) ?? 0;
      } else {
        const orderLine = packagingLines.find((candidate) => candidate.id === line.sourceLineId);
        if (!orderLine) {
          throw new WorkflowError("Receipt references an unknown packaging line.", "unknown_line");
        }
        const materialRow = tx
          .select()
          .from(packagingMaterials)
          .where(
            and(eq(packagingMaterials.id, orderLine.packagingMaterialId), eq(packagingMaterials.factoryId, actor.factoryId)),
          )
          .get();
        if (!materialRow) {
          throw new WorkflowError("Packaging material not found.", "unknown_material");
        }
        material = materialRow;
        orderedQuantity = orderLine.quantityUnits;
        alreadyDelivered = deliveredByPackaging.get(orderLine.id) ?? 0;
      }

      if (alreadyDelivered + totalQuantity > orderedQuantity) {
        throw new WorkflowError(
          `Cannot receive more than the ordered quantity for ${material.code}.`,
          "over_receipt",
        );
      }

      const lineTotal = multiplyPaiseByInteger(line.unitCostPaise, line.acceptedQuantity);

      const itemResult = tx
        .insert(goodsReceiptItems)
        .values({
          goodsReceiptId: receiptId,
          rawMaterialId: line.kind === "raw" ? material.id : null,
          packagingMaterialId: line.kind === "packaging" ? material.id : null,
          purchaseOrderRawMaterialId: line.kind === "raw" ? line.sourceLineId : null,
          purchaseOrderPackagingMaterialId: line.kind === "packaging" ? line.sourceLineId : null,
          quantityGrams: line.kind === "raw" ? line.acceptedQuantity : null,
          quantityUnits: line.kind === "packaging" ? line.acceptedQuantity : null,
          damagedQuantity: line.damagedQuantity,
          rejectedQuantity: line.rejectedQuantity,
          lotCode: line.lotCode,
          expiresAt: line.expiresAt || null,
          unitPricePaise: line.unitCostPaise,
          lineTotalPaise: lineTotal,
        })
        .run();
      const receiptItemId = Number(itemResult.lastInsertRowid);

      let target: { type: "raw" | "packaging"; id: number };
      if (line.kind === "raw") {
        assertBatchCodeAvailable(tx, materialBatches, actor.factoryId, line.lotCode);
        const batchResult = tx
          .insert(materialBatches)
          .values({
            factoryId: actor.factoryId,
            rawMaterialId: material.id,
            goodsReceiptItemId: receiptItemId,
            supplierId: order.supplierId,
            batchCode: line.lotCode,
            receivedAt: data.receivedAt,
            quantityGrams: line.acceptedQuantity,
            availableGrams: line.acceptedQuantity,
            expiresAt: line.expiresAt || null,
          })
          .run();
        target = { type: "raw", id: Number(batchResult.lastInsertRowid) };
      } else {
        assertBatchCodeAvailable(tx, packagingBatches, actor.factoryId, line.lotCode);
        const batchResult = tx
          .insert(packagingBatches)
          .values({
            factoryId: actor.factoryId,
            packagingMaterialId: material.id,
            goodsReceiptItemId: receiptItemId,
            supplierId: order.supplierId,
            batchCode: line.lotCode,
            receivedAt: data.receivedAt,
            quantityUnits: line.acceptedQuantity,
            availableUnits: line.acceptedQuantity,
            expiresAt: line.expiresAt || null,
          })
          .run();
        target = { type: "packaging", id: Number(batchResult.lastInsertRowid) };
      }

      postLedgerEntry(tx, {
        factoryId: actor.factoryId,
        target,
        transactionType: "receipt",
        referenceType: "GOODS_RECEIPT",
        referenceId: receiptId,
        referenceNumber: data.receiptNumber,
        baseUnit: line.kind === "raw" ? "grams" : "pieces",
        quantityDelta: line.acceptedQuantity,
        occurredAt: data.receivedAt,
        createdByUserId: actor.userId,
        unitCost: createRational(lineTotal, line.acceptedQuantity),
      });
    }

    const allReceiptLines = tx
      .select({
        rawLineId: goodsReceiptItems.purchaseOrderRawMaterialId,
        packagingLineId: goodsReceiptItems.purchaseOrderPackagingMaterialId,
        accepted: goodsReceiptItems.quantityGrams,
        acceptedUnits: goodsReceiptItems.quantityUnits,
      })
      .from(goodsReceiptItems)
      .innerJoin(goodsReceipts, eq(goodsReceiptItems.goodsReceiptId, goodsReceipts.id))
      .where(eq(goodsReceipts.purchaseOrderId, order.id))
      .all();

    const acceptedByRaw = new Map<number, number>();
    const acceptedByPackaging = new Map<number, number>();
    for (const line of allReceiptLines) {
      if (line.rawLineId !== null) {
        acceptedByRaw.set(line.rawLineId, (acceptedByRaw.get(line.rawLineId) ?? 0) + (line.accepted ?? 0));
      }
      if (line.packagingLineId !== null) {
        acceptedByPackaging.set(
          line.packagingLineId,
          (acceptedByPackaging.get(line.packagingLineId) ?? 0) + (line.acceptedUnits ?? 0),
        );
      }
    }

    const fullyReceived =
      rawLines.every((line) => (acceptedByRaw.get(line.id) ?? 0) >= line.quantityGrams) &&
      packagingLines.every((line) => (acceptedByPackaging.get(line.id) ?? 0) >= line.quantityUnits);

    tx.update(purchaseOrders)
      .set({
        status: fullyReceived ? "received" : "partially_received",
        updatedAt: new Date().toISOString(),
      })
      .where(eq(purchaseOrders.id, order.id))
      .run();

    recordAudit(tx, actor, "goods_receipt.posted", "goods_receipt", receiptId, {
      receiptNumber: data.receiptNumber,
      orderNumber: order.orderNumber,
      lines: data.lines.length,
    });

    return { id: receiptId, receiptNumber: data.receiptNumber, status: fullyReceived ? "received" : "partially_received" };
  });
}

function assertFactoryMaterial(
  tx: WorkflowTransaction,
  table: typeof rawMaterials | typeof packagingMaterials,
  factoryId: number,
  materialId: number,
  label: string,
) {
  const row = tx.select({ id: table.id }).from(table).where(and(eq(table.id, materialId), eq(table.factoryId, factoryId))).get();
  if (!row) {
    throw new WorkflowError(`Unknown ${label}.`, "unknown_material");
  }
}

function assertBatchCodeAvailable(
  tx: WorkflowTransaction,
  table: typeof materialBatches | typeof packagingBatches,
  factoryId: number,
  batchCode: string,
) {
  const existing = tx
    .select({ id: table.id })
    .from(table)
    .where(and(eq(table.factoryId, factoryId), eq(table.batchCode, batchCode)))
    .get();
  if (existing) {
    throw new WorkflowError("A material batch with this lot code already exists.", "duplicate_batch", 409);
  }
}

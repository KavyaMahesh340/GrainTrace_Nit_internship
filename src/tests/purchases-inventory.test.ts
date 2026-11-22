import { and, eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { permissionsFor, type RoleName } from "@/lib/auth/permissions";
import { materialBatches, packagingMaterials, rawMaterials, stockLedger, suppliers, users } from "@/lib/db/schema";
import { WorkflowAuthorizationError, type WorkflowActor } from "@/lib/workflows/context";
import {
  createInventoryAdjustment,
  getInventoryDetail,
  listInventory,
} from "@/lib/workflows/inventory";
import {
  createGoodsReceipt,
  createPurchaseOrder,
  createSupplier,
  getPurchaseOrderDetail,
  listGoodsReceipts,
  listPurchaseOrders,
  updatePurchaseOrderStatus,
} from "@/lib/workflows/purchases";
import type { SupplierInput } from "@/lib/workflows/validation";
import { prepareDatabase } from "./database";

const db = prepareDatabase();

function suffix() {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`.toUpperCase();
}

function actorFor(email: string, role: RoleName): WorkflowActor {
  const user = db.select().from(users).where(eq(users.email, email)).get();
  if (!user) {
    throw new Error(`Missing seeded user ${email}.`);
  }
  return {
    userId: user.id,
    factoryId: user.factoryId,
    email: user.email,
    role,
    permissions: permissionsFor(role),
  };
}

describe("phase 4 purchasing and inventory workflows", () => {
  it("moves a purchase order through approval, receipt, ledger posting, and adjustment", () => {
    const owner = actorFor("owner@graintrace.local", "owner");
    const production = actorFor("production@graintrace.local", "production");
    const salesman = actorFor("salesman@graintrace.local", "salesman");
    const id = suffix();

    const wheat = db.select().from(rawMaterials).where(eq(rawMaterials.code, "RM-WHEAT")).get();
    const pouch = db
      .select()
      .from(packagingMaterials)
      .where(eq(packagingMaterials.code, "PKG-POUCH-500"))
      .get();
    if (!wheat || !pouch) {
      throw new Error("Seeded materials are missing.");
    }

    const supplierCode = `SUPP-${id}`;
    createSupplier(owner, { code: supplierCode, name: `Test Supplier ${id}` } as SupplierInput);
    const supplierRow = db
      .select()
      .from(suppliers)
      .where(eq(suppliers.code, supplierCode))
      .get();
    expect(supplierRow).toBeDefined();
    if (!supplierRow) return;

    const orderNumber = `PO-${id}`;
    const created = createPurchaseOrder(owner, {
      orderNumber,
      supplierId: supplierRow.id,
      orderDate: "2026-02-01T00:00:00.000Z",
      expectedDate: "2026-02-10T00:00:00.000Z",
      lines: [
        { kind: "raw", rawMaterialId: wheat.id, quantity: 100000, unitCostPaise: 500 },
        { kind: "packaging", packagingMaterialId: pouch.id, quantity: 1000, unitCostPaise: 250 },
      ],
    });
    expect(created.orderNumber).toBe(orderNumber);

    const listed = listPurchaseOrders(owner.factoryId, { query: orderNumber });
    expect(listed).toHaveLength(1);
    expect(listed[0].status).toBe("draft");
    expect(listed[0].lineCount).toBe(2);

    const detail = getPurchaseOrderDetail(owner.factoryId, orderNumber);
    expect(detail?.lines).toHaveLength(2);
    const rawLine = detail?.lines.find((line) => line.kind === "raw");
    const packagingLine = detail?.lines.find((line) => line.kind === "packaging");
    if (!rawLine || !packagingLine) {
      throw new Error("Purchase order lines are missing.");
    }

    expect(() =>
      createGoodsReceipt(owner, {
        receiptNumber: `GR-${id}-EARLY`,
        purchaseOrderId: created.id,
        receivedAt: "2026-02-03T00:00:00.000Z",
        notes: "",
        lines: [
          {
            sourceLineId: rawLine.id,
            kind: "raw",
            acceptedQuantity: 1000,
            damagedQuantity: 0,
            rejectedQuantity: 0,
            lotCode: `LOT-${id}-EARLY`,
            unitCostPaise: 500,
          },
        ],
      }),
    ).toThrow(/approved purchase orders/i);

    expect(() =>
      createPurchaseOrder(salesman, {
        orderNumber: `PO-DENIED-${id}`,
        supplierId: listed[0].id,
        orderDate: "2026-02-01T00:00:00.000Z",
        lines: [{ kind: "raw", rawMaterialId: wheat.id, quantity: 1, unitCostPaise: 1 }],
      }),
    ).toThrow(WorkflowAuthorizationError);

    updatePurchaseOrderStatus(owner, orderNumber, "submitted");
    updatePurchaseOrderStatus(owner, orderNumber, "approved");

    const receiptNumber = `GR-${id}-1`;
    const firstReceipt = createGoodsReceipt(owner, {
      receiptNumber,
      purchaseOrderId: created.id,
      receivedAt: "2026-02-03T00:00:00.000Z",
      notes: "",
      lines: [
        {
          sourceLineId: rawLine.id,
          kind: "raw",
          acceptedQuantity: 40000,
          damagedQuantity: 100,
          rejectedQuantity: 50,
          lotCode: `LOT-${id}-R`,
          expiresAt: "2026-12-31T00:00:00.000Z",
          unitCostPaise: 500,
        },
        {
          sourceLineId: packagingLine.id,
          kind: "packaging",
          acceptedQuantity: 1000,
          damagedQuantity: 0,
          rejectedQuantity: 0,
          lotCode: `LOT-${id}-P`,
          unitCostPaise: 250,
        },
      ],
    });
    expect(firstReceipt.status).toBe("partially_received");
    const firstSummary = listGoodsReceipts(owner.factoryId).find(
      (receipt) => receipt.receiptNumber === receiptNumber,
    );
    expect(firstSummary?.damagedQuantity).toBe(100);
    expect(firstSummary?.rejectedQuantity).toBe(50);

    expect(() =>
      createGoodsReceipt(owner, {
        receiptNumber,
        purchaseOrderId: created.id,
        receivedAt: "2026-02-03T00:00:00.000Z",
        notes: "",
        lines: [
          {
            sourceLineId: rawLine.id,
            kind: "raw",
            acceptedQuantity: 1,
            damagedQuantity: 0,
            rejectedQuantity: 0,
            lotCode: `LOT-${id}-DUP`,
            unitCostPaise: 500,
          },
        ],
      }),
    ).toThrow(/already exists/i);

    expect(() =>
      createGoodsReceipt(owner, {
        receiptNumber: `GR-${id}-OVER`,
        purchaseOrderId: created.id,
        receivedAt: "2026-02-04T00:00:00.000Z",
        notes: "",
        lines: [
          {
            sourceLineId: rawLine.id,
            kind: "raw",
            acceptedQuantity: 70000,
            damagedQuantity: 0,
            rejectedQuantity: 0,
            lotCode: `LOT-${id}-OVER`,
            unitCostPaise: 500,
          },
        ],
      }),
    ).toThrow(/more than the ordered quantity/i);

    const rawBatch = db
      .select()
      .from(materialBatches)
      .where(and(eq(materialBatches.factoryId, owner.factoryId), eq(materialBatches.batchCode, `LOT-${id}-R`)))
      .get();
    expect(rawBatch).toBeDefined();
    if (!rawBatch) return;

    const rawStockBefore = listInventory(owner.factoryId, { category: "raw", query: "RM-WHEAT" })[0];
    expect(rawStockBefore.currentStock).toBe(40000);
    expect(rawStockBefore.averageCostPaise).toBe(500);
    expect(rawStockBefore.lastMovementSource).toBe(receiptNumber);

    const movements = db
      .select()
      .from(stockLedger)
      .where(eq(stockLedger.factoryId, owner.factoryId))
      .all()
      .filter((movement) => movement.materialBatchId === rawBatch.id);
    expect(movements).toHaveLength(1);
    expect(movements[0].referenceNumber).toBe(receiptNumber);
    expect(movements[0].baseUnit).toBe("grams");

    const secondReceipt = createGoodsReceipt(owner, {
      receiptNumber: `GR-${id}-2`,
      purchaseOrderId: created.id,
        receivedAt: "2026-02-05T00:00:00.000Z",
        notes: "",
        lines: [
        {
          sourceLineId: rawLine.id,
          kind: "raw",
          acceptedQuantity: 59850,
          damagedQuantity: 0,
          rejectedQuantity: 0,
          lotCode: `LOT-${id}-R2`,
          unitCostPaise: 550,
        },
      ],
    });
    expect(secondReceipt.status).toBe("partially_received");
    expect(listPurchaseOrders(owner.factoryId, { status: "partially_received", query: orderNumber })).toHaveLength(1);

    const blended = listInventory(owner.factoryId, { category: "raw", query: "RM-WHEAT" })[0];
    expect(blended.currentStock).toBe(99850);
    expect(blended.averageCostPaise).toBe(530);
    expect(listGoodsReceipts(owner.factoryId).some((receipt) => receipt.receiptNumber === receiptNumber)).toBe(true);

    expect(() =>
      createInventoryAdjustment(owner, {
        adjustmentNumber: `ADJ-${id}-NEG`,
        targetType: "raw",
        targetId: rawBatch.id,
        direction: "decrement",
        baseUnit: "grams",
        quantity: 1000000,
        reason: "damage",
        notes: "",
        occurredAt: "2026-02-06T00:00:00.000Z",
      }),
    ).toThrow(/cannot become negative/i);

    expect(() =>
      createInventoryAdjustment(owner, {
        adjustmentNumber: `ADJ-${id}-NOCOST`,
        targetType: "raw",
        targetId: rawBatch.id,
        direction: "increment",
        baseUnit: "grams",
        quantity: 10,
        reason: "found_stock",
        notes: "",
        occurredAt: "2026-02-06T00:00:00.000Z",
      }),
    ).toThrow(/unit cost/i);

    const adjustment = createInventoryAdjustment(production, {
      adjustmentNumber: `ADJ-${id}-OK`,
      targetType: "raw",
      targetId: rawBatch.id,
      direction: "decrement",
      baseUnit: "grams",
      quantity: 10000,
      reason: "damage",
      notes: "Handling loss",
      occurredAt: "2026-02-06T00:00:00.000Z",
    });
    expect(adjustment.adjustmentNumber).toBe(`ADJ-${id}-OK`);

    const adjusted = listInventory(owner.factoryId, { category: "raw", query: "RM-WHEAT" })[0];
    expect(adjusted.currentStock).toBe(89850);
    expect(adjusted.averageCostPaise).toBe(533);

    expect(() =>
      createInventoryAdjustment(salesman, {
        adjustmentNumber: `ADJ-${id}-DENIED`,
        targetType: "raw",
        targetId: rawBatch.id,
        direction: "decrement",
        baseUnit: "grams",
        quantity: 1,
        reason: "correction",
        notes: "",
        occurredAt: "2026-02-06T00:00:00.000Z",
      }),
    ).toThrow(WorkflowAuthorizationError);

    const detailAfter = getInventoryDetail(owner.factoryId, `raw:${wheat.id}`);
    expect(detailAfter?.batches.length).toBe(2);
    expect(detailAfter?.movements.length).toBe(3);
    expect(detailAfter?.movements[0].sourceType).toBe("STOCK_ADJUSTMENT");
    expect(listInventory(owner.factoryId, { category: "raw", status: "healthy", query: "RM-WHEAT" })).toHaveLength(1);
  });
});

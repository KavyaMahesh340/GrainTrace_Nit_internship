import { and, eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { permissionsFor, type RoleName } from "@/lib/auth/permissions";
import {
  finishedGoodPackets,
  finishedGoods,
  materialBatches,
  packagingBatches,
  packagingMaterials,
  productionCostSnapshots,
  productionRuns,
  rawMaterials,
  stockLedger,
  suppliers,
  users,
} from "@/lib/db/schema";
import { WorkflowAuthorizationError, type WorkflowActor } from "@/lib/workflows/context";
import { getBatchTrace, listBatchDnaRuns } from "@/lib/workflows/batch-dna";
import {
  completeProductionRun,
  createProductionRun,
  getProductionOptions,
  getProductionRunDetail,
  planProductionRun,
  postProductionRun,
  updateProductionRunStatus,
} from "@/lib/workflows/production";
import {
  createGoodsReceipt,
  createPurchaseOrder,
  createSupplier,
  getPurchaseOrderDetail,
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

type StockedBatches = {
  wheat: number;
  salt: number;
  pouch: number;
};

function stockMaterials(owner: WorkflowActor, id: string): StockedBatches {
  const wheat = db.select().from(rawMaterials).where(eq(rawMaterials.code, "RM-WHEAT")).get();
  const salt = db.select().from(rawMaterials).where(eq(rawMaterials.code, "RM-SALT")).get();
  const pouch = db
    .select()
    .from(packagingMaterials)
    .where(eq(packagingMaterials.code, "PKG-POUCH-500"))
    .get();
  if (!wheat || !salt || !pouch) {
    throw new Error("Seeded materials are missing.");
  }

  const supplierCode = `SUPP-${id}`;
  createSupplier(owner, { code: supplierCode, name: `Production Supplier ${id}` } as SupplierInput);
  const supplier = db.select().from(suppliers).where(eq(suppliers.code, supplierCode)).get();
  if (!supplier) throw new Error("Supplier was not created.");

  const orderNumber = `PO-PROD-${id}`;
  const order = createPurchaseOrder(owner, {
    orderNumber,
    supplierId: supplier.id,
    orderDate: "2026-03-01T00:00:00.000Z",
    expectedDate: "2026-03-05T00:00:00.000Z",
    lines: [
      { kind: "raw", rawMaterialId: wheat.id, quantity: 300000, unitCostPaise: 500 },
      { kind: "raw", rawMaterialId: salt.id, quantity: 10000, unitCostPaise: 50 },
      { kind: "packaging", packagingMaterialId: pouch.id, quantity: 1000, unitCostPaise: 250 },
    ],
  });
  updatePurchaseOrderStatus(owner, orderNumber, "submitted");
  updatePurchaseOrderStatus(owner, orderNumber, "approved");

  const detail = getPurchaseOrderDetail(owner.factoryId, orderNumber);
  if (!detail) throw new Error("Purchase order detail is missing.");
  const wheatLine = detail.lines.find((line) => line.kind === "raw" && line.materialId === wheat.id);
  const saltLine = detail.lines.find((line) => line.kind === "raw" && line.materialId === salt.id);
  const pouchLine = detail.lines.find((line) => line.kind === "packaging" && line.materialId === pouch.id);
  if (!wheatLine || !saltLine || !pouchLine) throw new Error("Purchase order lines are missing.");

  createGoodsReceipt(owner, {
    receiptNumber: `GR-PROD-${id}`,
    purchaseOrderId: order.id,
    receivedAt: "2026-03-02T00:00:00.000Z",
    notes: "",
    lines: [
      {
        sourceLineId: wheatLine.id,
        kind: "raw",
        acceptedQuantity: 300000,
        damagedQuantity: 0,
        rejectedQuantity: 0,
        lotCode: `LOT-WHEAT-${id}`,
        expiresAt: "2026-12-31T00:00:00.000Z",
        unitCostPaise: 500,
      },
      {
        sourceLineId: saltLine.id,
        kind: "raw",
        acceptedQuantity: 10000,
        damagedQuantity: 0,
        rejectedQuantity: 0,
        lotCode: `LOT-SALT-${id}`,
        unitCostPaise: 50,
      },
      {
        sourceLineId: pouchLine.id,
        kind: "packaging",
        acceptedQuantity: 1000,
        damagedQuantity: 0,
        rejectedQuantity: 0,
        lotCode: `LOT-POUCH-${id}`,
        unitCostPaise: 250,
      },
    ],
  });

  const wheatBatch = db
    .select()
    .from(materialBatches)
    .where(and(eq(materialBatches.factoryId, owner.factoryId), eq(materialBatches.batchCode, `LOT-WHEAT-${id}`)))
    .get();
  const saltBatch = db
    .select()
    .from(materialBatches)
    .where(and(eq(materialBatches.factoryId, owner.factoryId), eq(materialBatches.batchCode, `LOT-SALT-${id}`)))
    .get();
  const pouchBatch = db
    .select()
    .from(packagingBatches)
    .where(and(eq(packagingBatches.factoryId, owner.factoryId), eq(packagingBatches.batchCode, `LOT-POUCH-${id}`)))
    .get();
  if (!wheatBatch || !saltBatch || !pouchBatch) throw new Error("Stocked batches are missing.");
  return { wheat: wheatBatch.id, salt: saltBatch.id, pouch: pouchBatch.id };
}

function findMaterialId(actor: WorkflowActor, code: string) {
  const row = db
    .select()
    .from(rawMaterials)
    .where(and(eq(rawMaterials.factoryId, actor.factoryId), eq(rawMaterials.code, code)))
    .get();
  if (!row) throw new Error(`Missing raw material ${code}.`);
  return row.id;
}

describe("phase 5 production and batch dna workflows", () => {
  it("moves production through plan, start, completion, posting, and real batch traceability", () => {
    const owner = actorFor("owner@graintrace.local", "owner");
    const production = actorFor("production@graintrace.local", "production");
    const salesman = actorFor("salesman@graintrace.local", "salesman");
    const id = suffix();
    const batches = stockMaterials(owner, id);

    const options = getProductionOptions(owner.factoryId);
    const recipe = options.recipes.find((item) => item.code === "RECIPE-ATTA-500");
    if (!recipe) throw new Error("Seeded recipe is missing.");

    const runNumber = `RUN-${id}`;
    const wheatItemId = `raw:${findMaterialId(owner, "RM-WHEAT")}`;
    const saltItemId = `raw:${findMaterialId(owner, "RM-SALT")}`;
    const pouchItemId = options.materials.find((item) => item.code === "PKG-POUCH-500")?.itemId;
    if (!pouchItemId) throw new Error("Packaging option is missing.");

    expect(() =>
      createProductionRun(salesman, {
        runNumber: `RUN-DENIED-${id}`,
        recipeId: recipe.id,
        plannedOutputPackets: 200,
        notes: "",
      }),
    ).toThrow(WorkflowAuthorizationError);

    const created = createProductionRun(production, {
      runNumber,
      recipeId: recipe.id,
      plannedOutputPackets: 200,
      sellingPricePaise: 6000,
      notes: "Phase 5 lifecycle",
    });
    expect(created.status).toBe("draft");
    expect(created.lineCount).toBe(3);

    const detailBeforePlan = getProductionRunDetail(owner.factoryId, runNumber);
    expect(detailBeforePlan?.status).toBe("draft");
    expect(detailBeforePlan?.lines).toHaveLength(3);

    const plan = [
      { itemId: wheatItemId, batchId: batches.wheat },
      { itemId: saltItemId, batchId: batches.salt },
      { itemId: pouchItemId, batchId: batches.pouch },
    ];
    planProductionRun(production, runNumber, { lines: plan });
    expect(getProductionRunDetail(owner.factoryId, runNumber)?.status).toBe("planned");

    updateProductionRunStatus(production, runNumber, "in_progress");
    expect(getProductionRunDetail(owner.factoryId, runNumber)?.status).toBe("in_progress");

    const completion = completeProductionRun(production, runNumber, {
      lines: [
        { itemId: wheatItemId, actualQuantity: 98000, damagedQuantity: 1000 },
        { itemId: saltItemId, actualQuantity: 1000, damagedQuantity: 0 },
        { itemId: pouchItemId, actualQuantity: 200, damagedQuantity: 0 },
      ],
      goodOutputPackets: 198,
      damagedOutputPackets: 2,
      labourPaise: 120000,
      gasPaise: 25000,
      notes: "Two packets damaged at packing",
    });
    expect(completion.status).toBe("completed");
    expect(completion.metrics.goodOutputPackets).toBe(198);
    expect(completion.metrics.damagedOutputPackets).toBe(2);

    const batchCode = `FG-${id}`;
    const posted = postProductionRun(production, runNumber, {
      finishedBatchCode: batchCode,
      packedOn: "2026-03-03T00:00:00.000Z",
      expiresAt: "2026-09-03T00:00:00.000Z",
      notes: "Posted by test",
    });
    expect(posted.status).toBe("posted");
    expect(posted.snapshot.costPerGoodPacketPaise).toBeGreaterThan(0);

    const runRow = db
      .select()
      .from(productionRuns)
      .where(and(eq(productionRuns.factoryId, owner.factoryId), eq(productionRuns.runNumber, runNumber)))
      .get();
    expect(runRow?.status).toBe("posted");
    expect(runRow?.postedAt).toBe("2026-03-03T00:00:00.000Z");

    const snapshot = db
      .select()
      .from(productionCostSnapshots)
      .where(eq(productionCostSnapshots.productionRunId, runRow!.id))
      .all();
    expect(snapshot).toHaveLength(1);
    expect(snapshot[0].snapshotId).toBe(`COST-${runNumber}`);

    const ledger = db
      .select()
      .from(stockLedger)
      .where(eq(stockLedger.factoryId, owner.factoryId))
      .all()
      .filter(
        (entry) => entry.referenceId === runRow!.id && entry.referenceType.startsWith("PRODUCTION_"),
      );
    expect(ledger).toHaveLength(6);
    expect(new Set(ledger.map((entry) => entry.referenceType))).toEqual(
      new Set([
        "PRODUCTION_CONSUMPTION",
        "PRODUCTION_MATERIAL_DAMAGE",
        "PRODUCTION_OUTPUT",
        "PRODUCTION_OUTPUT_DAMAGE",
      ]),
    );

    const finished = db
      .select()
      .from(finishedGoods)
      .where(and(eq(finishedGoods.factoryId, owner.factoryId), eq(finishedGoods.batchCode, batchCode)))
      .get();
    expect(finished?.availableGrams).toBe(99000);
    const packets = db
      .select()
      .from(finishedGoodPackets)
      .where(eq(finishedGoodPackets.finishedGoodId, finished!.id))
      .all();
    expect(packets).toHaveLength(198);

    expect(() =>
      postProductionRun(production, runNumber, {
        finishedBatchCode: batchCode,
        packedOn: "2026-03-03",
        notes: "",
      }),
    ).toThrow(
      /expected completed/i,
    );
    expect(() => planProductionRun(production, runNumber, { lines: plan })).toThrow(/immutable/i);

    const byBatch = getBatchTrace(owner.factoryId, batchCode);
    expect(byBatch).not.toBeNull();
    expect(byBatch?.runNumber).toBe(runNumber);
    expect(byBatch?.summary.sourceLots).toBe(3);
    expect(byBatch?.summary.supplierSources).toBe(3);
    expect(byBatch?.summary.goodOutputPackets).toBe(198);
    expect(byBatch?.summary.costPerPacketPaise).toBe(posted.snapshot.costPerGoodPacketPaise);
    const stages = new Set(byBatch!.nodes.map((node) => node.stage));
    expect(stages.has("sources")).toBe(true);
    expect(stages.has("lots")).toBe(true);
    expect(stages.has("movements")).toBe(true);
    expect(stages.has("recipe")).toBe(true);
    expect(stages.has("run")).toBe(true);
    expect(stages.has("finished")).toBe(true);
    expect(byBatch!.edges.length).toBeGreaterThan(8);
    expect(byBatch!.nodes.every((node) => node.details.length > 0)).toBe(true);

    const byRun = getBatchTrace(owner.factoryId, runNumber);
    expect(byRun?.batchCode).toBe(batchCode);
    expect(listBatchDnaRuns(owner.factoryId).some((item) => item.batchCode === batchCode)).toBe(true);
  });

  it("flags material variance above three percent in the batch trace", () => {
    const owner = actorFor("owner@graintrace.local", "owner");
    const production = actorFor("production@graintrace.local", "production");
    const id = suffix();
    const batches = stockMaterials(owner, id);

    const options = getProductionOptions(owner.factoryId);
    const recipe = options.recipes.find((item) => item.code === "RECIPE-ATTA-500");
    const pouchItemId = options.materials.find((item) => item.code === "PKG-POUCH-500")?.itemId;
    if (!recipe || !pouchItemId) throw new Error("Seeded production options are missing.");

    const runNumber = `RUN-VAR-${id}`;
    createProductionRun(production, {
      runNumber,
      recipeId: recipe.id,
      plannedOutputPackets: 200,
      notes: "",
    });
    const wheatItemId = `raw:${findMaterialId(owner, "RM-WHEAT")}`;
    const saltItemId = `raw:${findMaterialId(owner, "RM-SALT")}`;
    planProductionRun(production, runNumber, {
      lines: [
        { itemId: wheatItemId, batchId: batches.wheat },
        { itemId: saltItemId, batchId: batches.salt },
        { itemId: pouchItemId, batchId: batches.pouch },
      ],
    });
    updateProductionRunStatus(production, runNumber, "in_progress");

    const completed = completeProductionRun(production, runNumber, {
      lines: [
        { itemId: wheatItemId, actualQuantity: 130000, damagedQuantity: 0 },
        { itemId: saltItemId, actualQuantity: 1000, damagedQuantity: 0 },
        { itemId: pouchItemId, actualQuantity: 200, damagedQuantity: 0 },
      ],
      goodOutputPackets: 200,
      damagedOutputPackets: 0,
      labourPaise: 0,
      gasPaise: 0,
      notes: "",
    });
    expect(completed.variances.filter((variance) => variance.flagged)).toHaveLength(1);

    const batchCode = `FG-VAR-${id}`;
    postProductionRun(production, runNumber, {
      finishedBatchCode: batchCode,
      packedOn: "2026-03-04",
      notes: "",
    });

    const trace = getBatchTrace(owner.factoryId, batchCode);
    expect(trace?.summary.varianceFlags).toBeGreaterThan(0);
    expect(trace?.nodes.some((node) => node.kind === "yield" && node.risk)).toBe(true);
  });
});

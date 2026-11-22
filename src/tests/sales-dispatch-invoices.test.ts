import { and, eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { permissionsFor, type RoleName } from "@/lib/auth/permissions";
import {
  creditNotes,
  customers,
  finishedGoodPackets,
  finishedGoods,
  materialBatches,
  packagingBatches,
  packagingMaterials,
  products,
  rawMaterials,
  stockLedger,
  suppliers,
  users,
} from "@/lib/db/schema";
import { WorkflowAuthorizationError, type WorkflowActor } from "@/lib/workflows/context";
import { createCustomer, updateCustomerStatus } from "@/lib/workflows/customers";
import { createDispatch, getDispatchPlan, updateDispatchStatus } from "@/lib/workflows/dispatch";
import {
  cancelInvoice,
  createInvoice,
  getInvoiceDetail,
  getInvoicePdfData,
  getSalesInvoiceCandidates,
} from "@/lib/workflows/invoices";
import { addDaysToDate, financialYearForDate, formatDocumentNumber } from "@/lib/workflows/numbering";
import { createPayment, listCollections, listPayments } from "@/lib/workflows/payments";
import {
  completeProductionRun,
  createProductionRun,
  getProductionOptions,
  planProductionRun,
  postProductionRun,
  updateProductionRunStatus,
} from "@/lib/workflows/production";
import { createSalesOrder, getSalesOrderDetail, listSalesOrders, updateSalesOrderStatus } from "@/lib/workflows/sales";
import {
  createGoodsReceipt,
  createPurchaseOrder,
  createSupplier,
  getPurchaseOrderDetail,
  updatePurchaseOrderStatus,
} from "@/lib/workflows/purchases";
import type {
  CustomerInput,
  DispatchInput,
  InvoiceCancelInput,
  InvoiceInput,
  PaymentInput,
  SalesOrderInput,
  SupplierInput,
} from "@/lib/workflows/validation";
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

function findMaterialId(actor: WorkflowActor, code: string) {
  const row = db
    .select()
    .from(rawMaterials)
    .where(and(eq(rawMaterials.factoryId, actor.factoryId), eq(rawMaterials.code, code)))
    .get();
  if (!row) throw new Error(`Missing raw material ${code}.`);
  return row.id;
}

function stockMaterials(owner: WorkflowActor, id: string) {
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

  const supplierCode = `SUPP-SALES-${id}`;
  createSupplier(owner, { code: supplierCode, name: `Sales Supplier ${id}` } as SupplierInput);
  const supplier = db.select().from(suppliers).where(eq(suppliers.code, supplierCode)).get();
  if (!supplier) throw new Error("Supplier was not created.");

  const orderNumber = `PO-SALES-${id}`;
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
    receiptNumber: `GR-SALES-${id}`,
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
        lotCode: `LOT-SALES-W-${id}`,
        expiresAt: "2026-12-31T00:00:00.000Z",
        unitCostPaise: 500,
      },
      {
        sourceLineId: saltLine.id,
        kind: "raw",
        acceptedQuantity: 10000,
        damagedQuantity: 0,
        rejectedQuantity: 0,
        lotCode: `LOT-SALES-S-${id}`,
        unitCostPaise: 50,
      },
      {
        sourceLineId: pouchLine.id,
        kind: "packaging",
        acceptedQuantity: 1000,
        damagedQuantity: 0,
        rejectedQuantity: 0,
        lotCode: `LOT-SALES-P-${id}`,
        unitCostPaise: 250,
      },
    ],
  });

  const wheatBatch = db
    .select()
    .from(materialBatches)
    .where(and(eq(materialBatches.factoryId, owner.factoryId), eq(materialBatches.batchCode, `LOT-SALES-W-${id}`)))
    .get();
  const saltBatch = db
    .select()
    .from(materialBatches)
    .where(and(eq(materialBatches.factoryId, owner.factoryId), eq(materialBatches.batchCode, `LOT-SALES-S-${id}`)))
    .get();
  const pouchBatch = db
    .select()
    .from(packagingBatches)
    .where(and(eq(packagingBatches.factoryId, owner.factoryId), eq(packagingBatches.batchCode, `LOT-SALES-P-${id}`)))
    .get();
  if (!wheatBatch || !saltBatch || !pouchBatch) throw new Error("Stocked batches are missing.");
  return { wheat: wheatBatch.id, salt: saltBatch.id, pouch: pouchBatch.id };
}

function produceFinishedGoods(owner: WorkflowActor, productionActor: WorkflowActor, id: string) {
  const batches = stockMaterials(owner, id);
  const options = getProductionOptions(owner.factoryId);
  const recipe = options.recipes.find((item) => item.code === "RECIPE-ATTA-500");
  if (!recipe) throw new Error("Seeded recipe is missing.");
  const pouchItemId = options.materials.find((item) => item.code === "PKG-POUCH-500")?.itemId;
  if (!pouchItemId) throw new Error("Packaging option is missing.");
  const wheatItemId = `raw:${findMaterialId(owner, "RM-WHEAT")}`;
  const saltItemId = `raw:${findMaterialId(owner, "RM-SALT")}`;
  const runNumber = `RUN-SALES-${id}`;
  const batchCode = `FG-SALES-${id}`;

  createProductionRun(productionActor, {
    runNumber,
    recipeId: recipe.id,
    plannedOutputPackets: 200,
    sellingPricePaise: 6000,
    notes: "Sales workflow fixture",
  });
  planProductionRun(productionActor, runNumber, {
    lines: [
      { itemId: wheatItemId, batchId: batches.wheat },
      { itemId: saltItemId, batchId: batches.salt },
      { itemId: pouchItemId, batchId: batches.pouch },
    ],
  });
  updateProductionRunStatus(productionActor, runNumber, "in_progress");
  completeProductionRun(productionActor, runNumber, {
    lines: [
      { itemId: wheatItemId, actualQuantity: 98000, damagedQuantity: 1000 },
      { itemId: saltItemId, actualQuantity: 1000, damagedQuantity: 0 },
      { itemId: pouchItemId, actualQuantity: 200, damagedQuantity: 0 },
    ],
    goodOutputPackets: 198,
    damagedOutputPackets: 2,
    labourPaise: 120000,
    gasPaise: 25000,
    notes: "Sales workflow fixture",
  });
  postProductionRun(productionActor, runNumber, {
    finishedBatchCode: batchCode,
    packedOn: "2026-03-03T00:00:00.000Z",
    expiresAt: "2026-09-03T00:00:00.000Z",
    notes: "Sales workflow fixture",
  });

  const finished = db
    .select()
    .from(finishedGoods)
    .where(and(eq(finishedGoods.factoryId, owner.factoryId), eq(finishedGoods.batchCode, batchCode)))
    .get();
  if (!finished) throw new Error("Finished goods were not posted.");
  return finished;
}

describe("phase 6 document numbering", () => {
  it("uses April-March financial years and zero-padded sequences", () => {
    expect(financialYearForDate("2026-04-01")).toBe("2026-27");
    expect(financialYearForDate("2026-03-31")).toBe("2025-26");
    expect(addDaysToDate("2026-03-31", 1)).toBe("2026-04-01");
    expect(formatDocumentNumber("TN", "2026-27", 7, 4)).toBe("TN/2026-27/0007");
    expect(() => financialYearForDate("invalid-date")).toThrow(/valid issue date/i);
  });
});

describe("phase 6 sales, dispatch, invoice, and collection workflows", () => {
  it("posts an approved order through partial dispatch, GST invoice, payment, credit note, and fulfilment", () => {
    const owner = actorFor("owner@graintrace.local", "owner");
    const salesman = actorFor("salesman@graintrace.local", "salesman");
    const productionActor = actorFor("production@graintrace.local", "production");
    const accountant = actorFor("accountant@graintrace.local", "accountant");
    const id = suffix();
    const finished = produceFinishedGoods(owner, productionActor, id);
    const product = db
      .select()
      .from(products)
      .where(and(eq(products.factoryId, owner.factoryId), eq(products.code, "PROD-500")))
      .get();
    if (!product) throw new Error("Seeded product is missing.");

    const customer = createCustomer(owner, {
      code: `CUST-SALES-${id}`,
      name: `Phase 6 Customer ${id}`,
      customerType: "distributor",
      state: "Karnataka",
      deliveryState: "Karnataka",
      city: "Bengaluru",
      gstin: "29AACCS6543P1Z7",
      creditTermsDays: 30,
      creditLimitPaise: 1_000_000,
    } as CustomerInput);
    expect(customer.status).toBe("active");

    updateCustomerStatus(owner, customer.id, "inactive");
    expect(() =>
      createSalesOrder(owner, {
        orderNumber: `SO-INACTIVE-${id}`,
        customerId: customer.id,
        orderDate: "2026-04-01",
        lines: [{ productId: product.id, quantityPackets: 1, unitPricePaise: 6000, discountPaise: 0 }],
      } as SalesOrderInput),
    ).toThrow(/active customers/i);
    updateCustomerStatus(owner, customer.id, "active");

    const orderNumber = `SO-SALES-${id}`;
    const order = createSalesOrder(salesman, {
      orderNumber,
      customerId: customer.id,
      orderDate: "2026-04-01",
      requestedDate: "2026-04-10",
      notes: "Phase 6 end-to-end test",
      lines: [{ productId: product.id, quantityPackets: 5, unitPricePaise: 6000, discountPaise: 0 }],
    } as SalesOrderInput);
    expect(order.status).toBe("draft");
    expect(order.totalAmountPaise).toBe(30000);
    expect(listSalesOrders(owner.factoryId, { query: orderNumber })).toHaveLength(1);
    expect(() => updateSalesOrderStatus(salesman, orderNumber, "approved")).toThrow(WorkflowAuthorizationError);

    updateSalesOrderStatus(salesman, orderNumber, "submitted");
    const approved = updateSalesOrderStatus(owner, orderNumber, "approved");
    expect(approved.status).toBe("approved");
    expect(approved.approvedAt).toBeTruthy();
    expect(() => updateSalesOrderStatus(owner, orderNumber, "approved")).toThrow(/invalid transition|Cannot approve/i);

    const lineId = order.lines[0].id;
    const plan = getDispatchPlan(owner.factoryId, orderNumber);
    expect(plan?.lines[0].availablePackets).toBeGreaterThanOrEqual(5);
    expect(() =>
      createDispatch(salesman, {
        salesOrderNumber: orderNumber,
        dispatchedAt: "2026-04-02",
        status: "in_transit",
        lines: [{ salesOrderItemId: lineId, quantityPackets: 2 }],
      } as DispatchInput),
    ).toThrow(WorkflowAuthorizationError);
    expect(() =>
      createDispatch(owner, {
        salesOrderNumber: orderNumber,
        dispatchedAt: "2026-04-02",
        status: "in_transit",
        lines: [{ salesOrderItemId: lineId, quantityPackets: 6 }],
      } as DispatchInput),
    ).toThrow(/cannot dispatch 6 packets/i);

    const dispatch = createDispatch(owner, {
      salesOrderNumber: orderNumber,
      dispatchedAt: "2026-04-02",
      expectedDate: "2026-04-06",
      status: "in_transit",
      carrierName: "Surface Express",
      trackingNumber: `TRK-${id}`,
      notes: "First partial dispatch",
      lines: [{ salesOrderItemId: lineId, quantityPackets: 2 }],
    } as DispatchInput);
    expect(dispatch.dispatchNumber).toMatch(/^DSP\/\d{4}-\d{2}\/\d{4}$/);
    expect(dispatch.lines).toHaveLength(2);
    expect(getSalesOrderDetail(owner.factoryId, orderNumber)?.status).toBe("partially_fulfilled");

    const dispatchedPackets = db
      .select()
      .from(finishedGoodPackets)
      .where(eq(finishedGoodPackets.finishedGoodId, finished.id))
      .all()
      .filter((packet) => packet.status === "dispatched");
    expect(dispatchedPackets).toHaveLength(2);
    const dispatchLedger = db
      .select()
      .from(stockLedger)
      .where(and(eq(stockLedger.factoryId, owner.factoryId), eq(stockLedger.referenceType, "DISPATCH")))
      .all()
      .filter((entry) => entry.referenceId === dispatch.id);
    expect(dispatchLedger).toHaveLength(1);
    expect(dispatchLedger[0].quantityDelta).toBe(-2);
    expect(dispatchLedger[0].baseUnit).toBe("pieces");
    expect(
      db.select().from(finishedGoods).where(eq(finishedGoods.id, finished.id)).get()?.availableGrams,
    ).toBe(finished.availableGrams - 1000);

    const candidates = getSalesInvoiceCandidates(owner.factoryId, orderNumber);
    if (!candidates) throw new Error("Invoice candidates are missing.");
    expect(candidates[0].availableToInvoicePackets).toBe(2);
    expect(() =>
      createInvoice(owner, {
        salesOrderNumber: orderNumber,
        invoiceDate: "2026-04-02",
        rateBasisPoints: 500,
        lines: [{ salesOrderItemId: lineId, quantityPackets: 3 }],
      } as InvoiceInput),
    ).toThrow(/available to invoice/i);

    const invoice = createInvoice(owner, {
      salesOrderNumber: orderNumber,
      invoiceDate: "2026-04-02",
      rateBasisPoints: 500,
      lines: [{ salesOrderItemId: lineId, quantityPackets: 2 }],
    } as InvoiceInput);
    expect(invoice.invoiceNumber).toMatch(/^TN\/\d{4}-\d{2}\/\d{4}$/);
    expect(invoice.financialYear).toBe("2026-27");
    expect(invoice.jurisdiction).toBe("inter_state");
    expect(invoice.subtotalPaise).toBe(12000);
    expect(invoice.taxPaise).toBe(600);
    expect(invoice.totalPaise).toBe(12600);
    expect(invoice.lines[0].cgstPaise).toBe(0);
    expect(invoice.lines[0].sgstPaise).toBe(0);
    expect(invoice.lines[0].igstPaise).toBe(600);
    expect(getSalesInvoiceCandidates(owner.factoryId, orderNumber)?.[0].availableToInvoicePackets).toBe(0);
    expect(getInvoicePdfData(owner.factoryId, invoice.invoiceNumber)?.businessName).toBeTruthy();
    expect(() => createInvoice(salesman, {
      salesOrderNumber: orderNumber,
      invoiceDate: "2026-04-02",
      rateBasisPoints: 500,
      lines: [{ salesOrderItemId: lineId, quantityPackets: 1 }],
    } as InvoiceInput)).toThrow(WorkflowAuthorizationError);

    expect(() =>
      createPayment(salesman, {
        invoiceNumber: invoice.invoiceNumber,
        paidAt: "2026-04-03",
        amountPaise: 100,
        method: "cash",
        referenceNo: "",
      } as PaymentInput),
    ).toThrow(WorkflowAuthorizationError);
    const partialPayment = createPayment(accountant, {
      invoiceNumber: invoice.invoiceNumber,
      paidAt: "2026-04-03",
      amountPaise: 5000,
      method: "upi",
      referenceNo: `UPI-${id}`,
    } as PaymentInput);
    expect(partialPayment.paymentNumber).toMatch(/^PAY\/\d{4}-\d{2}\/\d{4}$/);
    expect(getInvoiceDetail(owner.factoryId, invoice.invoiceNumber)?.status).toBe("partially_paid");
    expect(
      listCollections(owner.factoryId).find((row) => row.invoiceNumber === invoice.invoiceNumber)?.outstandingPaise,
    ).toBe(7600);
    expect(() =>
      createPayment(accountant, {
        invoiceNumber: invoice.invoiceNumber,
        paidAt: "2026-04-03",
        amountPaise: 12601,
        method: "cash",
        referenceNo: "",
      } as PaymentInput),
    ).toThrow(/exceed invoice total/i);
    createPayment(accountant, {
      invoiceNumber: invoice.invoiceNumber,
      paidAt: "2026-04-04",
      amountPaise: 7600,
      method: "bank_transfer",
      referenceNo: `NEFT-${id}`,
    } as PaymentInput);
    expect(getInvoiceDetail(owner.factoryId, invoice.invoiceNumber)?.status).toBe("paid");
    expect(listPayments(owner.factoryId).filter((payment) => payment.invoiceNumber === invoice.invoiceNumber)).toHaveLength(2);

    const cancelled = cancelInvoice(owner, invoice.invoiceNumber, {
      reason: "Customer return verified by dispatch",
    } as InvoiceCancelInput);
    expect(cancelled.status).toBe("cancelled");
    expect(cancelled.creditNoteNumber).toMatch(/^CN\/TN\/\d{4}-\d{2}\/\d{4}$/);
    expect(cancelled.creditNotePaise).toBe(invoice.totalPaise);
    const creditNoteRows = db
      .select()
      .from(creditNotes)
      .where(and(eq(creditNotes.factoryId, owner.factoryId), eq(creditNotes.invoiceId, invoice.id)))
      .all();
    expect(creditNoteRows).toHaveLength(1);
    expect(() =>
      createPayment(accountant, {
        invoiceNumber: invoice.invoiceNumber,
        paidAt: "2026-04-05",
        amountPaise: 100,
        method: "cash",
        referenceNo: "",
      } as PaymentInput),
    ).toThrow(/cancelled invoice/i);

    expect(() =>
      createDispatch(owner, {
        salesOrderNumber: orderNumber,
        dispatchedAt: "2026-04-06",
        status: "in_transit",
        lines: [{ salesOrderItemId: lineId, quantityPackets: 4 }],
      } as DispatchInput),
    ).toThrow(/cannot dispatch 4 packets/i);
    const finalDispatch = createDispatch(owner, {
      salesOrderNumber: orderNumber,
      dispatchedAt: "2026-04-06",
      status: "in_transit",
      lines: [{ salesOrderItemId: lineId, quantityPackets: 3 }],
    } as DispatchInput);
    expect(getSalesOrderDetail(owner.factoryId, orderNumber)?.status).toBe("fulfilled");
    const delivered = updateDispatchStatus(owner, finalDispatch.dispatchNumber, "delivered");
    expect(delivered.status).toBe("delivered");
    expect(delivered.deliveredAt).toBeTruthy();
    expect(() => updateDispatchStatus(owner, finalDispatch.dispatchNumber, "cancelled")).toThrow(
      /delivered dispatch cannot be cancelled/i,
    );

    const finalCustomer = db.select().from(customers).where(eq(customers.id, customer.id)).get();
    expect(finalCustomer?.status).toBe("active");
  });
});

import "server-only";

import { and, asc, eq, inArray } from "drizzle-orm";
import { calculateStockBalance, formatPaise, type BaseUnit } from "@/domain";
import { getDb } from "@/lib/db";
import {
  customers,
  dispatchItems,
  dispatches,
  finishedGoodPackets,
  finishedGoods,
  goodsReceiptItems,
  goodsReceipts,
  invoices,
  materialBatches,
  packagingBatches,
  productionRuns,
  purchaseOrders,
  stockLedger,
  suppliers,
} from "@/lib/db/schema";
import { stockItemKey, type WorkflowDb } from "./db";
import { loadStockLedger } from "./ledger";
import { getProductionRunDetail, type ProductionRunSummary } from "./production";

export const BATCH_DNA_STAGES = [
  { key: "sources", label: "PURCHASE SOURCES", order: 0 },
  { key: "lots", label: "RAW MATERIAL LOTS", order: 1 },
  { key: "movements", label: "INVENTORY MOVEMENTS", order: 2 },
  { key: "recipe", label: "RECIPE / BOM", order: 3 },
  { key: "run", label: "PRODUCTION RUN", order: 4 },
  { key: "consumption", label: "MATERIAL CONSUMPTION", order: 5 },
  { key: "yield", label: "YIELD / VARIANCE", order: 6 },
  { key: "finished", label: "FINISHED GOODS", order: 7 },
  { key: "dispatch", label: "DISPATCH", order: 8 },
  { key: "invoice", label: "INVOICE / CUSTOMER", order: 9 },
] as const;

export type BatchDnaStage = (typeof BATCH_DNA_STAGES)[number]["key"];

export type TraceNodeKind =
  | "supplier"
  | "batch"
  | "ledger"
  | "recipe"
  | "run"
  | "consumption"
  | "yield"
  | "finished"
  | "dispatch"
  | "invoice";

export type TraceDetail = { label: string; value: string };
export type TraceLink = { label: string; href: string };

export type TraceNode = {
  id: string;
  stage: BatchDnaStage;
  stageLabel: string;
  order: number;
  kind: TraceNodeKind;
  label: string;
  code: string;
  summary: string;
  quantity: string | null;
  timestamp: string | null;
  document: string | null;
  risk: boolean;
  details: TraceDetail[];
  links: TraceLink[];
};

export type TraceEdge = {
  id: string;
  from: string;
  to: string;
  label: string;
  quantity: string | null;
};

export type BatchDnaTraceSummary = ProductionRunSummary & {
  batchCode: string;
  sourceLots: number;
  flaggedLinks: number;
};

export type BatchDnaTrace = {
  identifier: string;
  batchCode: string;
  runNumber: string;
  productCode: string;
  productName: string;
  productionDate: string;
  status: string;
  nodes: TraceNode[];
  edges: TraceEdge[];
  gaps: string[];
  summary: {
    sourceLots: number;
    supplierSources: number;
    ledgerEvents: number;
    plannedOutputPackets: number;
    goodOutputPackets: number;
    damagedOutputPackets: number;
    currentFinishedPackets: number;
    dispatchedPackets: number;
    yieldVarianceBasisPoints: number | null;
    varianceFlags: number;
    materialCostPaise: number | null;
    labourPaise: number | null;
    overheadPaise: number | null;
    totalCostPaise: number | null;
    costPerPacketPaise: number | null;
    customers: string[];
    invoiceReferences: string[];
  };
};

type SourceInfo = {
  supplierName: string;
  supplierCode: string;
  purchaseOrderNumber: string | null;
  receiptNumber: string | null;
  lotCode: string | null;
  receivedAt: string;
  expiresAt: string | null;
};

function stageMeta(stage: BatchDnaStage) {
  return BATCH_DNA_STAGES.find((item) => item.key === stage)!;
}

function formatQuantity(value: number, baseUnit: BaseUnit) {
  const unit = baseUnit === "grams" ? "g" : baseUnit === "millilitres" ? "ml" : "pcs";
  return `${new Intl.NumberFormat("en-IN").format(value)} ${unit}`;
}

function parsePackQuantity(value: string | null) {
  return value ?? "—";
}

function targetFor(itemId: string, batchId: number) {
  return itemId.startsWith("raw:")
    ? ({ type: "raw", id: batchId } as const)
    : ({ type: "packaging", id: batchId } as const);
}

function currentBalance(db: WorkflowDb, factoryId: number, itemId: string, batchId: number) {
  const target = targetFor(itemId, batchId);
  const ledger = loadStockLedger(db, factoryId, target);
  return calculateStockBalance(ledger, stockItemKey(target));
}

function loadSourceInfo(
  db: WorkflowDb,
  factoryId: number,
  itemId: string,
  batchId: number,
): SourceInfo | null {
  let receivedAt = "";
  let expiresAt: string | null = null;
  let goodsReceiptItemId: number | null = null;
  let supplierId: number | null = null;

  if (itemId.startsWith("raw:")) {
    const row = db
      .select()
      .from(materialBatches)
      .where(and(eq(materialBatches.factoryId, factoryId), eq(materialBatches.id, batchId)))
      .get();
    if (!row) return null;
    receivedAt = row.receivedAt;
    expiresAt = row.expiresAt;
    goodsReceiptItemId = row.goodsReceiptItemId;
    supplierId = row.supplierId;
  } else {
    const row = db
      .select()
      .from(packagingBatches)
      .where(and(eq(packagingBatches.factoryId, factoryId), eq(packagingBatches.id, batchId)))
      .get();
    if (!row) return null;
    receivedAt = row.receivedAt;
    expiresAt = row.expiresAt;
    goodsReceiptItemId = row.goodsReceiptItemId;
    supplierId = row.supplierId;
  }

  let purchaseOrderNumber: string | null = null;
  let receiptNumber: string | null = null;
  let lotCode: string | null = null;
  if (goodsReceiptItemId !== null) {
    const receiptItem = db
      .select()
      .from(goodsReceiptItems)
      .where(eq(goodsReceiptItems.id, goodsReceiptItemId))
      .get();
    lotCode = receiptItem?.lotCode ?? null;
    if (receiptItem) {
      const receipt = db
        .select()
        .from(goodsReceipts)
        .where(eq(goodsReceipts.id, receiptItem.goodsReceiptId))
        .get();
      receiptNumber = receipt?.receiptNumber ?? null;
      if (receipt) {
        const order = db
          .select()
          .from(purchaseOrders)
          .where(eq(purchaseOrders.id, receipt.purchaseOrderId))
          .get();
        purchaseOrderNumber = order?.orderNumber ?? null;
        if (order) supplierId = order.supplierId;
      }
    }
  }

  const supplier = supplierId
    ? db.select().from(suppliers).where(eq(suppliers.id, supplierId)).get()
    : null;

  return {
    supplierName: supplier?.name ?? "Supplier not recorded",
    supplierCode: supplier?.code ?? "—",
    purchaseOrderNumber,
    receiptNumber,
    lotCode,
    receivedAt,
    expiresAt,
  };
}

export function listBatchDnaRuns(factoryId: number): BatchDnaTraceSummary[] {
  const db = getDb();
  const finishedRows = db
    .select()
    .from(finishedGoods)
    .where(eq(finishedGoods.factoryId, factoryId))
    .orderBy(asc(finishedGoods.id))
    .all();

  return finishedRows.flatMap((finished) => {
    const run = db
      .select({ runNumber: productionRuns.runNumber })
      .from(productionRuns)
      .where(and(eq(productionRuns.factoryId, factoryId), eq(productionRuns.id, finished.productionRunId)))
      .get();
    if (!run) return [];
    const detail = getProductionRunDetail(factoryId, run.runNumber, db);
    if (!detail) return [];
    return [
      {
        ...detail,
        batchCode: finished.batchCode,
        sourceLots: detail.lines.filter((line) => line.batchId !== null).length,
        flaggedLinks: detail.exceptionCount,
      },
    ];
  });
}

export function getBatchTrace(factoryId: number, identifier: string): BatchDnaTrace | null {
  const db = getDb();
  let finished = db
    .select()
    .from(finishedGoods)
    .where(and(eq(finishedGoods.factoryId, factoryId), eq(finishedGoods.batchCode, identifier)))
    .get();
  const run = finished
    ? db
        .select()
        .from(productionRuns)
        .where(and(eq(productionRuns.factoryId, factoryId), eq(productionRuns.id, finished.productionRunId)))
        .get()
    : db
        .select()
        .from(productionRuns)
        .where(and(eq(productionRuns.factoryId, factoryId), eq(productionRuns.runNumber, identifier)))
        .get();
  if (!finished && run) {
    finished = db
      .select()
      .from(finishedGoods)
      .where(and(eq(finishedGoods.factoryId, factoryId), eq(finishedGoods.productionRunId, run.id)))
      .get();
  }
  if (!run || !finished) return null;

  const detail = getProductionRunDetail(factoryId, run.runNumber, db);
  if (!detail) return null;

  const nodes = new Map<string, TraceNode>();
  const edges = new Map<string, TraceEdge>();
  const gaps: string[] = [];

  function addNode(node: TraceNode) {
    if (!nodes.has(node.id)) nodes.set(node.id, node);
  }

  function addEdge(from: string, to: string, label: string, quantity: string | null = null) {
    const id = `${from}->${to}:${label}`;
    if (!edges.has(id)) edges.set(id, { id, from, to, label, quantity });
  }

  function stageNode(
    id: string,
    stage: BatchDnaStage,
    kind: TraceNodeKind,
    label: string,
    code: string,
    summary: string,
    options: Partial<TraceNode> = {},
  ) {
    const meta = stageMeta(stage);
    addNode({
      id,
      stage,
      stageLabel: meta.label,
      order: meta.order,
      kind,
      label,
      code,
      summary,
      quantity: null,
      timestamp: null,
      document: null,
      risk: false,
      details: [],
      links: [],
      ...options,
    });
  }

  const runNodeId = `run:${run.id}`;
  stageNode(runNodeId, "run", "run", "Production run", run.runNumber, `${detail.productName} · ${detail.status}`, {
    timestamp: detail.startedAt ?? detail.createdAt,
    document: run.runNumber,
    quantity: `${detail.actualOutputPackets} packets recorded`,
    risk: detail.exceptionCount > 0,
    details: [
      { label: "Status", value: detail.status },
      { label: "Product", value: `${detail.productCode} · ${detail.productName}` },
      { label: "Recipe", value: `${detail.recipeCode} v${detail.recipeVersion}` },
      { label: "Planned output", value: `${detail.plannedOutputPackets} packets` },
      { label: "Actual output", value: `${detail.actualOutputPackets} packets` },
      { label: "Good output", value: `${detail.goodOutputPackets} packets` },
      { label: "Damaged output", value: `${detail.damagedOutputPackets} packets` },
      { label: "Started", value: detail.startedAt ?? "—" },
      { label: "Completed", value: detail.completedAt ?? "—" },
      { label: "Posted", value: detail.postedAt ?? "—" },
    ],
    links: [{ label: "Open production record", href: `/production?focus=${run.runNumber}` }],
  });

  const recipeNodeId = `recipe:${detail.recipeCode}:${detail.recipeVersion}`;
  stageNode(
    recipeNodeId,
    "recipe",
    "recipe",
    "Recipe / BOM",
    `${detail.recipeCode} v${detail.recipeVersion}`,
    `${detail.lines.length} controlled material lines`,
    {
      details: [
        { label: "Recipe", value: detail.recipeCode },
        { label: "Version", value: String(detail.recipeVersion) },
        { label: "Packet size", value: `${detail.packetGrams} g` },
        { label: "Expected output", value: `${detail.plannedOutputPackets} packets for this run` },
        ...detail.lines.map((line) => ({
          label: line.materialCode,
          value: `${new Intl.NumberFormat("en-IN").format(line.plannedQuantity)} ${line.baseUnit === "grams" ? "g" : "pcs"} planned`,
        })),
      ],
      links: [{ label: "Open recipes", href: "/recipes" }],
    },
  );
  addEdge(recipeNodeId, runNodeId, "authorises");

  let sourceLots = 0;
  let supplierSources = 0;
  let ledgerEvents = 0;

  for (const line of detail.lines) {
    if (line.batchId === null) continue;
    sourceLots += 1;
    const source = loadSourceInfo(db, factoryId, line.itemId, line.batchId);
    const lotNodeId = `lot:${line.itemId}:${line.batchId}`;
    const consumed = line.actualQuantity + line.damagedQuantity;
    const balance = currentBalance(db, factoryId, line.itemId, line.batchId);

    stageNode(
      lotNodeId,
      "lots",
      "batch",
      line.materialName || line.materialCode,
      line.batchCode ?? `batch-${line.batchId}`,
      `${formatQuantity(consumed, line.baseUnit)} consumed · ${formatQuantity(balance, line.baseUnit)} remaining`,
      {
        timestamp: source?.receivedAt ?? null,
        document: source?.receiptNumber ?? null,
        quantity: formatQuantity(consumed, line.baseUnit),
        details: [
          { label: "Lot", value: line.batchCode ?? "—" },
          { label: "Material", value: `${line.materialCode} · ${line.materialName}` },
          { label: "Supplier", value: source?.supplierName ?? "—" },
          { label: "Source lot", value: parsePackQuantity(source?.lotCode ?? null) },
          { label: "Received", value: source?.receivedAt ?? "—" },
          { label: "Expires", value: source?.expiresAt ?? "—" },
          { label: "Consumed", value: formatQuantity(consumed, line.baseUnit) },
          { label: "Material damage", value: formatQuantity(line.damagedQuantity, line.baseUnit) },
          { label: "Current batch balance", value: formatQuantity(balance, line.baseUnit) },
        ],
        links: [
          { label: "Inspect inventory", href: `/inventory?focus=${line.batchCode ?? ""}` },
          ...(source?.receiptNumber
            ? [{ label: "Open goods receipt", href: `/purchases?focus=${source.receiptNumber}` }]
            : []),
        ],
      },
    );

    if (source) {
      const sourceNodeId = `source:${source.supplierCode}:${source.purchaseOrderNumber ?? line.batchId}`;
      stageNode(
        sourceNodeId,
        "sources",
        "supplier",
        source.supplierName,
        source.purchaseOrderNumber ?? source.supplierCode,
        `${source.receiptNumber ? `GRN ${source.receiptNumber}` : "Purchase source"} · ${source.supplierCode}`,
        {
          timestamp: source.receivedAt,
          document: source.purchaseOrderNumber ?? source.receiptNumber,
          details: [
            { label: "Supplier", value: source.supplierName },
            { label: "Supplier code", value: source.supplierCode },
            { label: "Purchase order", value: source.purchaseOrderNumber ?? "—" },
            { label: "Goods receipt", value: source.receiptNumber ?? "—" },
            { label: "Source lot", value: parsePackQuantity(source.lotCode) },
            { label: "Received", value: source.receivedAt },
          ],
          links: [
            ...(source.receiptNumber
              ? [{ label: "Open purchases", href: `/purchases?focus=${source.receiptNumber}` }]
              : []),
          ],
        },
      );
      if (source.purchaseOrderNumber || source.supplierName) supplierSources += 1;
      addEdge(sourceNodeId, lotNodeId, "supplied", line.batchCode ?? null);
    }
    addEdge(lotNodeId, recipeNodeId, "allocated to BOM", line.batchCode ?? null);

    const target = targetFor(line.itemId, line.batchId);
    const targetColumn =
      target.type === "raw" ? stockLedger.materialBatchId : stockLedger.packagingBatchId;
    const movements = db
      .select()
      .from(stockLedger)
      .where(and(eq(stockLedger.factoryId, factoryId), eq(targetColumn, target.id)))
      .orderBy(asc(stockLedger.id))
      .all();
    for (const movement of movements) {
      ledgerEvents += 1;
      const movementNodeId = `movement:${movement.id}`;
      stageNode(
        movementNodeId,
        "movements",
        "ledger",
        movement.referenceType.replace(/_/g, " ").toLowerCase(),
        movement.referenceNumber,
        `${movement.quantityDelta > 0 ? "+" : ""}${formatQuantity(movement.quantityDelta, line.baseUnit)} · balance ${formatQuantity(movement.balance, line.baseUnit)}`,
        {
          timestamp: movement.occurredAt,
          document: movement.referenceNumber,
          quantity: formatQuantity(movement.quantityDelta, line.baseUnit),
          details: [
            { label: "Reference", value: movement.referenceNumber },
            { label: "Type", value: movement.referenceType },
            { label: "Transaction", value: movement.transactionType },
            { label: "Delta", value: formatQuantity(movement.quantityDelta, line.baseUnit) },
            { label: "Balance", value: formatQuantity(movement.balance, line.baseUnit) },
            { label: "Occurred", value: movement.occurredAt },
          ],
          links: [
            { label: "Inspect inventory", href: `/inventory?focus=${line.batchCode ?? ""}` },
          ],
        },
      );
      addEdge(lotNodeId, movementNodeId, "ledger evidence");
      if (movement.referenceNumber === run.runNumber) {
        addEdge(movementNodeId, runNodeId, "posted against");
      }
    }

    const consumptionNodeId = `consumption:${line.itemId}`;
    const snapshotLine = detail.snapshot?.materialLines.find((item) => item.itemId === line.itemId);
    stageNode(
      consumptionNodeId,
      "consumption",
      "consumption",
      line.materialName || line.materialCode,
      line.batchCode ?? line.itemId,
      `${formatQuantity(consumed, line.baseUnit)} used · ${line.flagged ? "variance flagged" : "within tolerance"}`,
      {
        timestamp: line.batchCode ? source?.receivedAt ?? null : null,
        document: run.runNumber,
        quantity: formatQuantity(consumed, line.baseUnit),
        risk: line.flagged,
        details: [
          { label: "Material", value: `${line.materialCode} · ${line.materialName}` },
          { label: "Planned", value: formatQuantity(line.plannedQuantity, line.baseUnit) },
          { label: "Actual", value: formatQuantity(line.actualQuantity, line.baseUnit) },
          { label: "Damaged", value: formatQuantity(line.damagedQuantity, line.baseUnit) },
          { label: "Variance", value: `${line.varianceBasisPoints ?? 0} bps` },
          { label: "Exception", value: line.flagged ? "Flagged over 3%" : "Within 3%" },
          {
            label: "Unit cost",
            value: snapshotLine
              ? `${snapshotLine.unitCost.numerator}/${snapshotLine.unitCost.denominator}`
              : "—",
          },
          {
            label: "Line cost",
            value: snapshotLine ? formatPaise(snapshotLine.costPaise) : "—",
          },
        ],
        links: [{ label: "Open production record", href: `/production?focus=${run.runNumber}` }],
      },
    );
    addEdge(lotNodeId, consumptionNodeId, "consumed", line.batchCode ?? null);
    addEdge(runNodeId, consumptionNodeId, "recorded", formatQuantity(consumed, line.baseUnit));
  }

  const yieldNodeId = `yield:${run.id}`;
  stageNode(
    yieldNodeId,
    "yield",
    "yield",
    "Yield and variance",
    `${detail.yieldVarianceBasisPoints ?? 0} bps`,
    `${detail.goodOutputPackets} good · ${detail.damagedOutputPackets} damaged · ${detail.exceptionCount} exceptions`,
    {
      document: run.runNumber,
      quantity: `${detail.goodOutputPackets} good packets`,
      timestamp: detail.completedAt,
      risk: detail.yieldFlagged || detail.exceptionCount > 0,
      details: [
        { label: "Planned output", value: `${detail.plannedOutputPackets} packets` },
        { label: "Actual output", value: `${detail.actualOutputPackets} packets` },
        { label: "Good output", value: `${detail.goodOutputPackets} packets` },
        { label: "Damaged output", value: `${detail.damagedOutputPackets} packets` },
        { label: "Yield variance", value: `${detail.yieldVarianceBasisPoints ?? 0} bps` },
        { label: "Yield exception", value: detail.yieldFlagged ? "Flagged over 3%" : "Within 3%" },
        {
          label: "Cost per packet",
          value: detail.snapshot ? formatPaise(detail.snapshot.costPerGoodPacketPaise) : "—",
        },
      ],
      links: [{ label: "Open production record", href: `/production?focus=${run.runNumber}` }],
    },
  );
  addEdge(runNodeId, yieldNodeId, "measured");
  for (const line of detail.lines) {
    addEdge(`consumption:${line.itemId}`, yieldNodeId, "contributes to yield");
  }

  const finishedNodeId = `finished:${finished.id}`;
  const finishedTarget = { type: "finished_good" as const, id: finished.id };
  const finishedLedger = loadStockLedger(db, factoryId, finishedTarget);
  const currentFinishedPackets = calculateStockBalance(
    finishedLedger,
    stockItemKey(finishedTarget),
  );
  const outputMovement = finishedLedger.find((movement) => movement.sourceType === "PRODUCTION_OUTPUT");
  stageNode(
    finishedNodeId,
    "finished",
    "finished",
    "Finished goods batch",
    finished.batchCode,
    `${currentFinishedPackets} packets on hand · ${formatPaise(detail.snapshot?.costPerGoodPacketPaise ?? 0)} per packet`,
    {
      timestamp: finished.packedOn,
      document: finished.batchCode,
      quantity: `${currentFinishedPackets} packets`,
      details: [
        { label: "Batch", value: finished.batchCode },
        { label: "Product", value: `${detail.productCode} · ${detail.productName}` },
        { label: "Packed on", value: finished.packedOn },
        { label: "Expires", value: finished.expiresOn ?? "—" },
        { label: "Produced packets", value: `${detail.goodOutputPackets} good` },
        { label: "Current packets", value: `${currentFinishedPackets}` },
        {
          label: "Material cost",
          value: detail.snapshot ? formatPaise(detail.snapshot.materialCostPaise) : "—",
        },
        {
          label: "Labour",
          value: detail.snapshot ? formatPaise(detail.snapshot.labourPaise) : "—",
        },
        {
          label: "Overhead",
          value: detail.snapshot ? formatPaise(detail.snapshot.overheadPaise) : "—",
        },
        {
          label: "Total run cost",
          value: detail.snapshot ? formatPaise(detail.snapshot.totalRunCostPaise) : "—",
        },
        {
          label: "Cost per packet",
          value: detail.snapshot ? formatPaise(detail.snapshot.costPerGoodPacketPaise) : "—",
        },
        { label: "Output evidence", value: outputMovement?.sourceReference ?? "—" },
      ],
      links: [{ label: "Inspect inventory", href: `/inventory?focus=${finished.batchCode}` }],
    },
  );
  addEdge(yieldNodeId, finishedNodeId, "created", `${detail.goodOutputPackets} packets`);

  const packetRows = db
    .select({ id: finishedGoodPackets.id })
    .from(finishedGoodPackets)
    .where(eq(finishedGoodPackets.finishedGoodId, finished.id))
    .all();
  const packetIds = packetRows.map((row) => row.id);
  const dispatchRows =
    packetIds.length === 0
      ? []
      : db
          .select()
          .from(dispatchItems)
          .where(inArray(dispatchItems.finishedGoodPacketId, packetIds))
          .all();

  let dispatchedPackets = 0;
  const dispatchCustomers = new Set<string>();
  const invoiceIds = new Set<number>();
  const dispatchIds = new Set<number>();
  for (const item of dispatchRows) {
    dispatchedPackets += item.quantityPackets;
    dispatchIds.add(item.dispatchId);
  }

  for (const dispatchId of Array.from(dispatchIds)) {
    const dispatch = db
      .select()
      .from(dispatches)
      .where(and(eq(dispatches.factoryId, factoryId), eq(dispatches.id, dispatchId)))
      .get();
    if (!dispatch) continue;
    const customer = db
      .select()
      .from(customers)
      .where(and(eq(customers.factoryId, factoryId), eq(customers.id, dispatch.customerId)))
      .get();
    if (customer) dispatchCustomers.add(customer.name);
    if (dispatch.invoiceId) invoiceIds.add(dispatch.invoiceId);
    const dispatchNodeId = `dispatch:${dispatch.id}`;
    const dispatchQuantity = dispatchRows
      .filter((item) => item.dispatchId === dispatch.id)
      .reduce((total, item) => total + item.quantityPackets, 0);
    stageNode(
      dispatchNodeId,
      "dispatch",
      "dispatch",
      customer?.name ?? "Dispatch customer",
      dispatch.dispatchNumber,
      `${dispatchQuantity} packets · ${dispatch.status}`,
      {
        timestamp: dispatch.dispatchedAt,
        document: dispatch.dispatchNumber,
        quantity: `${dispatchQuantity} packets`,
        details: [
          { label: "Dispatch", value: dispatch.dispatchNumber },
          { label: "Customer", value: customer?.name ?? "—" },
          { label: "Status", value: dispatch.status },
          { label: "Dispatched", value: dispatch.dispatchedAt },
          { label: "Carrier", value: dispatch.carrierName ?? "—" },
          { label: "Tracking", value: dispatch.trackingNumber ?? "—" },
          { label: "Packets from batch", value: `${dispatchQuantity}` },
          { label: "Invoice link", value: dispatch.invoiceId ? `ID ${dispatch.invoiceId}` : "—" },
        ],
        links: [{ label: "Open dispatch", href: `/dispatch?focus=${dispatch.dispatchNumber}` }],
      },
    );
    addEdge(finishedNodeId, dispatchNodeId, "dispatched", `${dispatchQuantity} packets`);
  }

  if (run.salesOrderId) {
    const orderInvoices = db
      .select()
      .from(invoices)
      .where(and(eq(invoices.factoryId, factoryId), eq(invoices.salesOrderId, run.salesOrderId)))
      .all();
    for (const invoice of orderInvoices) invoiceIds.add(invoice.id);
  }

  for (const invoiceId of Array.from(invoiceIds)) {
    const invoice = db
      .select()
      .from(invoices)
      .where(and(eq(invoices.factoryId, factoryId), eq(invoices.id, invoiceId)))
      .get();
    if (!invoice) continue;
    const customer = db
      .select()
      .from(customers)
      .where(and(eq(customers.factoryId, factoryId), eq(customers.id, invoice.customerId)))
      .get();
    if (customer) dispatchCustomers.add(customer.name);
    const invoiceNodeId = `invoice:${invoice.id}`;
    stageNode(
      invoiceNodeId,
      "invoice",
      "invoice",
      customer?.name ?? "Invoice customer",
      invoice.invoiceNumber,
      `${formatPaise(invoice.totalPaise)} · ${invoice.status}`,
      {
        timestamp: invoice.invoiceDate,
        document: invoice.invoiceNumber,
        details: [
          { label: "Invoice", value: invoice.invoiceNumber },
          { label: "Customer", value: customer?.name ?? "—" },
          { label: "Status", value: invoice.status },
          { label: "Invoice date", value: invoice.invoiceDate },
          { label: "Due date", value: invoice.dueDate },
          { label: "Subtotal", value: formatPaise(invoice.subtotalPaise) },
          { label: "Tax", value: formatPaise(invoice.taxPaise) },
          { label: "Total", value: formatPaise(invoice.totalPaise) },
          { label: "Paid", value: formatPaise(invoice.amountPaidPaise) },
        ],
        links: [{ label: "Open invoice", href: `/invoices?focus=${invoice.invoiceNumber}` }],
      },
    );
    const linkedDispatch = Array.from(dispatchIds)
      .map((id) => `dispatch:${id}`)
      .find((id) => nodes.has(id));
    if (linkedDispatch) addEdge(linkedDispatch, invoiceNodeId, "billed on");
    else addEdge(finishedNodeId, invoiceNodeId, "invoiced from");
  }

  if (supplierSources === 0) gaps.push("No supplier source evidence is linked to this batch.");
  if (ledgerEvents === 0) gaps.push("No stock ledger evidence is linked to this batch.");
  if (dispatchIds.size === 0) gaps.push("No dispatch evidence is recorded for this batch.");
  if (invoiceIds.size === 0) gaps.push("No invoice or customer evidence is recorded for this batch.");

  const invoiceRows = Array.from(invoiceIds).flatMap((id) => {
    const invoice = db
      .select({ invoiceNumber: invoices.invoiceNumber })
      .from(invoices)
      .where(and(eq(invoices.factoryId, factoryId), eq(invoices.id, id)))
      .get();
    return invoice ? [invoice.invoiceNumber] : [];
  });

  return {
    identifier,
    batchCode: finished.batchCode,
    runNumber: run.runNumber,
    productCode: detail.productCode,
    productName: detail.productName,
    productionDate: finished.packedOn,
    status: detail.status,
    nodes: Array.from(nodes.values()).sort(
      (left, right) => left.order - right.order || left.code.localeCompare(right.code),
    ),
    edges: Array.from(edges.values()),
    gaps,
    summary: {
      sourceLots,
      supplierSources,
      ledgerEvents,
      plannedOutputPackets: detail.plannedOutputPackets,
      goodOutputPackets: detail.goodOutputPackets,
      damagedOutputPackets: detail.damagedOutputPackets,
      currentFinishedPackets,
      dispatchedPackets,
      yieldVarianceBasisPoints: detail.yieldVarianceBasisPoints,
      varianceFlags: detail.exceptionCount,
      materialCostPaise: detail.snapshot?.materialCostPaise ?? null,
      labourPaise: detail.snapshot?.labourPaise ?? null,
      overheadPaise: detail.snapshot?.overheadPaise ?? null,
      totalCostPaise: detail.snapshot?.totalRunCostPaise ?? null,
      costPerPacketPaise: detail.snapshot?.costPerGoodPacketPaise ?? null,
      customers: Array.from(dispatchCustomers),
      invoiceReferences: invoiceRows,
    },
  };
}

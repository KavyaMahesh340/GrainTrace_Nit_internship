import { z } from "zod";

const reference = z
  .string()
  .trim()
  .min(2)
  .max(64)
  .regex(/^[A-Za-z0-9_-]+$/, "Use letters, numbers, hyphens, and underscores only.");

const dateValue = z.string().trim().min(1).refine((value) => !Number.isNaN(Date.parse(value)), {
  message: "Enter a valid date.",
});

const optionalDate = z.union([z.literal(""), dateValue]).optional();

const positiveId = z.number().int().positive();
const nonNegativeInteger = z.number().int().nonnegative();
const positiveInteger = z.number().int().positive();

export const supplierInputSchema = z.object({
  code: reference,
  name: z.string().trim().min(2).max(120),
  contactName: z.string().trim().max(120).optional().default(""),
  email: z.union([z.string().trim().email(), z.literal("")]).optional().default(""),
  phone: z.string().trim().max(32).optional().default(""),
  addressLine1: z.string().trim().max(160).optional().default(""),
  city: z.string().trim().max(80).optional().default(""),
  state: z.string().trim().max(80).optional().default(""),
  postalCode: z.string().trim().max(16).optional().default(""),
  gstin: z.string().trim().max(16).optional().default(""),
});

export const purchaseOrderLineSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("raw"),
    sourceLineId: positiveId.optional(),
    rawMaterialId: positiveId,
    quantity: positiveInteger,
    unitCostPaise: nonNegativeInteger,
  }),
  z.object({
    kind: z.literal("packaging"),
    sourceLineId: positiveId.optional(),
    packagingMaterialId: positiveId,
    quantity: positiveInteger,
    unitCostPaise: nonNegativeInteger,
  }),
]);

export const purchaseOrderInputSchema = z.object({
  orderNumber: reference,
  supplierId: positiveId,
  orderDate: dateValue,
  expectedDate: optionalDate,
  lines: z.array(purchaseOrderLineSchema).min(1),
});

export const purchaseOrderStatusSchema = z.enum([
  "submitted",
  "approved",
  "cancelled",
]);

export const goodsReceiptLineSchema = z.object({
  sourceLineId: positiveId,
  kind: z.enum(["raw", "packaging"]),
  acceptedQuantity: positiveInteger,
  damagedQuantity: nonNegativeInteger.default(0),
  rejectedQuantity: nonNegativeInteger.default(0),
  lotCode: reference,
  expiresAt: optionalDate,
  unitCostPaise: nonNegativeInteger,
});

export const goodsReceiptInputSchema = z.object({
  receiptNumber: reference,
  purchaseOrderId: positiveId,
  receivedAt: dateValue,
  notes: z.string().trim().max(500).optional().default(""),
  lines: z.array(goodsReceiptLineSchema).min(1),
});

export const adjustmentReasonSchema = z.enum([
  "damage",
  "shortage",
  "found_stock",
  "quality_check",
  "expiry_write_off",
  "correction",
]);

export const inventoryAdjustmentInputSchema = z.object({
  adjustmentNumber: reference,
  targetType: z.enum(["raw", "packaging", "finished_good"]),
  targetId: positiveId,
  direction: z.enum(["increment", "decrement"]),
  baseUnit: z.enum(["grams", "millilitres", "pieces"]),
  quantity: positiveInteger,
  reason: adjustmentReasonSchema,
  notes: z.string().trim().max(500).optional().default(""),
  occurredAt: dateValue,
  unitCostPaise: nonNegativeInteger.optional(),
});

const productionItemId = z
  .string()
  .trim()
  .regex(/^(raw|packaging):[1-9]\d*$/, "Use a valid material item key.");

export const productionRunInputSchema = z.object({
  runNumber: reference,
  recipeId: positiveId,
  plannedOutputPackets: positiveInteger.max(100_000),
  sellingPricePaise: positiveInteger.optional(),
  notes: z.string().trim().max(500).optional().default(""),
});

export const productionPlanLineSchema = z.object({
  itemId: productionItemId,
  batchId: positiveId,
});

export const productionPlanInputSchema = z.object({
  lines: z.array(productionPlanLineSchema).min(1),
});

export const productionCompletionLineSchema = z.object({
  itemId: productionItemId,
  actualQuantity: positiveInteger,
  damagedQuantity: nonNegativeInteger.default(0),
});

export const productionCompletionInputSchema = z.object({
  lines: z.array(productionCompletionLineSchema).min(1),
  goodOutputPackets: positiveInteger,
  damagedOutputPackets: nonNegativeInteger.default(0),
  labourPaise: nonNegativeInteger.default(0),
  gasPaise: nonNegativeInteger.default(0),
  notes: z.string().trim().max(500).optional().default(""),
});

export const productionPostingInputSchema = z.object({
  finishedBatchCode: reference,
  packedOn: dateValue,
  expiresAt: optionalDate,
  notes: z.string().trim().max(500).optional().default(""),
});

export const productionStatusSchema = z.enum(["planned", "in_progress"]);

export type SupplierInput = z.infer<typeof supplierInputSchema>;
export type PurchaseOrderInput = z.infer<typeof purchaseOrderInputSchema>;
export type PurchaseOrderStatusInput = z.infer<typeof purchaseOrderStatusSchema>;
export type GoodsReceiptInput = z.infer<typeof goodsReceiptInputSchema>;
export type InventoryAdjustmentInput = z.infer<typeof inventoryAdjustmentInputSchema>;
export type ProductionRunInput = z.infer<typeof productionRunInputSchema>;
export type ProductionPlanInput = z.infer<typeof productionPlanInputSchema>;
export type ProductionCompletionInput = z.infer<typeof productionCompletionInputSchema>;
export type ProductionPostingInput = z.infer<typeof productionPostingInputSchema>;
export type ProductionStatusInput = z.infer<typeof productionStatusSchema>;

const gstin = z
  .union([z.string().trim().regex(/^[0-9A-Z]{15}$/, "Enter a valid 15-character GSTIN."), z.literal("")])
  .optional()
  .default("");

export const customerInputSchema = z.object({
  code: reference,
  name: z.string().trim().min(2).max(120),
  customerType: z.enum(["retailer", "distributor"]),
  contactName: z.string().trim().max(120).optional().default(""),
  email: z.union([z.string().trim().email(), z.literal("")]).optional().default(""),
  phone: z.string().trim().max(32).optional().default(""),
  addressLine1: z.string().trim().max(160).optional().default(""),
  addressLine2: z.string().trim().max(160).optional().default(""),
  city: z.string().trim().max(80).optional().default(""),
  state: z.string().trim().min(2).max(80),
  postalCode: z.string().trim().max(16).optional().default(""),
  gstin,
  deliveryAddressLine1: z.string().trim().max(160).optional().default(""),
  deliveryAddressLine2: z.string().trim().max(160).optional().default(""),
  deliveryCity: z.string().trim().max(80).optional().default(""),
  deliveryState: z.string().trim().max(80).optional().default(""),
  deliveryPostalCode: z.string().trim().max(16).optional().default(""),
  creditTermsDays: z.number().int().min(0).max(365),
  creditLimitPaise: z.number().int().nonnegative(),
});

export const customerStatusSchema = z.enum(["active", "inactive", "blocked"]);

export const salesOrderLineSchema = z.object({
  productId: positiveId,
  quantityPackets: positiveInteger,
  unitPricePaise: nonNegativeInteger,
  discountPaise: nonNegativeInteger.default(0),
});

export const salesOrderInputSchema = z.object({
  orderNumber: reference,
  customerId: positiveId,
  orderDate: dateValue,
  requestedDate: optionalDate,
  notes: z.string().trim().max(500).optional().default(""),
  lines: z.array(salesOrderLineSchema).min(1),
});

export const salesOrderStatusSchema = z.enum(["submitted", "approved", "rejected", "cancelled"]);

export const dispatchLineSchema = z.object({
  salesOrderItemId: positiveId,
  quantityPackets: positiveInteger,
});

export const dispatchInputSchema = z.object({
  salesOrderNumber: reference,
  dispatchedAt: dateValue,
  expectedDate: optionalDate,
  status: z.enum(["in_transit", "delivered"]).default("in_transit"),
  carrierName: z.string().trim().max(120).optional().default(""),
  trackingNumber: z.string().trim().max(120).optional().default(""),
  notes: z.string().trim().max(500).optional().default(""),
  lines: z.array(dispatchLineSchema).min(1),
});

export const dispatchStatusSchema = z.enum(["in_transit", "delivered", "cancelled"]);

export const invoiceLineSchema = z.object({
  salesOrderItemId: positiveId,
  quantityPackets: positiveInteger,
});

export const invoiceInputSchema = z.object({
  salesOrderNumber: reference,
  invoiceDate: dateValue,
  rateBasisPoints: z.number().int().min(0).max(10_000).default(500),
  lines: z.array(invoiceLineSchema).min(1),
});

export const invoiceCancelSchema = z.object({
  reason: z.string().trim().min(3).max(500),
});

export const paymentInputSchema = z.object({
  invoiceNumber: z.string().trim().min(2).max(64),
  paidAt: dateValue,
  amountPaise: positiveInteger,
  method: z.enum(["cash", "upi", "bank_transfer", "cheque", "other"]),
  referenceNo: z.string().trim().max(120).optional().default(""),
  notes: z.string().trim().max(500).optional().default(""),
});

export const paymentCorrectionSchema = z.object({
  paymentNumber: z.string().trim().min(2).max(64),
  correctedAt: dateValue,
  amountPaise: positiveInteger,
  reason: z.string().trim().min(3).max(500),
});

export const reportFilterSchema = z.object({
  dateFrom: optionalDate,
  dateTo: optionalDate,
  customerId: z.coerce.number().int().positive().optional(),
  productId: z.coerce.number().int().positive().optional(),
  category: z.string().trim().max(80).optional(),
});

export const auditFilterSchema = z.object({
  query: z.string().trim().max(120).optional(),
  action: z.string().trim().max(80).optional(),
  entityType: z.string().trim().max(80).optional(),
  userId: z.coerce.number().int().positive().optional(),
  dateFrom: optionalDate,
  dateTo: optionalDate,
});

export type CustomerInput = z.infer<typeof customerInputSchema>;
export type CustomerStatusInput = z.infer<typeof customerStatusSchema>;
export type SalesOrderLineInput = z.infer<typeof salesOrderLineSchema>;
export type SalesOrderInput = z.infer<typeof salesOrderInputSchema>;
export type SalesOrderStatusInput = z.infer<typeof salesOrderStatusSchema>;
export type DispatchLineInput = z.infer<typeof dispatchLineSchema>;
export type DispatchInput = z.infer<typeof dispatchInputSchema>;
export type DispatchStatusInput = z.infer<typeof dispatchStatusSchema>;
export type InvoiceLineInput = z.infer<typeof invoiceLineSchema>;
export type InvoiceInput = z.infer<typeof invoiceInputSchema>;
export type InvoiceCancelInput = z.infer<typeof invoiceCancelSchema>;
export type PaymentInput = z.infer<typeof paymentInputSchema>;
export type PaymentCorrectionInput = z.infer<typeof paymentCorrectionSchema>;
export type ReportFilterInput = z.infer<typeof reportFilterSchema>;
export type AuditFilterInput = z.infer<typeof auditFilterSchema>;

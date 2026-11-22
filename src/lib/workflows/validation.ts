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

export type SupplierInput = z.infer<typeof supplierInputSchema>;
export type PurchaseOrderInput = z.infer<typeof purchaseOrderInputSchema>;
export type PurchaseOrderStatusInput = z.infer<typeof purchaseOrderStatusSchema>;
export type GoodsReceiptInput = z.infer<typeof goodsReceiptInputSchema>;
export type InventoryAdjustmentInput = z.infer<typeof inventoryAdjustmentInputSchema>;

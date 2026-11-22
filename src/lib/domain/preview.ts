import { z } from "zod";

export const flowStateSchema = z.enum(["cleared", "active", "queued", "exception"]);
export const stockStateSchema = z.enum(["critical", "watch", "stable"]);
export const severitySchema = z.enum(["blocked", "watch"]);

export const previewSnapshotSchema = z.object({
  dataMode: z.literal("PREVIEW"),
  isLive: z.literal(false),
  generatedAt: z.string().min(1),
  factory: z.object({
    code: z.string().min(1),
    name: z.string().min(1),
    location: z.string().min(1),
    operationalDate: z.string().min(1),
    shift: z.string().min(1),
    shiftWindow: z.string().min(1),
  }),
  pulse: z.object({
    unit: z.string().min(1),
    target: z.number().positive(),
    points: z.array(
      z.object({
        interval: z.string().min(1),
        planned: z.number().nonnegative(),
        actual: z.number().nonnegative(),
      }),
    ).min(1),
  }),
  flow: z.array(
    z.object({
      code: z.string().min(1),
      label: z.string().min(1),
      state: flowStateSchema,
      count: z.number().int().nonnegative(),
    }),
  ).min(1),
  orders: z.array(
    z.object({
      id: z.string().min(1),
      customer: z.string().min(1),
      quantity: z.number().positive(),
      due: z.string().min(1),
      value: z.number().positive(),
      state: z.string().min(1),
      priority: z.enum(["high", "normal"]),
    }),
  ).min(1),
  stock: z.array(
    z.object({
      material: z.string().min(1),
      code: z.string().min(1),
      onHand: z.number().positive(),
      unit: z.string().min(1),
      daysCover: z.number().positive(),
      state: stockStateSchema,
    }),
  ).min(1),
  exceptions: z.array(
    z.object({
      id: z.string().min(1),
      title: z.string().min(1),
      detail: z.string().min(1),
      severity: severitySchema,
      detectedAt: z.string().min(1),
    }),
  ),
  activity: z.array(
    z.object({
      id: z.string().min(1),
      time: z.string().min(1),
      title: z.string().min(1),
      detail: z.string().min(1),
    }),
  ).min(1),
  dna: z.object({
    batchCode: z.string().min(1),
    product: z.string().min(1),
    linkedLots: z.number().int().nonnegative(),
    evidence: z.string().min(1),
    stages: z.array(
      z.object({
        label: z.string().min(1),
        value: z.string().min(1),
        state: flowStateSchema,
      }),
    ).min(1),
  }),
});

export type PreviewSnapshot = z.infer<typeof previewSnapshotSchema>;
export type FlowState = z.infer<typeof flowStateSchema>;
export type StockState = z.infer<typeof stockStateSchema>;
export type Severity = z.infer<typeof severitySchema>;

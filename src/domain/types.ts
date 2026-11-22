import type { Paise, Rational } from "./money";
import type { BaseUnit } from "./units";

export type StockItemId = string;

export type StockSource = {
  sourceType: string;
  sourceReference: string;
};

export type StockMovementInput = StockSource & {
  movementId: string;
  itemId: StockItemId;
  baseUnit: BaseUnit;
  quantityDelta: number;
  occurredAt: string;
  unitCost?: Rational;
};

export type PostedStockMovement = StockMovementInput & {
  balance: number;
};

export type PlannedMaterialUsage = {
  itemId: StockItemId;
  quantity: number;
  baseUnit: BaseUnit;
};

export type MaterialUsage = PlannedMaterialUsage & {
  unitCost: Rational;
};

export type RecipeDefinition = {
  code: string;
  expectedOutputPackets: number;
  lines: readonly PlannedMaterialUsage[];
};

export type MaterialVariance = {
  itemId: StockItemId;
  plannedQuantity: number;
  actualQuantity: number;
  varianceBasisPoints: number;
  flagged: boolean;
};

export type ProductionMetrics = {
  plannedOutputPackets: number;
  actualOutputPackets: number;
  damagedOutputPackets: number;
  goodOutputPackets: number;
  yieldVarianceBasisPoints: number;
  yieldFlagged: boolean;
};

export type ProductionCostLine = MaterialUsage & {
  costPaise: Paise;
};

export type ProductionCostSnapshot = {
  snapshotId: string;
  runNumber: string;
  postedAt: string;
  goodOutputPackets: number;
  materialLines: readonly ProductionCostLine[];
  materialCostPaise: Paise;
  labourPaise: Paise;
  gasPaise: Paise;
  overheadPaise: Paise;
  totalRunCostPaise: Paise;
  materialCostPerGoodPacketPaise: Paise;
  overheadPerGoodPacket: Rational;
  overheadCostPerGoodPacketPaise: Paise;
  costPerGoodPacketPaise: Paise;
  sellingPricePaise?: Paise;
  grossMarginPerPacketPaise?: Paise;
  grossMarginBasisPoints?: number;
  markupBasisPoints?: number;
};

export type GstJurisdiction = "intra_state" | "inter_state";

export type TaxBreakdown = {
  hsnCode: string;
  taxablePaise: Paise;
  rateBasisPoints: number;
  jurisdiction: GstJurisdiction;
  cgstPaise: Paise;
  sgstPaise: Paise;
  igstPaise: Paise;
  totalTaxPaise: Paise;
  totalPaise: Paise;
};

export type InvoiceLineInput = {
  productCode: string;
  hsnCode: string;
  quantityPackets: number;
  unitPricePaise: Paise;
};

export type InvoiceLine = InvoiceLineInput & {
  lineTotalPaise: Paise;
};

export type TaxInvoice = {
  invoiceNumber: string;
  fromState: string;
  toState: string;
  jurisdiction: GstJurisdiction;
  lines: readonly InvoiceLine[];
  subtotalPaise: Paise;
  tax: TaxBreakdown;
  totalPaise: Paise;
};

export type PaymentMethod = "cash" | "upi" | "bank_transfer" | "cheque" | "other";

export type PaymentRecord = {
  paymentId: string;
  invoiceNumber: string;
  amountPaise: Paise;
  method: PaymentMethod;
  paidAt: string;
};

export type FulfilmentPlan = {
  orderNumber: string;
  requestedPackets: number;
  availablePackets: number;
  fulfillablePackets: number;
  backorderPackets: number;
  shortagePackets: number;
  isPartial: boolean;
};

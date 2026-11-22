import { addPaise, multiplyPaiseByInteger } from "./money";
import { assertHsnCode, calculateGst, resolveGstJurisdiction } from "./tax";
import type { InvoiceLine, TaxInvoice } from "./types";
import {
  assertNonEmptyString,
  assertNonNegativeInteger,
  assertPositiveInteger,
  assertUniqueIds,
  ValidationError,
} from "./validation";

export type CreateTaxInvoiceInput = {
  invoiceNumber: string;
  fromState: string;
  toState: string;
  rateBasisPoints?: number;
  lines: readonly {
    productCode: string;
    hsnCode: string;
    quantityPackets: number;
    unitPricePaise: number;
  }[];
};

export function createTaxInvoice(input: CreateTaxInvoiceInput): TaxInvoice {
  assertNonEmptyString(input.invoiceNumber, "invoice number");
  if (input.lines.length === 0) {
    throw new ValidationError("An invoice must contain at least one line.");
  }
  assertUniqueIds(input.lines, (line) => line.productCode, "invoice line");

  const jurisdiction = resolveGstJurisdiction(input.fromState, input.toState);
  const lines: InvoiceLine[] = input.lines.map((line) => ({
    productCode: assertNonEmptyString(line.productCode, "product code"),
    hsnCode: assertHsnCode(line.hsnCode),
    quantityPackets: assertPositiveInteger(line.quantityPackets, "invoice quantity"),
    unitPricePaise: assertNonNegativeInteger(line.unitPricePaise, "unit price paise"),
    lineTotalPaise: 0,
  }));

  const hsnCodes = new Set(lines.map((line) => line.hsnCode));
  if (hsnCodes.size !== 1) {
    throw new ValidationError("Aggregate invoice tax requires one HSN across all lines.");
  }

  const pricedLines = lines.map((line) => ({
    ...line,
    lineTotalPaise: multiplyPaiseByInteger(line.unitPricePaise, line.quantityPackets),
  }));
  const subtotalPaise = addPaise(...pricedLines.map((line) => line.lineTotalPaise));
  const tax = calculateGst({
    hsnCode: pricedLines[0].hsnCode,
    taxablePaise: subtotalPaise,
    rateBasisPoints: input.rateBasisPoints,
    jurisdiction,
  });

  return {
    invoiceNumber: input.invoiceNumber,
    fromState: input.fromState,
    toState: input.toState,
    jurisdiction,
    lines: pricedLines,
    subtotalPaise,
    tax,
    totalPaise: tax.totalPaise,
  };
}

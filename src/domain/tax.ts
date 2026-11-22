import { addPaise, applyBasisPoints, createRational, roundRationalToInteger } from "./money";
import type { GstJurisdiction, TaxBreakdown } from "./types";
import { assertNonEmptyString, assertNonNegativeInteger, ValidationError } from "./validation";

export const GST_RATE_BASIS_POINTS = 500;

export function assertHsnCode(hsnCode: string): string {
  const hsn = assertNonEmptyString(hsnCode, "HSN code");
  if (!/^\d{4,8}$/.test(hsn)) {
    throw new ValidationError("HSN code must contain 4 to 8 digits.");
  }
  return hsn;
}

export function resolveGstJurisdiction(fromState: string, toState: string): GstJurisdiction {
  const origin = assertNonEmptyString(fromState, "origin state").toLocaleLowerCase("en-IN");
  const destination = assertNonEmptyString(toState, "destination state").toLocaleLowerCase("en-IN");
  return origin === destination ? "intra_state" : "inter_state";
}

export function calculateGst(input: {
  hsnCode: string;
  taxablePaise: number;
  rateBasisPoints?: number;
  jurisdiction: GstJurisdiction;
}): TaxBreakdown {
  const hsnCode = assertHsnCode(input.hsnCode);
  const taxablePaise = assertNonNegativeInteger(input.taxablePaise, "taxable paise");
  const rateBasisPoints = assertNonNegativeInteger(
    input.rateBasisPoints ?? GST_RATE_BASIS_POINTS,
    "GST rate basis points",
  );
  if (rateBasisPoints > 10_000) {
    throw new ValidationError("GST rate cannot exceed 100%.");
  }

  const totalTaxPaise = applyBasisPoints(taxablePaise, rateBasisPoints);
  const igstPaise = input.jurisdiction === "inter_state" ? totalTaxPaise : 0;
  const cgstPaise =
    input.jurisdiction === "intra_state"
      ? roundRationalToInteger(createRational(totalTaxPaise, 2))
      : 0;
  const sgstPaise = input.jurisdiction === "intra_state" ? totalTaxPaise - cgstPaise : 0;

  return {
    hsnCode,
    taxablePaise,
    rateBasisPoints,
    jurisdiction: input.jurisdiction,
    cgstPaise,
    sgstPaise,
    igstPaise,
    totalTaxPaise,
    totalPaise: addPaise(taxablePaise, totalTaxPaise),
  };
}

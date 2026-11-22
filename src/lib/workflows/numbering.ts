import "server-only";
import { and, eq } from "drizzle-orm";
import { documentNumberSequences } from "@/lib/db/schema";
import type { WorkflowTransaction } from "./db";
import { WorkflowError } from "./errors";

export const DOCUMENT_NUMBER_TYPES = ["INVOICE", "CREDIT_NOTE", "PAYMENT", "DISPATCH"] as const;

export type DocumentNumberType = (typeof DOCUMENT_NUMBER_TYPES)[number];

export const DOCUMENT_NUMBER_CONFIG: Record<DocumentNumberType, { prefix: string; padding: number }> = {
  INVOICE: { prefix: "TN", padding: 4 },
  CREDIT_NOTE: { prefix: "CN/TN", padding: 4 },
  PAYMENT: { prefix: "PAY", padding: 4 },
  DISPATCH: { prefix: "DSP", padding: 4 },
};

export function financialYearForDate(issuedDate: string): string {
  const parsed = new Date(issuedDate);
  if (Number.isNaN(parsed.getTime())) {
    throw new WorkflowError("Enter a valid issue date.", "invalid_date");
  }
  const year = parsed.getUTCFullYear();
  const month = parsed.getUTCMonth() + 1;
  return month >= 4 ? `${year}-${String((year + 1) % 100).padStart(2, "0")}` : `${year - 1}-${String(year % 100).padStart(2, "0")}`;
}

export function addDaysToDate(date: string, days: number): string {
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) {
    throw new WorkflowError("Enter a valid date.", "invalid_date");
  }
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
}

export function formatDocumentNumber(prefix: string, scopeKey: string, value: number, padding: number): string {
  return `${prefix}/${scopeKey}/${String(value).padStart(padding, "0")}`;
}

export function allocateDocumentNumber(
  tx: WorkflowTransaction,
  factoryId: number,
  documentType: DocumentNumberType,
  issuedDate: string,
): { number: string; financialYear: string } {
  const financialYear = financialYearForDate(issuedDate);
  let sequence = tx
    .select()
    .from(documentNumberSequences)
    .where(
      and(
        eq(documentNumberSequences.factoryId, factoryId),
        eq(documentNumberSequences.documentType, documentType),
        eq(documentNumberSequences.scopeKey, financialYear),
      ),
    )
    .get();

  if (!sequence) {
    const config = tx
      .select()
      .from(documentNumberSequences)
      .where(
        and(
          eq(documentNumberSequences.factoryId, factoryId),
          eq(documentNumberSequences.documentType, documentType),
          eq(documentNumberSequences.scopeKey, "CONFIG"),
        ),
      )
      .get();
    const fallback = DOCUMENT_NUMBER_CONFIG[documentType];
    tx.insert(documentNumberSequences)
      .values({
        factoryId,
        documentType,
        scopeKey: financialYear,
        prefix: config?.prefix ?? fallback.prefix,
        padding: config?.padding ?? fallback.padding,
        nextValue: 1,
        updatedAt: new Date().toISOString(),
      })
      .run();
    sequence = tx
      .select()
      .from(documentNumberSequences)
      .where(
        and(
          eq(documentNumberSequences.factoryId, factoryId),
          eq(documentNumberSequences.documentType, documentType),
          eq(documentNumberSequences.scopeKey, financialYear),
        ),
      )
      .get();
  }

  if (!sequence) {
    throw new WorkflowError("Unable to allocate a document number.", "numbering_failed", 500);
  }

  const value = sequence.nextValue;
  tx.update(documentNumberSequences)
    .set({ nextValue: value + 1, updatedAt: new Date().toISOString() })
    .where(eq(documentNumberSequences.id, sequence.id))
    .run();

  return {
    number: formatDocumentNumber(sequence.prefix, financialYear, value, sequence.padding),
    financialYear,
  };
}

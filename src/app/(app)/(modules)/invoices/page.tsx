import type { Metadata } from "next";
import { ProtectedModulePage } from "@/components/system/protected-module-page";
import { requirePermission } from "@/lib/auth/access";

export const metadata: Metadata = { title: "Invoices" };

export default async function InvoicesPage({ searchParams }: { searchParams: { focus?: string } }) {
  requirePermission("invoices:view");
  return (
    <ProtectedModulePage
      permission="invoices:view"
      code="08"
      title="Invoices"
      description="Dispatch-ready orders become invoices. Tax, valuation, and collection linkage are planned workflows."
      focusLabel="Invoice reference"
      focusValue={searchParams.focus}
    />
  );
}

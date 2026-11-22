import type { Metadata } from "next";
import { ModulePage } from "@/components/system/module-page";

export const metadata: Metadata = { title: "Invoices" };

export default function InvoicesPage({ searchParams }: { searchParams: { focus?: string } }) {
  return (
    <ModulePage
      code="08"
      title="Invoices"
      description="Dispatch-ready orders become invoices. Tax, valuation, and collection linkage are Phase 2 workflows."
      focusLabel="Invoice reference"
      focusValue={searchParams.focus}
    />
  );
}

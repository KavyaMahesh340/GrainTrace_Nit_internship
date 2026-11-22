import type { Metadata } from "next";
import { ModulePage } from "@/components/system/module-page";

export const metadata: Metadata = { title: "Collections" };

export default function CollectionsPage({ searchParams }: { searchParams: { focus?: string } }) {
  return (
    <ModulePage
      code="10"
      title="Collections"
      description="Invoices close through collections. Receipts, ageing, and reconciliation are Phase 2 workflows."
      focusLabel="Collection reference"
      focusValue={searchParams.focus}
    />
  );
}

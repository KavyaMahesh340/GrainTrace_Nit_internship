import type { Metadata } from "next";
import { ModulePage } from "@/components/system/module-page";

export const metadata: Metadata = { title: "Purchases" };

export default function PurchasesPage({ searchParams }: { searchParams: { focus?: string } }) {
  return (
    <ModulePage
      code="03"
      title="Purchases"
      description="Approved orders create purchase requirements. Supplier, receipt, and raw-material lot linkage are Phase 2 workflows."
      focusLabel="Purchase reference"
      focusValue={searchParams.focus}
    />
  );
}

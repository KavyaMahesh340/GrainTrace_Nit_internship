import type { Metadata } from "next";
import { ModulePage } from "@/components/system/module-page";

export const metadata: Metadata = { title: "Inventory" };

export default function InventoryPage({ searchParams }: { searchParams: { focus?: string } }) {
  return (
    <ModulePage
      code="04"
      title="Raw material inventory"
      description="Received lots enter raw material stock. Quantity ledger, valuation, and consumption accountability are Phase 2 workflows."
      focusLabel="Material reference"
      focusValue={searchParams.focus}
    />
  );
}

import type { Metadata } from "next";
import { ProtectedModulePage } from "@/components/system/protected-module-page";
import { requirePermission } from "@/lib/auth/access";

export const metadata: Metadata = { title: "Inventory" };

export default async function InventoryPage({ searchParams }: { searchParams: { focus?: string } }) {
  requirePermission("inventory:view");
  return (
    <ProtectedModulePage
      permission="inventory:view"
      code="04"
      title="Raw material inventory"
      description="Received lots enter raw material stock. Quantity ledger, valuation, and consumption accountability are Phase 2 workflows."
      focusLabel="Material reference"
      focusValue={searchParams.focus}
    />
  );
}

import type { Metadata } from "next";
import { ProtectedModulePage } from "@/components/system/protected-module-page";
import { requirePermission } from "@/lib/auth/access";

export const metadata: Metadata = { title: "Purchases" };

export default async function PurchasesPage({ searchParams }: { searchParams: { focus?: string } }) {
  requirePermission("purchases:view");
  return (
    <ProtectedModulePage
      permission="purchases:view"
      code="03"
      title="Purchases"
      description="Approved orders create purchase requirements. Supplier, receipt, and raw-material lot linkage are Phase 2 workflows."
      focusLabel="Purchase reference"
      focusValue={searchParams.focus}
    />
  );
}

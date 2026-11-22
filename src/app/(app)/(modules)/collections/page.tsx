import type { Metadata } from "next";
import { ProtectedModulePage } from "@/components/system/protected-module-page";
import { requirePermission } from "@/lib/auth/access";

export const metadata: Metadata = { title: "Collections" };

export default async function CollectionsPage({ searchParams }: { searchParams: { focus?: string } }) {
  requirePermission("payments:view");
  return (
    <ProtectedModulePage
      permission="payments:view"
      code="10"
      title="Collections"
      description="Invoices close through collections. Receipts, ageing, and reconciliation are planned workflows."
      focusLabel="Collection reference"
      focusValue={searchParams.focus}
    />
  );
}

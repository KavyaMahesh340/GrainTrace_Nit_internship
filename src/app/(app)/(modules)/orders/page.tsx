import type { Metadata } from "next";
import { ProtectedModulePage } from "@/components/system/protected-module-page";
import { requirePermission } from "@/lib/auth/access";

export const metadata: Metadata = { title: "Orders" };

export default async function OrdersPage({ searchParams }: { searchParams: { focus?: string } }) {
  requirePermission("orders:view");
  return (
    <ProtectedModulePage
      permission="orders:view"
      code="01"
      title="Orders"
      description="Salesman orders enter the material journey here. Approval, purchase linkage, and order-to-production handoff are planned workflows."
      focusLabel="Order reference"
      focusValue={searchParams.focus}
    />
  );
}

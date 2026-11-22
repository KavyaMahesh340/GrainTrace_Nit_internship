import type { Metadata } from "next";
import { ModulePage } from "@/components/system/module-page";

export const metadata: Metadata = { title: "Orders" };

export default function OrdersPage({ searchParams }: { searchParams: { focus?: string } }) {
  return (
    <ModulePage
      code="01"
      title="Orders"
      description="Salesman orders enter the material journey here. Approval, purchase linkage, and order-to-production handoff are Phase 2 workflows."
      focusLabel="Order reference"
      focusValue={searchParams.focus}
    />
  );
}
